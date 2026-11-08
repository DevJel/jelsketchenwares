// Products: what customers can choose when they request an order, and the prices those requests use.
import { api } from '/dashboard/core/api.js';
import { clear, h } from '/dashboard/core/dom.js';
import { STOCK_LABELS, money, toCents } from '/dashboard/core/format.js';
import { Alert, Button, Card, Checkbox, DataTable, EmptyState, Field, Notice, PageHeader, StockBadge, YesNoBadge, toast, withBusy } from '/dashboard/ui/index.js';

export async function productsView(ctx) {
  const { products } = await api('GET', '/api/admin/products');
  const formBox = h('div', { id: 'product-form' });

  function showForm(product) {
    const isNew = !product;
    const alert = Alert();
    const name = Field({ label: 'Name', type: 'text', required: true, maxlength: 120, value: product?.name || '' });
    const category = Field({ label: 'Category', type: 'text', maxlength: 60, value: product?.category || '' });
    const description = Field({ label: 'Description', tag: 'textarea', maxlength: 500, value: product?.description || '', class: 'span-2' });
    const price = Field({ label: 'Price (US dollars)', type: 'text', inputmode: 'decimal', required: true, value: product ? (product.priceCents / 100).toFixed(2) : '', hint: 'For example 49 or 49.90.' });
    const stock = Field({ label: 'Stock', tag: 'select', options: Object.entries(STOCK_LABELS), value: product?.stockStatus || 'in_stock' });
    const active = Checkbox({ label: 'Customers can choose this product', checked: product ? product.active : true });
    const submit = Button({ label: isNew ? 'Add product' : 'Save changes', type: 'submit', icon: 'check' });
    const close = () => clear(formBox);

    const form = h(
      'form',
      { class: 'form', novalidate: true },
      h('div', { class: 'form-grid' }, name.el, category.el, description.el, price.el, stock.el),
      active.el,
      alert.el,
      h('div', { class: 'form-actions' }, submit, Button({ label: 'Close', variant: 'ghost', onClick: close }))
    );
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      alert.hide();
      const cents = toCents(price.input.value);
      if (!name.input.value.trim()) return alert.show('Give the product a name.');
      if (cents === null) return alert.show('Enter the price as a number, like 49 or 49.90.');
      const payload = { name: name.input.value, category: category.input.value, description: description.input.value, priceCents: cents, stockStatus: stock.input.value, active: active.input.checked };
      return withBusy(
        submit,
        async () => {
          try {
            if (isNew) await api('POST', '/api/admin/products', payload);
            else await api('PATCH', `/api/admin/products/${product.id}`, payload);
            toast(isNew ? `${payload.name} was added.` : `${payload.name} was saved.`, 'ok');
            ctx.go('products');
          } catch (error) {
            ctx.fail(error, alert);
          }
        },
        'Saving…'
      );
    });

    clear(formBox);
    const card = Card({ title: isNew ? 'Add a product' : `Edit ${product.name}`, tone: 'strong' }, form);
    card.classList.add('reveal');
    formBox.append(card);
    card.scrollIntoView({ block: 'nearest' });
    name.input.focus();
  }

  const table = products.length
    ? DataTable({
        caption: 'Products',
        columns: [
          { label: 'Product', render: (p) => h('strong', { text: p.name }) },
          { label: 'Category', render: (p) => p.category || '' },
          { label: 'Price', align: 'end', render: (p) => money(p.priceCents) },
          { label: 'Stock', render: (p) => StockBadge(p.stockStatus) },
          { label: 'Visible', render: (p) => YesNoBadge(p.active) },
          { label: 'Edit', srOnly: true, render: (p) => Button({ label: 'Edit', variant: 'ghost', size: 'sm', icon: 'edit', 'aria-label': `Edit ${p.name}`, onClick: () => showForm(p) }) },
        ],
        rows: products,
        onRowOpen: (p) => showForm(p),
      })
    : EmptyState({ icon: 'box', title: 'No products yet', text: 'Add your first product so customers can request it.' });

  return h(
    'div',
    { class: 'stack' },
    PageHeader({ eyebrow: 'Store admin', title: 'Products', lead: 'The list customers choose from when they request an order.', actions: Button({ label: 'Add a product', icon: 'plus', onClick: () => showForm(null) }) }),
    Notice({ kind: 'info', text: 'These are the products customers can choose when they request an order, and the prices their requests use. The product pages on the public storefront are a separate built-in list and do not change when you edit here.' }),
    formBox,
    Card({ title: 'All products', class: 'card--flush' }, table)
  );
}
