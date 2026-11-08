// Customer account API: register, sign in, profile, password, order requests.
import {
  assertNotLocked,
  clearFailures,
  createSession,
  destroySession,
  recordFailure,
  requireCustomer,
} from './auth.js';
import { dummyPasswordWork, hashPassword, verifyPassword } from './crypto.js';
import { HttpError, clearCookie, COOKIE_NAMES, json, setCookie } from './http.js';
import { CURRENCY, customerOrder, newOrderNo, nowIso, parseJson, publicCustomer, publicProduct } from './store.js';
import * as v from './validate.js';

const MAX_OPEN_REQUESTS = 10;

function readAddress(input, { required }) {
  const a = input && typeof input === 'object' ? input : {};
  const need = required ? 1 : 0;
  return {
    line1: v.text(a.line1, { field: 'Address line 1', min: need, max: 150 }),
    line2: v.text(a.line2, { field: 'Address line 2', max: 150 }),
    city: v.text(a.city, { field: 'City', min: need, max: 80 }),
    region: v.text(a.region, { field: 'State or region', max: 80 }),
    postcode: v.text(a.postcode, { field: 'Postcode', min: need, max: 20 }),
    country: v.text(a.country, { field: 'Country', min: need, max: 60 }),
  };
}

async function startSession(ctx, customerId) {
  const { token, maxAge, name } = await createSession(ctx.env, 'customer', customerId);
  return [setCookie(name, token, maxAge)];
}

export const customerRoutes = [
  ['GET', '/api/products', async (ctx) => {
    const { results } = await ctx.env.DB.prepare(
      'SELECT * FROM products WHERE active = 1 ORDER BY category, name'
    ).all();
    return json({ currency: CURRENCY, products: results.map(publicProduct) });
  }],

  ['POST', '/api/customer/register', async (ctx) => {
    const body = await ctx.body();
    const ipKey = `reg:${ctx.ip}`;
    await assertNotLocked(ctx.env, [ipKey]);
    await recordFailure(ctx.env, ipKey, { limit: 10, windowSeconds: 3600, lockSeconds: 3600 });
    const name = v.text(body.name, { field: 'Name', min: 1, max: 100 });
    const email = v.email(body.email);
    const password = v.password(body.password, { forbid: [email, name, email.split('@')[0]] });
    const exists = await ctx.env.DB.prepare('SELECT id FROM customers WHERE email = ?').bind(email).first();
    if (exists) throw new HttpError(409, 'An account with this email already exists. Try signing in.');
    const { hash, salt } = await hashPassword(password);
    const now = nowIso();
    const row = await ctx.env.DB.prepare(
      'INSERT INTO customers (email, name, password_hash, password_salt, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(email, name, hash, salt, now, now)
      .run();
    const id = row.meta.last_row_id;
    const customer = await ctx.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
    return json({ customer: publicCustomer(customer) }, 201, { cookies: await startSession(ctx, id) });
  }],

  ['POST', '/api/customer/login', async (ctx) => {
    const body = await ctx.body();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    const emailKey = `cust:${email}`;
    const ipKey = `ip:cust:${ctx.ip}`;
    await assertNotLocked(ctx.env, [emailKey, ipKey]);
    const row = email ? await ctx.env.DB.prepare('SELECT * FROM customers WHERE email = ?').bind(email).first() : null;
    let ok = false;
    if (row && row.status === 'active') ok = await verifyPassword(password, row.password_salt, row.password_hash);
    else await dummyPasswordWork(password);
    if (!ok) {
      await recordFailure(ctx.env, emailKey, { limit: 5 });
      await recordFailure(ctx.env, ipKey, { limit: 30 });
      throw new HttpError(401, 'Email or password is incorrect.');
    }
    await clearFailures(ctx.env, emailKey);
    await ctx.env.DB.prepare('UPDATE customers SET last_login_at = ? WHERE id = ?').bind(nowIso(), row.id).run();
    return json({ customer: publicCustomer(row) }, 200, { cookies: await startSession(ctx, row.id) });
  }],

  ['POST', '/api/customer/logout', async (ctx) => {
    await destroySession(ctx.env, ctx.request, 'customer');
    return json({ ok: true }, 200, { cookies: [clearCookie(COOKIE_NAMES.customer)] });
  }],

  ['GET', '/api/customer/me', async (ctx) => {
    const { customer } = await requireCustomer(ctx, { allowMustChange: true });
    return json({ customer: publicCustomer(customer) });
  }],

  ['PATCH', '/api/customer/me', async (ctx) => {
    const { customer } = await requireCustomer(ctx);
    const body = await ctx.body();
    const name = body.name === undefined ? customer.name : v.text(body.name, { field: 'Name', min: 1, max: 100 });
    const phone = body.phone === undefined ? customer.phone : v.text(body.phone, { field: 'Phone', max: 30 });
    const address = body.address === undefined ? parseJson(customer.address_json, {}) : readAddress(body.address, { required: false });
    await ctx.env.DB.prepare('UPDATE customers SET name = ?, phone = ?, address_json = ? WHERE id = ?')
      .bind(name, phone, JSON.stringify(address), customer.id)
      .run();
    const fresh = await ctx.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(customer.id).first();
    return json({ customer: publicCustomer(fresh) });
  }],

  ['POST', '/api/customer/password', async (ctx) => {
    const { customer, session } = await requireCustomer(ctx, { allowMustChange: true });
    const body = await ctx.body();
    const row = await ctx.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(customer.id).first();
    const emailKey = `pw:${customer.id}`;
    await assertNotLocked(ctx.env, [emailKey]);
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!(await verifyPassword(current, row.password_salt, row.password_hash))) {
      await recordFailure(ctx.env, emailKey, { limit: 5 });
      throw new HttpError(403, 'Your current password is incorrect.');
    }
    const next = v.password(body.newPassword, { field: 'New password', forbid: [row.email, row.name, row.email.split('@')[0], current] });
    const { hash, salt } = await hashPassword(next);
    await ctx.env.DB.batch([
      ctx.env.DB.prepare('UPDATE customers SET password_hash = ?, password_salt = ?, must_change_password = 0 WHERE id = ?').bind(hash, salt, customer.id),
      // Sign out every other device.
      ctx.env.DB.prepare('DELETE FROM sessions WHERE customer_id = ? AND token_hash != ?').bind(customer.id, session.token_hash),
    ]);
    await clearFailures(ctx.env, emailKey);
    return json({ ok: true });
  }],

  ['GET', '/api/customer/orders', async (ctx) => {
    const { customer } = await requireCustomer(ctx);
    const { results } = await ctx.env.DB.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 200')
      .bind(customer.id)
      .all();
    return json({ orders: results.map(customerOrder) });
  }],

  ['POST', '/api/customer/orders', async (ctx) => {
    const { customer } = await requireCustomer(ctx);
    const body = await ctx.body();
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
      throw new HttpError(422, 'Choose between 1 and 20 products.');
    }
    // Merge repeated products and read quantities as whole numbers.
    const quantities = new Map();
    for (const item of body.items) {
      const productId = v.integer(item?.productId, { field: 'Product', min: 1, max: 1e9 });
      const qty = v.integer(item?.qty, { field: 'Quantity', min: 1, max: 20 });
      quantities.set(productId, Math.min(20, (quantities.get(productId) || 0) + qty));
    }
    const contact = {
      name: v.text(body.contact?.name, { field: 'Delivery name', min: 1, max: 100 }),
      phone: v.text(body.contact?.phone, { field: 'Phone', min: 5, max: 30 }),
      ...readAddress(body.contact, { required: true }),
    };
    const note = v.text(body.note, { field: 'Note', max: 500 });

    const open = await ctx.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM orders WHERE customer_id = ? AND status = 'requested'"
    )
      .bind(customer.id)
      .first();
    if (open.n >= MAX_OPEN_REQUESTS) {
      throw new HttpError(429, 'You have several order requests waiting. Please wait for the store to respond.');
    }

    // Prices always come from the database, never from the browser.
    const ids = [...quantities.keys()];
    const { results } = await ctx.env.DB.prepare(
      `SELECT * FROM products WHERE active = 1 AND stock_status != 'out_of_stock' AND id IN (${ids.map(() => '?').join(',')})`
    )
      .bind(...ids)
      .all();
    if (results.length !== ids.length) throw new HttpError(422, 'One of the products is not available. Refresh and try again.');
    const items = results.map((p) => ({
      productId: p.id,
      name: p.name,
      unitCents: p.price_cents,
      qty: quantities.get(p.id),
      lineCents: p.price_cents * quantities.get(p.id),
    }));
    const total = items.reduce((sum, line) => sum + line.lineCents, 0);

    const now = nowIso();
    let orderId = null;
    let orderNo = '';
    for (let attempt = 0; attempt < 5 && orderId === null; attempt += 1) {
      orderNo = newOrderNo();
      try {
        const row = await ctx.env.DB.prepare(
          `INSERT INTO orders (order_no, customer_id, status, items_json, total_cents, currency, contact_json, note, created_at, updated_at)
           VALUES (?, ?, 'requested', ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(orderNo, customer.id, JSON.stringify(items), total, CURRENCY, JSON.stringify(contact), note, now, now)
          .run();
        orderId = row.meta.last_row_id;
      } catch (error) {
        if (!/unique/i.test(String(error?.message))) throw error;
      }
    }
    if (orderId === null) throw new HttpError(503, 'Could not place the request. Please try again.');
    const order = await ctx.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    return json({ order: customerOrder(order) }, 201);
  }],

  ['GET', '/api/customer/orders/:id', async (ctx) => {
    const { customer } = await requireCustomer(ctx);
    const order = await ctx.env.DB.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?')
      .bind(Number(ctx.params.id) || 0, customer.id)
      .first();
    if (!order) throw new HttpError(404, 'Order not found.');
    return json({ order: customerOrder(order) });
  }],

  ['POST', '/api/customer/orders/:id/cancel', async (ctx) => {
    const { customer } = await requireCustomer(ctx);
    const id = Number(ctx.params.id) || 0;
    const result = await ctx.env.DB.prepare(
      "UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND customer_id = ? AND status = 'requested'"
    )
      .bind(nowIso(), id, customer.id)
      .run();
    if (!result.meta.changes) {
      const exists = await ctx.env.DB.prepare('SELECT status FROM orders WHERE id = ? AND customer_id = ?').bind(id, customer.id).first();
      if (!exists) throw new HttpError(404, 'Order not found.');
      throw new HttpError(409, 'This order has already been confirmed. Please contact the store to change it.');
    }
    const order = await ctx.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
    return json({ order: customerOrder(order) });
  }],
];
