// Orders: filter the list, open an order, move it along the flow, keep an internal note.
import { api } from '/dashboard/core/api.js';
import { clear, h, prefersReducedMotion } from '/dashboard/core/dom.js';
import { setHash } from '/dashboard/core/router.js';
import { ORDER_FLOW, STATUS_LABELS, STEP_LABELS, joinAddress, money, when } from '/dashboard/core/format.js';
import { Alert, Button, Card, DataTable, DescriptionList, EmptyState, Field, Notice, PageHeader, Stepper, StatusBadge, confirmDialog, toast, withBusy } from '/dashboard/ui/index.js';

export async function ordersView(ctx, openId = '') {
  const filter = Field({ label: 'Show', tag: 'select', options: [['', 'All orders'], ...Object.entries(STATUS_LABELS)] });
  const listBox = h('div');
  const detailBox = h('div', { id: 'order-detail' });

  async function refreshList() {
    const query = filter.input.value ? `?status=${encodeURIComponent(filter.input.value)}` : '';
    try {
      const { orders } = await api('GET', `/api/admin/orders${query}`);
      clear(listBox);
      listBox.append(
        orders.length
          ? DataTable({
              caption: 'Orders',
              columns: [
                { label: 'Order', className: 'nowrap', render: (o) => h('strong', { text: o.orderNo }) },
                { label: 'Customer', render: (o) => (o.customer ? h('span', { class: 'who' }, o.customer.name, h('small', { text: o.customer.email })) : '') },
                { label: 'Placed', className: 'nowrap', render: (o) => when(o.createdAt) },
                { label: 'Status', render: (o) => StatusBadge(o.status) },
                { label: 'Total', align: 'end', render: (o) => money(o.totalCents, o.currency) },
                { label: 'Open', srOnly: true, render: (o) => Button({ label: 'Open', variant: 'ghost', size: 'sm', 'aria-label': `Open order ${o.orderNo}`, onClick: () => openOrder(o.id) }) },
              ],
              rows: orders,
              onRowOpen: (o) => openOrder(o.id),
            })
          : EmptyState({ icon: 'bag', title: 'Nothing here', text: filter.input.value ? 'No orders with this status.' : 'No order requests yet.' })
      );
    } catch (error) {
      ctx.fail(error);
    }
  }

  async function openOrder(id) {
    try {
      const data = await api('GET', `/api/admin/orders/${id}`);
      renderOrder(data);
      setHash('orders', id);
      const behavior = prefersReducedMotion() ? 'auto' : 'smooth';
      detailBox.scrollIntoView({ behavior, block: 'start' });
      detailBox.querySelector('h2')?.focus({ preventScroll: true });
    } catch (error) {
      ctx.fail(error);
    }
  }

  function renderOrder({ order, nextStatuses }) {
    const c = order.contact || {};
    const alert = Alert();
    const note = Field({ label: 'Internal note (customers never see this)', tag: 'textarea', maxlength: 1000, value: order.adminNote || '' });
    const saveNote = Button({ label: 'Save note', variant: 'ghost', size: 'sm', icon: 'check' });
    saveNote.addEventListener('click', () =>
      withBusy(saveNote, async () => {
        try {
          renderOrder(await api('PATCH', `/api/admin/orders/${order.id}`, { adminNote: note.input.value }));
          toast('Note saved.', 'ok');
        } catch (error) {
          ctx.fail(error, alert);
        }
      })
    );

    const actions = h('div', { class: 'form-actions' });
    for (const next of nextStatuses) {
      const danger = next === 'cancelled';
      const button = Button({ label: danger ? 'Cancel order' : `Mark as ${STATUS_LABELS[next]}`, variant: danger ? 'danger' : 'primary', size: 'sm' });
      button.addEventListener('click', async () => {
        if (danger) {
          const yes = await confirmDialog({
            title: 'Cancel this order?',
            body: `Order ${order.orderNo} will be marked as cancelled and the customer will see that. This cannot be undone.`,
            confirmLabel: 'Yes, cancel this order',
            cancelLabel: 'Keep the order',
          });
          if (!yes) return;
        }
        await withBusy(button, async () => {
          try {
            renderOrder(await api('PATCH', `/api/admin/orders/${order.id}`, { status: next }));
            toast(`Order ${order.orderNo} is now ${STATUS_LABELS[next].toLowerCase()}.`, 'ok');
            refreshList();
          } catch (error) {
            ctx.fail(error, alert);
          }
        });
      });
      actions.append(button);
    }
    if (!nextStatuses.length) actions.append(Notice({ kind: 'info', text: 'This order is finished. No further changes are possible.' }));

    const items = h(
      'table',
      { class: 'items' },
      h('caption', { class: 'sr-only', text: `Items in ${order.orderNo}` }),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Item' }), h('th', { scope: 'col', class: 'num', text: 'Unit price' }), h('th', { scope: 'col', class: 'num', text: 'Qty' }), h('th', { scope: 'col', class: 'num', text: 'Line total' }))),
      h('tbody', {}, order.items.map((i) => h('tr', {}, h('td', { text: i.name }), h('td', { class: 'num', text: money(i.unitCents, order.currency) }), h('td', { class: 'num', text: String(i.qty) }), h('td', { class: 'num', text: money(i.lineCents, order.currency) })))),
      h('tfoot', {}, h('tr', {}, h('th', { scope: 'row', colspan: '3', text: 'Total' }), h('td', { class: 'num', text: money(order.totalCents, order.currency) })))
    );

    clear(detailBox);
    detailBox.append(
      Card(
        { title: `Order ${order.orderNo}`, subtitle: `Placed ${when(order.createdAt)}`, actions: [StatusBadge(order.status), Button({ variant: 'quiet', size: 'sm', icon: 'x', 'aria-label': 'Close order', onClick: () => { clear(detailBox); setHash('orders'); } })], tone: 'strong', class: 'detail-card' },
        h(
          'div',
          { class: 'stack' },
          order.status === 'cancelled' ? Notice({ kind: 'error', text: 'This order was cancelled.' }) : Stepper({ steps: ORDER_FLOW.map((id) => ({ id, label: STEP_LABELS[id] })), current: order.status }),
          h(
            'div',
            { class: 'grid-2' },
            DescriptionList([
              ['Customer', order.customer ? `${order.customer.name} (${order.customer.email})` : ''],
              ['Deliver to', [c.name, joinAddress(c)].filter(Boolean).join(', ')],
              ['Phone', c.phone],
              ['Customer note', order.note],
            ]),
            items
          ),
          alert.el,
          actions,
          h('div', { class: 'form' }, note.el, h('div', { class: 'form-actions' }, saveNote))
        )
      )
    );
  }

  filter.input.addEventListener('change', refreshList);
  await refreshList();
  if (openId) await openOrder(openId);

  return h(
    'div',
    { class: 'stack' },
    PageHeader({ eyebrow: 'Store admin', title: 'Orders', lead: 'Open an order to see what to pack and where to send it, then move it along.', actions: filter.el }),
    Card({ title: 'Order requests', class: 'card--flush' }, listBox),
    detailBox
  );
}
