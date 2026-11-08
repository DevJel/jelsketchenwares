// My orders: a quick count, then one glass card per order request with expandable details.
import { api } from '/dashboard/core/api.js';
import { h, uid } from '/dashboard/core/dom.js';
import { ORDER_FLOW, STEP_LABELS, joinAddress, money, when } from '/dashboard/core/format.js';
import { Button, Card, DescriptionList, EmptyState, Icon, Notice, PageHeader, Stat, StatusBadge, Stepper, confirmDialog, toast, withBusy } from '/dashboard/ui/index.js';

const OPEN = ['requested', 'confirmed', 'packed', 'shipped'];

export async function ordersView(ctx) {
  const { orders } = await api('GET', '/api/customer/orders');
  const root = h('div', { class: 'stack' });
  root.append(
    PageHeader({
      eyebrow: 'My account',
      title: 'My orders',
      lead: orders.length ? 'Follow each order request from the store. Open the details to see the delivery information and progress.' : 'Your order requests will appear here.',
      actions: Button({ label: 'Request an order', icon: 'plus', class: 'hide-in-menu', onClick: () => ctx.go('request') }),
    })
  );
  if (!orders.length) {
    root.append(
      Card(
        {},
        EmptyState({
          icon: 'bag',
          title: 'No order requests yet',
          text: 'You have not sent any order requests yet.',
          action: Button({ label: 'Choose products', icon: 'plus', onClick: () => ctx.go('request') }),
        })
      )
    );
    return root;
  }
  root.append(
    h(
      'div',
      { class: 'grid-stats' },
      Stat({ label: 'Open requests', value: orders.filter((o) => OPEN.includes(o.status)).length, icon: 'truck', tone: 'gold' }),
      Stat({ label: 'Delivered', value: orders.filter((o) => o.status === 'delivered').length, icon: 'check', tone: 'ok' }),
      Stat({ label: 'All requests', value: orders.length, icon: 'bag', tone: 'info' })
    ),
    h('ul', { class: 'list', 'data-stagger': 'children' }, orders.map((order) => h('li', {}, OrderCard(ctx, order))))
  );
  return root;
}

function OrderCard(ctx, order) {
  const panelId = uid('order-panel');
  const summary = order.items.map((i) => `${i.qty} × ${i.name}`).join(', ');

  // The whole top of the card is one button: no separate "Details" button on every card.
  const toggle = h(
    'button',
    { type: 'button', class: 'order__toggle', 'aria-expanded': 'false', 'aria-controls': panelId },
    h('span', { class: 'order__head' }, h('span', { class: 'order__no', text: order.orderNo }), StatusBadge(order.status), h('span', { class: 'muted small', text: when(order.createdAt) }), h('span', { class: 'order__total', text: money(order.totalCents, order.currency) }), Icon('chevron', { size: 18 })),
    h('span', { class: 'order__summary', text: summary })
  );
  const inner = h('div', { class: 'collapse__inner', inert: true }, OrderDetails(ctx, order));
  const collapse = h('div', { class: 'collapse', id: panelId, 'data-open': 'false' }, inner);

  toggle.addEventListener('click', () => {
    const open = collapse.dataset.open !== 'true';
    collapse.dataset.open = String(open);
    inner.inert = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });

  return h('article', { class: 'card card--lift order' }, toggle, collapse);
}

function OrderDetails(ctx, order) {
  const c = order.contact || {};
  const table = h(
    'table',
    { class: 'items' },
    h('caption', { class: 'sr-only', text: `Items in ${order.orderNo}` }),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Item' }), h('th', { scope: 'col', class: 'num', text: 'Qty' }), h('th', { scope: 'col', class: 'num', text: 'Price' }))),
    h('tbody', {}, order.items.map((i) => h('tr', {}, h('td', { text: i.name }), h('td', { class: 'num', text: String(i.qty) }), h('td', { class: 'num', text: money(i.lineCents, order.currency) })))),
    h('tfoot', {}, h('tr', {}, h('th', { scope: 'row', colspan: '2', text: 'Total' }), h('td', { class: 'num', text: money(order.totalCents, order.currency) })))
  );
  const progress =
    order.status === 'cancelled'
      ? Notice({ kind: 'error', text: 'This request was cancelled.' })
      : Stepper({ steps: ORDER_FLOW.map((id) => ({ id, label: STEP_LABELS[id] })), current: order.status });

  const detail = h(
    'div',
    { class: 'order__detail' },
    table,
    DescriptionList([
      ['Deliver to', [c.name, joinAddress(c)].filter(Boolean).join(', ')],
      ['Phone', c.phone],
      ['Your note', order.note],
      ['Last update', when(order.updatedAt)],
    ]),
    progress
  );

  if (order.status === 'requested') {
    const cancel = Button({ label: 'Cancel this request', variant: 'danger', size: 'sm' });
    cancel.addEventListener('click', async () => {
      const yes = await confirmDialog({
        title: 'Cancel this request?',
        body: `Order request ${order.orderNo} will be cancelled. You can send a new request at any time.`,
        confirmLabel: 'Yes, cancel it',
        cancelLabel: 'Keep it',
      });
      if (!yes) return;
      await withBusy(cancel, async () => {
        try {
          await api('POST', `/api/customer/orders/${order.id}/cancel`, {});
          toast(`Request ${order.orderNo} was cancelled.`, 'ok');
          ctx.refresh();
        } catch (error) {
          ctx.fail(error);
        }
      });
    });
    detail.append(h('div', { class: 'form-actions' }, cancel));
  }
  return detail;
}
