// My details: name, phone and the saved delivery address.
import { api } from '/dashboard/core/api.js';
import { h } from '/dashboard/core/dom.js';
import { Alert, Button, Card, Field, PageHeader, toast, withBusy } from '/dashboard/ui/index.js';

const ADDRESS_KEYS = ['line1', 'line2', 'city', 'region', 'postcode', 'country'];

export async function profileView(ctx) {
  const { customer } = await api('GET', '/api/customer/me');
  ctx.setMe(customer);
  const a = customer.address || {};
  const f = {
    name: Field({ label: 'Name', type: 'text', autocomplete: 'name', required: true, maxlength: 100, value: customer.name }),
    phone: Field({ label: 'Phone', type: 'tel', autocomplete: 'tel', maxlength: 30, value: customer.phone || '' }),
    line1: Field({ label: 'Address line 1', type: 'text', autocomplete: 'address-line1', maxlength: 150, value: a.line1 || '', class: 'span-2' }),
    line2: Field({ label: 'Address line 2', type: 'text', autocomplete: 'address-line2', maxlength: 150, value: a.line2 || '', class: 'span-2' }),
    city: Field({ label: 'City', type: 'text', autocomplete: 'address-level2', maxlength: 80, value: a.city || '' }),
    region: Field({ label: 'State or region', type: 'text', autocomplete: 'address-level1', maxlength: 80, value: a.region || '' }),
    postcode: Field({ label: 'Postcode', type: 'text', autocomplete: 'postal-code', maxlength: 20, value: a.postcode || '' }),
    country: Field({ label: 'Country', type: 'text', autocomplete: 'country-name', maxlength: 60, value: a.country || '' }),
  };
  const alert = Alert();
  const submit = Button({ label: 'Save my details', type: 'submit', icon: 'check' });

  const form = h(
    'form',
    { class: 'stack', novalidate: true },
    h('div', { class: 'grid-2' }, Card({ title: 'About you', subtitle: `Signed in as ${customer.email}` }, h('div', { class: 'form' }, f.name.el, f.phone.el)), Card({ title: 'Delivery address', subtitle: 'Used to fill in your order requests.' }, h('div', { class: 'form-grid' }, ADDRESS_KEYS.map((k) => f[k].el)))),
    h('div', { class: 'form-actions' }, submit, alert.el)
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.hide();
    if (!f.name.input.value.trim()) {
      alert.show('Your name is required.');
      return;
    }
    await withBusy(
      submit,
      async () => {
        try {
          const data = await api('PATCH', '/api/customer/me', {
            name: f.name.input.value,
            phone: f.phone.input.value,
            address: Object.fromEntries(ADDRESS_KEYS.map((k) => [k, f[k].input.value])),
          });
          ctx.setMe(data.customer);
          toast('Your details are saved.', 'ok');
        } catch (error) {
          ctx.fail(error, alert);
        }
      },
      'Saving…'
    );
  });
  return h('div', { class: 'stack' }, PageHeader({ eyebrow: 'My account', title: 'My details', lead: 'Keep your contact and delivery details up to date so each order request is quick to send.' }), form);
}
