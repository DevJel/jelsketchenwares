// Activity: the latest sign-ins and changes, newest first.
import { api } from '/dashboard/core/api.js';
import { h } from '/dashboard/core/dom.js';
import { when } from '/dashboard/core/format.js';
import { Card, DataTable, EmptyState, PageHeader } from '/dashboard/ui/index.js';

export async function activityView() {
  const { entries } = await api('GET', '/api/admin/audit');
  const table = entries.length
    ? DataTable({
        caption: 'Recent activity',
        columns: [
          { label: 'When', className: 'nowrap', render: (e) => when(e.at) },
          { label: 'Who', key: 'actor' },
          { label: 'What', render: (e) => h('code', { class: 'chip chip--mono', text: e.action }) },
          { label: 'Item', render: (e) => e.target || '' },
          { label: 'Details', render: (e) => e.detail || '' },
        ],
        rows: entries,
      })
    : EmptyState({ icon: 'activity', title: 'Nothing has happened yet', text: 'Sign-ins and changes will be listed here.' });
  return h('div', { class: 'stack' }, PageHeader({ eyebrow: 'Store admin', title: 'Activity', lead: 'The latest 100 sign-ins and changes.' }), Card({ title: 'Recent activity', class: 'card--flush' }, table));
}
