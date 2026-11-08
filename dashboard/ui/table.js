// Responsive data table. On a wide screen it is a normal table; on a phone each row becomes a
// labelled card (the label text comes from data-label, so nothing is lost).
import { cx, h } from '../core/dom.js';

/**
 * DataTable({ caption, columns, rows, onRowOpen })
 * columns: [{ label, key?, render?(row) -> Node|string, align?: 'end', srOnly?: true, className? }]
 * onRowOpen(row): makes the whole row tappable. On a phone the row's own Open / Edit button is then
 * hidden from view (it stays for keyboard and screen-reader users), so buttons are not repeated.
 */
export function DataTable({ caption, columns, rows, onRowOpen }) {
  const head = h(
    'tr',
    {},
    columns.map((c) => h('th', { scope: 'col', class: cx(c.align === 'end' && 'is-end', c.className) }, c.srOnly ? h('span', { class: 'sr-only', text: c.label }) : c.label))
  );
  const body = rows.map((row, index) => {
    const tr = h('tr', { class: cx('reveal', onRowOpen && 'is-openable') });
    tr.style.setProperty('--i', String(Math.min(index, 10)));
    if (onRowOpen) {
      tr.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, select, textarea')) return; // those do their own thing
        onRowOpen(row);
      });
    }
    for (const c of columns) {
      const content = c.render ? c.render(row) : row[c.key];
      tr.append(h('td', { 'data-label': c.srOnly ? null : c.label, class: cx(c.align === 'end' && 'is-end', c.srOnly && 'is-action', c.className) }, content ?? ''));
    }
    return tr;
  });
  return h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, caption ? h('caption', { class: 'sr-only', text: caption }) : null, h('thead', {}, head), h('tbody', {}, body)));
}
