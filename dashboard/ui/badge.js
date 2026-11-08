// Small coloured pills for order status, stock, and account state.
import { cx, h } from '../core/dom.js';
import { STATUS_LABELS, STOCK_LABELS } from '../core/format.js';

const STATUS_KIND = { requested: 'warn', confirmed: 'info', packed: 'violet', shipped: 'teal', delivered: 'ok', cancelled: 'bad' };
const STOCK_KIND = { in_stock: 'ok', low_stock: 'warn', out_of_stock: 'bad' };

/** Badge({ kind: ok | warn | bad | info | violet | teal | neutral, text, dot }) */
export function Badge({ kind = 'neutral', text, dot = true, class: extra }) {
  return h('span', { class: cx('badge', `badge--${kind}`, extra) }, dot ? h('span', { class: 'badge__dot', 'aria-hidden': 'true' }) : null, text);
}

/** The status of an order. A waiting request has a softly pulsing dot. */
export const StatusBadge = (status) => Badge({ kind: STATUS_KIND[status] || 'neutral', text: STATUS_LABELS[status] || status, class: `status-${status}` });
export const StockBadge = (stock) => Badge({ kind: STOCK_KIND[stock] || 'neutral', text: STOCK_LABELS[stock] || stock });
export const YesNoBadge = (yes, yesText = 'Yes', noText = 'Hidden') => Badge({ kind: yes ? 'ok' : 'warn', text: yes ? yesText : noText });
export const AccountBadge = (status) => Badge({ kind: status === 'active' ? 'ok' : 'bad', text: status === 'active' ? 'Active' : 'Disabled' });
