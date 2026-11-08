// Request an order: choose products, confirm delivery details, send. Nothing is charged here.
import { api } from '/dashboard/core/api.js';
import { clear, h } from '/dashboard/core/dom.js';
import { money } from '/dashboard/core/format.js';
import { Alert, Button, Card, EmptyState, Field, Icon, PageHeader, StockBadge, withBusy } from '/dashboard/ui/index.js';

const MAX_QTY = 20;
const clampQty = (value) => Math.max(0, Math.min(MAX_QTY, Math.floor(Number(value) || 0)));

export async function requestView(ctx) {
  const [{ products, currency }, { customer }] = await Promise.all([api('GET', '/api/products'), api('GET', '/api/customer/me')]);
  ctx.setMe(customer);
  const a = customer.address || {};
  const head = PageHeader({
    eyebrow: 'New request',
    title: 'Request an order',
    lead: 'Choose what you would like and where to send it. Nothing is charged here: the store contacts you to confirm the price, payment and delivery.',
  });
  if (!products.length) {
    return h('div', { class: 'stack' }, head, Card({}, EmptyState({ icon: 'box', title: 'Nothing to order right now', text: 'No products are available to request right now. Please check back soon.' })));
  }

  // ---- Products
  const rows = new Map();
  const productsCard = Card({ title: 'Products', subtitle: 'Up to 20 of each.' });
  for (const p of products) {
    const out = p.stockStatus === 'out_of_stock';
    const input = h('input', { type: 'number', min: '0', max: String(MAX_QTY), step: '1', value: '0', inputmode: 'numeric', 'aria-label': `Quantity of ${p.name}`, disabled: out });
    const less = Button({ variant: 'quiet', icon: 'minus', 'aria-label': `One fewer ${p.name}`, disabled: out });
    const more = Button({ variant: 'quiet', icon: 'plus', 'aria-label': `One more ${p.name}`, disabled: out });
    const step = (delta) => {
      input.value = String(clampQty(Number(input.value) + delta));
      recalc();
    };
    less.addEventListener('click', () => step(-1));
    more.addEventListener('click', () => step(1));
    input.addEventListener('input', recalc);
    const row = h(
      'div',
      { class: 'pick' },
      h('div', {}, h('div', { class: 'pick__name', text: p.name }), h('div', { class: 'pick__meta' }, h('span', { text: money(p.priceCents, currency) }), StockBadge(p.stockStatus), p.description ? h('span', { text: p.description }) : null)),
      h('div', { class: 'qty' }, less, input, more)
    );
    rows.set(p.id, { p, input, row });
    productsCard.append(row);
  }

  // ---- Delivery details
  const f = {
    name: Field({ label: 'Delivery name', type: 'text', autocomplete: 'name', required: true, maxlength: 100, value: customer.name || '' }),
    phone: Field({ label: 'Phone', type: 'tel', autocomplete: 'tel', required: true, maxlength: 30, value: customer.phone || '' }),
    line1: Field({ label: 'Address line 1', type: 'text', autocomplete: 'address-line1', required: true, maxlength: 150, value: a.line1 || '', class: 'span-2' }),
    line2: Field({ label: 'Address line 2 (optional)', type: 'text', autocomplete: 'address-line2', maxlength: 150, value: a.line2 || '', class: 'span-2' }),
    city: Field({ label: 'City', type: 'text', autocomplete: 'address-level2', required: true, maxlength: 80, value: a.city || '' }),
    region: Field({ label: 'State or region (optional)', type: 'text', autocomplete: 'address-level1', maxlength: 80, value: a.region || '' }),
    postcode: Field({ label: 'Postcode', type: 'text', autocomplete: 'postal-code', required: true, maxlength: 20, value: a.postcode || '' }),
    country: Field({ label: 'Country', type: 'text', autocomplete: 'country-name', required: true, maxlength: 60, value: a.country || '' }),
  };
  const deliveryCard = Card({ title: 'Delivery details', subtitle: 'Prefilled from My details. Change them for this order if you like.' }, h('div', { class: 'form-grid' }, Object.values(f).map((x) => x.el)));

  // ---- Summary
  const lines = h('ul', { class: 'summary__lines' });
  const totalOut = h('strong', { 'aria-live': 'polite', text: money(0, currency) });
  const note = Field({ label: 'Note for the store (optional)', tag: 'textarea', maxlength: 500 });
  const alert = Alert();
  const submit = Button({ label: 'Send order request', type: 'submit', icon: 'check', full: true });
  const summaryCard = Card(
    { title: 'Your request', tone: 'strong' },
    lines,
    h('div', { class: 'total-bar' }, h('span', { text: 'Estimated total' }), totalOut),
    h('div', { class: 'form' }, note.el, alert.el, submit, h('p', { class: 'muted small', text: 'Sending a request does not charge you. The store replies to confirm.' }))
  );

  function recalc() {
    clear(lines);
    let total = 0;
    for (const { p, input, row } of rows.values()) {
      const qty = clampQty(input.value);
      row.classList.toggle('is-selected', qty > 0);
      if (!qty) continue;
      total += qty * p.priceCents;
      lines.append(h('li', { class: 'summary__line' }, h('span', { text: `${qty} × ${p.name}` }), h('span', { text: money(qty * p.priceCents, currency) })));
    }
    if (!lines.children.length) lines.append(h('li', { class: 'muted small', text: 'Nothing chosen yet.' }));
    totalOut.textContent = money(total, currency);
  }
  recalc();

  const form = h('form', { class: 'split', novalidate: true }, h('div', { class: 'stack' }, productsCard, deliveryCard), h('aside', { class: 'split__side' }, summaryCard));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.hide();
    const items = [...rows.values()].map(({ p, input }) => ({ productId: p.id, qty: clampQty(input.value) })).filter((i) => i.qty > 0);
    if (!items.length) {
      alert.show('Choose at least one product by setting a quantity.');
      return;
    }
    const contact = Object.fromEntries(Object.entries(f).map(([key, x]) => [key, x.input.value]));
    await withBusy(
      submit,
      async () => {
        try {
          const data = await api('POST', '/api/customer/orders', { items, contact, note: note.input.value });
          ctx.shell.setView(sentView(ctx, data.order));
        } catch (error) {
          ctx.fail(error, alert);
        }
      },
      'Sending…'
    );
  });
  return h('div', { class: 'stack' }, head, form);
}

function sentView(ctx, order) {
  return h(
    'div',
    { class: 'stack' },
    h('header', { class: 'page-head' }, h('div', {}, h('p', { class: 'eyebrow', text: 'Thank you' }), h('h1', { class: 'page-title', text: 'Request sent' }))),
    Card(
      { tone: 'strong' },
      h(
        'div',
        { class: 'success' },
        h('span', { class: 'success__badge' }, Icon('check', { size: 38 })),
        h('p', {}, `Your order request ${order.orderNo} for ${money(order.totalCents, order.currency)} has been sent to the store.`),
        h('p', { class: 'muted', text: 'Nothing has been charged. The store will contact you to confirm the price, payment and delivery. You can follow the progress under My orders.' }),
        Button({ label: 'See my orders', onClick: () => ctx.go('orders') })
      )
    )
  );
}

