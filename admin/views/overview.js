// Overview: key numbers, the order pipeline, and the latest order requests.
import { api } from '/dashboard/core/api.js';
import { h } from '/dashboard/core/dom.js';
import { STATUS_LABELS, money, when } from '/dashboard/core/format.js';
import { Button, Card, DataTable, EmptyState, PageHeader, Stat, StatusBadge } from '/dashboard/ui/index.js';

const PIPELINE = [
  ['requested', 'seg-warn'],
  ['confirmed', 'seg-info'],
  ['packed', 'seg-violet'],
  ['shipped', 'seg-teal'],
  ['delivered', 'seg-ok'],
  ['cancelled', 'seg-bad'],
];

export async function overviewView(ctx) {
  const s = await api('GET', '/api/admin/summary');
  const by = s.ordersByStatus || {};
  const count = (key) => Number(by[key]) || 0;

  const stats = h(
    'div',
    { class: 'grid-stats grid-stats--4' },
    Stat({ label: 'New requests', value: count('requested'), icon: 'bag', tone: 'gold' }),
    Stat({ label: 'Confirmed', value: count('confirmed'), icon: 'check', tone: 'info' }),
    Stat({ label: 'Packed', value: count('packed'), icon: 'box', tone: 'violet' }),
    Stat({ label: 'Shipped', value: count('shipped'), icon: 'truck', tone: 'teal' }),
    Stat({ label: 'Open order value', value: s.openOrderValueCents, format: (n) => money(n), icon: 'activity', tone: 'ok' }),
    Stat({ label: 'Delivered', value: count('delivered'), icon: 'check', tone: 'ok' }),
    Stat({ label: 'Customers', value: s.customers, icon: 'users', tone: 'info' }),
    Stat({ label: 'Visible products', value: s.activeProducts, icon: 'grid', tone: 'gold' })
  );

  const total = PIPELINE.reduce((sum, [key]) => sum + count(key), 0);
  const bar = h('div', { class: 'pipeline', role: 'img', 'aria-label': 'Orders by status' });
  PIPELINE.filter(([key]) => count(key) > 0).forEach(([key, seg], i) => {
    const part = h('span', { class: `pipeline__seg ${seg}` });
    part.style.setProperty('--w', String(count(key)));
    part.style.setProperty('--i', String(i));
    bar.append(part);
  });
  const legend = h(
    'ul',
    { class: 'legend' },
    PIPELINE.map(([key, seg]) => {
      const li = h('li', { class: seg }, h('i'), `${STATUS_LABELS[key]} `, h('strong', { text: String(count(key)) }));
      return li;
    })
  );
  const pipeline = Card({ title: 'Order pipeline', subtitle: total ? `${total} order requests in total` : 'No order requests yet' }, bar, legend);

  const latest = s.recentOrders.length
    ? DataTable({
        caption: 'Latest order requests',
        columns: [
          { label: 'Order', className: 'nowrap', render: (o) => h('strong', { text: o.orderNo }) },
          { label: 'Customer', render: (o) => (o.customer ? o.customer.name : '') },
          { label: 'Placed', className: 'nowrap', render: (o) => when(o.createdAt) },
          { label: 'Status', render: (o) => StatusBadge(o.status) },
          { label: 'Total', align: 'end', render: (o) => money(o.totalCents, o.currency) },
          { label: 'Open', srOnly: true, render: (o) => Button({ label: 'Open', variant: 'ghost', size: 'sm', 'aria-label': `Open order ${o.orderNo}`, onClick: () => ctx.go('orders', o.id) }) },
        ],
        rows: s.recentOrders,
        onRowOpen: (o) => ctx.go('orders', o.id),
      })
    : EmptyState({ icon: 'bag', title: 'No order requests yet', text: 'No order requests yet. They will appear here as soon as a customer sends one.' });

  return h(
    'div',
    { class: 'stack' },
    PageHeader({ eyebrow: 'Store admin', title: 'Overview', lead: 'What needs attention today.' }),
    stats,
    pipeline,
    Card({ title: 'Latest order requests', class: 'card--flush' }, latest)
  );
}
