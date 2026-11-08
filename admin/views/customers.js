// Customers: see who has an account, their orders, disable an account, reset a password.
import { api } from '/dashboard/core/api.js';
import { clear, h, prefersReducedMotion } from '/dashboard/core/dom.js';
import { setHash } from '/dashboard/core/router.js';
import { day, joinAddress, money, when } from '/dashboard/core/format.js';
import { AccountBadge, Alert, Button, Card, DataTable, DescriptionList, EmptyState, Notice, PageHeader, StatusBadge, confirmDialog, toast, withBusy } from '/dashboard/ui/index.js';

export async function customersView(ctx, openId = '') {
  const { customers } = await api('GET', '/api/admin/customers');
  const detailBox = h('div', { id: 'customer-detail' });

  async function openCustomer(id) {
    let data;
    try {
      data = await api('GET', `/api/admin/customers/${id}`);
    } catch (error) {
      return ctx.fail(error);
    }
    const { customer, orders } = data;
    const alert = Alert();
    const secretBox = h('div', { class: 'stack--tight' });
    const active = customer.status === 'active';

    const toggle = Button({ label: active ? 'Disable account' : 'Enable account', variant: active ? 'danger' : 'ghost', size: 'sm', icon: active ? 'lock' : 'check' });
    toggle.addEventListener('click', async () => {
      if (active) {
        const yes = await confirmDialog({
          title: `Disable ${customer.name}'s account?`,
          body: 'They will be signed out on every device and cannot sign in until you enable the account again. Their order history is kept.',
          confirmLabel: 'Disable account',
          cancelLabel: 'Keep it active',
        });
        if (!yes) return;
      }
      await withBusy(toggle, async () => {
        try {
          await api('PATCH', `/api/admin/customers/${id}`, { status: active ? 'disabled' : 'active' });
          toast(active ? `${customer.name}'s account is disabled.` : `${customer.name}'s account is active again.`, 'ok');
          openCustomer(id);
        } catch (error) {
          ctx.fail(error, alert);
        }
      });
    });

    const reset = Button({ label: 'Reset password', variant: 'ghost', size: 'sm', icon: 'lock' });
    reset.addEventListener('click', async () => {
      const yes = await confirmDialog({
        title: 'Create a temporary password?',
        body: 'Their current password stops working and they are signed out on every device. You will see the temporary password once, to give to them privately.',
        confirmLabel: 'Create temporary password',
        cancelLabel: 'Go back',
        tone: 'primary',
      });
      if (!yes) return;
      await withBusy(reset, async () => {
        try {
          const result = await api('POST', `/api/admin/customers/${id}/reset-password`, {});
          const code = h('div', { class: 'secret', text: result.temporaryPassword });
          const copy = Button({ label: 'Copy', variant: 'ghost', size: 'sm', icon: 'copy' });
          copy.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(result.temporaryPassword);
              toast('Temporary password copied.', 'ok');
            } catch {
              toast('Could not copy. Select the password and copy it by hand.', 'error');
            }
          });
          clear(secretBox);
          secretBox.append(Notice({ kind: 'ok', text: 'Temporary password created. It is shown only now. Give it to the customer privately; they must choose their own when they sign in. All their devices were signed out.' }), h('div', { class: 'secret-row' }, code, copy));
        } catch (error) {
          ctx.fail(error, alert);
        }
      });
    });

    const orderList = orders.length
      ? h(
          'ul',
          { class: 'list' },
          orders.map((o) =>
            h(
              'li',
              { class: 'cluster cluster--between' },
              h('span', { class: 'cluster' }, h('strong', { text: o.orderNo }), h('span', { class: 'muted', text: money(o.totalCents, o.currency) }), StatusBadge(o.status)),
              Button({ label: 'Open', variant: 'ghost', size: 'sm', 'aria-label': `Open order ${o.orderNo}`, onClick: () => ctx.go('orders', o.id) })
            )
          )
        )
      : h('p', { class: 'muted', text: 'No order requests yet.' });

    clear(detailBox);
    detailBox.append(
      Card(
        { title: customer.name, subtitle: customer.email, actions: [AccountBadge(customer.status), Button({ variant: 'quiet', size: 'sm', icon: 'x', 'aria-label': 'Close customer', onClick: () => { clear(detailBox); setHash('customers'); } })], tone: 'strong' },
        h(
          'div',
          { class: 'stack' },
          DescriptionList([
            ['Email', customer.email],
            ['Phone', customer.phone || 'Not given'],
            ['Address', joinAddress(customer.address || {}) || 'Not given'],
            ['Joined', when(customer.createdAt)],
            ['Last sign-in', customer.lastLoginAt ? when(customer.lastLoginAt) : 'Never'],
          ]),
          alert.el,
          h('div', { class: 'form-actions' }, toggle, reset),
          secretBox,
          h('div', { class: 'stack--tight' }, h('h3', { text: 'Order requests' }), orderList)
        )
      )
    );
    setHash('customers', id);
    detailBox.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    detailBox.querySelector('h2')?.setAttribute('tabindex', '-1');
    detailBox.querySelector('h2')?.focus({ preventScroll: true });
  }

  const table = customers.length
    ? DataTable({
        caption: 'Customers',
        columns: [
          { label: 'Customer', className: 'nowrap', render: (c) => h('span', { class: 'who' }, h('strong', { text: c.name }), h('small', { text: c.email })) },
          { label: 'Orders', render: (c) => String(c.orderCount) },
          { label: 'Joined', className: 'nowrap', render: (c) => day(c.createdAt) },
          { label: 'Last sign-in', className: 'nowrap', render: (c) => (c.lastLoginAt ? when(c.lastLoginAt) : 'Never') },
          { label: 'Status', render: (c) => AccountBadge(c.status) },
          { label: 'Open', srOnly: true, render: (c) => Button({ label: 'Open', variant: 'ghost', size: 'sm', 'aria-label': `Open ${c.name}`, onClick: () => openCustomer(c.id) }) },
        ],
        rows: customers,
        onRowOpen: (c) => openCustomer(c.id),
      })
    : EmptyState({ icon: 'users', title: 'No customers yet', text: 'No customers have created an account yet.' });

  if (openId) await openCustomer(openId);
  return h('div', { class: 'stack' }, PageHeader({ eyebrow: 'Store admin', title: 'Customers', lead: 'People who have created an account to send order requests.' }), Card({ title: 'All customers', class: 'card--flush' }, table), detailBox);
}
