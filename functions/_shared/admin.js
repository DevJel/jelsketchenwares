// Admin API: sign-in (password + authenticator code), orders, customers, products, activity.
import {
  assertNotLocked,
  clearFailures,
  createSession,
  destroySession,
  recordFailure,
  requireAdmin,
} from './auth.js';
import { dummyPasswordWork, hashPassword, randomToken, safeEqual, verifyPassword, verifyTotp } from './crypto.js';
import { HttpError, clearCookie, COOKIE_NAMES, json, setCookie } from './http.js';
import {
  ORDER_FLOW,
  ORDER_STATUSES,
  OPEN_STATUSES,
  STOCK_STATUSES,
  adminOrder,
  audit,
  nowIso,
  publicCustomer,
  publicProduct,
} from './store.js';
import * as v from './validate.js';

const adminConfigured = (env) =>
  Boolean(env.ADMIN_EMAIL && env.ADMIN_PASSWORD_HASH && env.ADMIN_PASSWORD_SALT && env.ADMIN_TOTP_SECRET);

const ORDER_SELECT = `SELECT o.*, c.name AS customer_name, c.email AS customer_email
  FROM orders o JOIN customers c ON c.id = o.customer_id`;

export const adminRoutes = [
  ['POST', '/api/admin/login', async (ctx) => {
    const { env } = ctx;
    if (!adminConfigured(env)) throw new HttpError(503, 'Admin sign-in has not been set up yet.');
    const body = await ctx.body();
    const keys = ['admin:global', `admin:ip:${ctx.ip}`];
    await assertNotLocked(env, keys);

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : '';
    const password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
    // Every check always runs so the response time does not reveal which part was wrong.
    const emailOk = safeEqual(email, String(env.ADMIN_EMAIL).trim().toLowerCase());
    const passwordOk = await verifyPassword(password, env.ADMIN_PASSWORD_SALT, env.ADMIN_PASSWORD_HASH);
    if (!passwordOk) await dummyPasswordWork(password);
    const step = await verifyTotp(env.ADMIN_TOTP_SECRET, body.code);

    let ok = emailOk && passwordOk && step !== null;
    if (ok) {
      // A code works once. Only burn codes for requests that already had the right password.
      const used = await env.DB.prepare('SELECT counter FROM used_totp WHERE counter = ?').bind(step).first();
      if (used) ok = false;
      else {
        await env.DB.batch([
          env.DB.prepare('INSERT INTO used_totp (counter) VALUES (?)').bind(step),
          env.DB.prepare('DELETE FROM used_totp WHERE counter < ?').bind(step - 20),
        ]);
      }
    }
    if (!ok) {
      await recordFailure(env, keys[0], { limit: 5 });
      await recordFailure(env, keys[1], { limit: 10 });
      await audit(env, 'admin', 'login.failed', '', `ip ${ctx.ip}`);
      throw new HttpError(401, 'Those sign-in details are incorrect.');
    }
    await clearFailures(env, keys[0]);
    const { token, maxAge, name } = await createSession(env, 'admin');
    await audit(env, 'admin', 'login', '', `ip ${ctx.ip}`);
    return json({ admin: { email: String(env.ADMIN_EMAIL).trim().toLowerCase() } }, 200, { cookies: [setCookie(name, token, maxAge)] });
  }],

  ['POST', '/api/admin/logout', async (ctx) => {
    await destroySession(ctx.env, ctx.request, 'admin');
    return json({ ok: true }, 200, { cookies: [clearCookie(COOKIE_NAMES.admin)] });
  }],

  ['GET', '/api/admin/me', async (ctx) => {
    await requireAdmin(ctx);
    return json({ admin: { email: String(ctx.env.ADMIN_EMAIL).trim().toLowerCase() } });
  }],

  ['GET', '/api/admin/summary', async (ctx) => {
    await requireAdmin(ctx);
    const { DB } = ctx.env;
    const byStatus = {};
    for (const s of ORDER_STATUSES) byStatus[s] = 0;
    const { results } = await DB.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all();
    for (const row of results) byStatus[row.status] = row.n;
    const customers = await DB.prepare('SELECT COUNT(*) AS n FROM customers').first();
    const products = await DB.prepare('SELECT COUNT(*) AS n FROM products WHERE active = 1').first();
    const placeholders = OPEN_STATUSES.map(() => '?').join(',');
    const openValue = await DB.prepare(`SELECT COALESCE(SUM(total_cents), 0) AS n FROM orders WHERE status IN (${placeholders})`)
      .bind(...OPEN_STATUSES)
      .first();
    const recent = await DB.prepare(`${ORDER_SELECT} ORDER BY o.id DESC LIMIT 5`).all();
    return json({
      ordersByStatus: byStatus,
      customers: customers.n,
      activeProducts: products.n,
      openOrderValueCents: openValue.n,
      recentOrders: recent.results.map(adminOrder),
    });
  }],

  ['GET', '/api/admin/orders', async (ctx) => {
    await requireAdmin(ctx);
    const status = ctx.url.searchParams.get('status');
    if (status) v.oneOf(status, ORDER_STATUSES, 'Status');
    const sql = `${ORDER_SELECT} ${status ? 'WHERE o.status = ?' : ''} ORDER BY o.id DESC LIMIT 300`;
    const stmt = ctx.env.DB.prepare(sql);
    const { results } = await (status ? stmt.bind(status) : stmt).all();
    return json({ orders: results.map(adminOrder) });
  }],

  ['GET', '/api/admin/orders/:id', async (ctx) => {
    await requireAdmin(ctx);
    const order = await ctx.env.DB.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(Number(ctx.params.id) || 0).first();
    if (!order) throw new HttpError(404, 'Order not found.');
    return json({ order: adminOrder(order), nextStatuses: ORDER_FLOW[order.status] });
  }],

  ['PATCH', '/api/admin/orders/:id', async (ctx) => {
    await requireAdmin(ctx);
    const id = Number(ctx.params.id) || 0;
    const body = await ctx.body();
    const order = await ctx.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
    if (!order) throw new HttpError(404, 'Order not found.');
    let status = order.status;
    if (body.status !== undefined && body.status !== order.status) {
      v.oneOf(body.status, ORDER_STATUSES, 'Status');
      if (!ORDER_FLOW[order.status].includes(body.status)) {
        throw new HttpError(409, `An order that is ${order.status} cannot move to ${body.status}.`);
      }
      status = body.status;
    }
    const adminNote = body.adminNote === undefined ? order.admin_note : v.text(body.adminNote, { field: 'Note', max: 1000 });
    await ctx.env.DB.prepare('UPDATE orders SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?')
      .bind(status, adminNote, nowIso(), id)
      .run();
    if (status !== order.status) await audit(ctx.env, 'admin', 'order.status', order.order_no, `${order.status} -> ${status}`);
    else if (adminNote !== order.admin_note) await audit(ctx.env, 'admin', 'order.note', order.order_no);
    const fresh = await ctx.env.DB.prepare(`${ORDER_SELECT} WHERE o.id = ?`).bind(id).first();
    return json({ order: adminOrder(fresh), nextStatuses: ORDER_FLOW[fresh.status] });
  }],

  ['GET', '/api/admin/customers', async (ctx) => {
    await requireAdmin(ctx);
    const { results } = await ctx.env.DB.prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS order_count
       FROM customers c ORDER BY c.id DESC LIMIT 500`
    ).all();
    return json({
      customers: results.map((c) => ({ ...publicCustomer(c), orderCount: c.order_count, lastLoginAt: c.last_login_at })),
    });
  }],

  ['GET', '/api/admin/customers/:id', async (ctx) => {
    await requireAdmin(ctx);
    const id = Number(ctx.params.id) || 0;
    const customer = await ctx.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first();
    if (!customer) throw new HttpError(404, 'Customer not found.');
    const { results } = await ctx.env.DB.prepare(`${ORDER_SELECT} WHERE o.customer_id = ? ORDER BY o.id DESC LIMIT 100`).bind(id).all();
    return json({ customer: { ...publicCustomer(customer), lastLoginAt: customer.last_login_at }, orders: results.map(adminOrder) });
  }],

  ['PATCH', '/api/admin/customers/:id', async (ctx) => {
    await requireAdmin(ctx);
    const id = Number(ctx.params.id) || 0;
    const body = await ctx.body();
    const status = v.oneOf(body.status, ['active', 'disabled'], 'Status');
    const customer = await ctx.env.DB.prepare('SELECT id, email FROM customers WHERE id = ?').bind(id).first();
    if (!customer) throw new HttpError(404, 'Customer not found.');
    const statements = [ctx.env.DB.prepare('UPDATE customers SET status = ? WHERE id = ?').bind(status, id)];
    // A disabled customer is signed out everywhere straight away.
    if (status === 'disabled') statements.push(ctx.env.DB.prepare('DELETE FROM sessions WHERE customer_id = ?').bind(id));
    await ctx.env.DB.batch(statements);
    await audit(ctx.env, 'admin', `customer.${status}`, customer.email);
    return json({ ok: true, status });
  }],

  ['POST', '/api/admin/customers/:id/reset-password', async (ctx) => {
    await requireAdmin(ctx);
    const id = Number(ctx.params.id) || 0;
    const customer = await ctx.env.DB.prepare('SELECT id, email FROM customers WHERE id = ?').bind(id).first();
    if (!customer) throw new HttpError(404, 'Customer not found.');
    // The store has no email sender yet, so the admin passes this one-time password on directly.
    const temporaryPassword = randomToken(9);
    const { hash, salt } = await hashPassword(temporaryPassword);
    await ctx.env.DB.batch([
      ctx.env.DB.prepare('UPDATE customers SET password_hash = ?, password_salt = ?, must_change_password = 1 WHERE id = ?').bind(hash, salt, id),
      ctx.env.DB.prepare('DELETE FROM sessions WHERE customer_id = ?').bind(id),
    ]);
    await audit(ctx.env, 'admin', 'customer.password_reset', customer.email);
    return json({ temporaryPassword });
  }],

  ['GET', '/api/admin/products', async (ctx) => {
    await requireAdmin(ctx);
    const { results } = await ctx.env.DB.prepare('SELECT * FROM products ORDER BY active DESC, category, name').all();
    return json({ products: results.map(publicProduct) });
  }],

  ['POST', '/api/admin/products', async (ctx) => {
    await requireAdmin(ctx);
    const body = await ctx.body();
    const now = nowIso();
    const row = await ctx.env.DB.prepare(
      `INSERT INTO products (name, description, category, price_cents, stock_status, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        v.text(body.name, { field: 'Name', min: 1, max: 120 }),
        v.text(body.description, { field: 'Description', max: 500 }),
        v.text(body.category, { field: 'Category', max: 60 }),
        v.integer(body.priceCents, { field: 'Price', min: 0, max: 10000000 }),
        v.oneOf(body.stockStatus ?? 'in_stock', STOCK_STATUSES, 'Stock'),
        body.active === false ? 0 : 1,
        now,
        now
      )
      .run();
    const product = await ctx.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(row.meta.last_row_id).first();
    await audit(ctx.env, 'admin', 'product.create', product.name);
    return json({ product: publicProduct(product) }, 201);
  }],

  ['PATCH', '/api/admin/products/:id', async (ctx) => {
    await requireAdmin(ctx);
    const id = Number(ctx.params.id) || 0;
    const body = await ctx.body();
    const p = await ctx.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    if (!p) throw new HttpError(404, 'Product not found.');
    const next = {
      name: body.name === undefined ? p.name : v.text(body.name, { field: 'Name', min: 1, max: 120 }),
      description: body.description === undefined ? p.description : v.text(body.description, { field: 'Description', max: 500 }),
      category: body.category === undefined ? p.category : v.text(body.category, { field: 'Category', max: 60 }),
      price: body.priceCents === undefined ? p.price_cents : v.integer(body.priceCents, { field: 'Price', min: 0, max: 10000000 }),
      stock: body.stockStatus === undefined ? p.stock_status : v.oneOf(body.stockStatus, STOCK_STATUSES, 'Stock'),
      active: body.active === undefined ? p.active : body.active ? 1 : 0,
    };
    await ctx.env.DB.prepare(
      'UPDATE products SET name = ?, description = ?, category = ?, price_cents = ?, stock_status = ?, active = ?, updated_at = ? WHERE id = ?'
    )
      .bind(next.name, next.description, next.category, next.price, next.stock, next.active, nowIso(), id)
      .run();
    const fresh = await ctx.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
    const changed = [];
    if (next.price !== p.price_cents) changed.push(`price ${p.price_cents} -> ${next.price}`);
    if (next.active !== p.active) changed.push(next.active ? 'activated' : 'hidden');
    if (next.stock !== p.stock_status) changed.push(`stock ${p.stock_status} -> ${next.stock}`);
    await audit(ctx.env, 'admin', 'product.update', fresh.name, changed.join(', '));
    return json({ product: publicProduct(fresh) });
  }],

  ['GET', '/api/admin/audit', async (ctx) => {
    await requireAdmin(ctx);
    const { results } = await ctx.env.DB.prepare('SELECT at, actor, action, target, detail FROM audit_log ORDER BY id DESC LIMIT 100').all();
    return json({ entries: results });
  }],
];

export const adminReady = adminConfigured;
