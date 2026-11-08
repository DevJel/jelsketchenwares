// Formatting and wording shared by both dashboards.

export function money(cents, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((Number(cents) || 0) / 100);
}

export function when(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function day(iso) {
  const date = new Date(iso);
  if (!iso || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export const STATUS_LABELS = {
  requested: 'Waiting for the store',
  confirmed: 'Confirmed',
  packed: 'Packed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/** Short wording for the progress steps, where space is tight on a phone. */
export const STEP_LABELS = { requested: 'Requested', confirmed: 'Confirmed', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered' };

/** The order of a normal order. A request can also be cancelled until it ships. */
export const ORDER_FLOW = ['requested', 'confirmed', 'packed', 'shipped', 'delivered'];

export const STOCK_LABELS = { in_stock: 'In stock', low_stock: 'Low stock', out_of_stock: 'Out of stock' };

/** "Aisha Rahman" -> "AR" */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Joins the filled-in parts of an address with commas. */
export const joinAddress = (a = {}) => [a.line1, a.line2, a.city, a.region, a.postcode, a.country].filter(Boolean).join(', ');

/** "49", "$49.90" -> 4990. Returns null when the text is not a price. */
export function toCents(text) {
  const clean = String(text).trim().replace(/^\$/, '');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}
