// Shapes, constants and small helpers shared by the customer and admin APIs.

// Prices are in cents of this currency (the storefront shows US dollars).
export const CURRENCY = 'USD';

export const ORDER_FLOW = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export const ORDER_STATUSES = Object.keys(ORDER_FLOW);
export const OPEN_STATUSES = ['requested', 'confirmed', 'packed', 'shipped'];
export const STOCK_STATUSES = ['in_stock', 'low_stock', 'out_of_stock'];

export const nowIso = () => new Date().toISOString();

export function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export const publicCustomer = (c) => ({
  id: c.id,
  email: c.email,
  name: c.name,
  phone: c.phone,
  address: parseJson(c.address_json, {}),
  mustChangePassword: Boolean(c.must_change_password),
  status: c.status,
  createdAt: c.created_at,
});

export const publicProduct = (p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  category: p.category,
  priceCents: p.price_cents,
  stockStatus: p.stock_status,
  active: Boolean(p.active),
});

/** What a customer sees of their own order. The internal admin note is never included. */
export const customerOrder = (o) => ({
  id: o.id,
  orderNo: o.order_no,
  status: o.status,
  items: parseJson(o.items_json, []),
  totalCents: o.total_cents,
  currency: o.currency,
  contact: parseJson(o.contact_json, {}),
  note: o.note,
  createdAt: o.created_at,
  updatedAt: o.updated_at,
});

export const adminOrder = (o) => ({
  ...customerOrder(o),
  adminNote: o.admin_note,
  customer: o.customer_name === undefined ? undefined : { id: o.customer_id, name: o.customer_name, email: o.customer_email },
});

export async function audit(env, actor, action, target = '', detail = '') {
  await env.DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)')
    .bind(nowIso(), actor, action, String(target).slice(0, 100), String(detail).slice(0, 300))
    .run();
}

const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function newOrderNo() {
  const d = new Date();
  const ymd = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const rand = [...crypto.getRandomValues(new Uint8Array(4))].map((b) => ORDER_ALPHABET[b % ORDER_ALPHABET.length]).join('');
  return `JK-${ymd}-${rand}`;
}
