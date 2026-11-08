// Run with: node --no-warnings --test tests/api.test.mjs   (Node 22.5 or newer)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../functions/_shared/app.js';
import { hashPassword, totpCode } from '../functions/_shared/crypto.js';
import { D1Shim } from './d1-shim.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://store.test';
const ADMIN = { email: 'owner@jels.test', password: 'Admin-Passphrase-for-tests-1', totp: 'JBSWY3DPEHPK3PXP' };
const GOOD = 'Correct-Horse-Battery-9';

async function makeEnv({ admin = true } = {}) {
  const env = { DB: new D1Shim().migrate(join(root, 'migrations')) };
  if (admin) {
    const { hash, salt } = await hashPassword(ADMIN.password);
    Object.assign(env, { ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD_HASH: hash, ADMIN_PASSWORD_SALT: salt, ADMIN_TOTP_SECRET: ADMIN.totp });
  }
  return env;
}

/** A browser-like client that keeps cookies. */
function client(env, ip = '203.0.113.7') {
  const jar = new Map();
  const call = async (method, path, body, { origin = ORIGIN, headers = {} } = {}) => {
    const h = new Headers({ 'cf-connecting-ip': ip, ...headers });
    if (origin) h.set('origin', origin);
    if (body !== undefined) h.set('content-type', 'application/json');
    if (jar.size) h.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const res = await handle(new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), env);
    const cookies = res.headers.getSetCookie();
    for (const c of cookies) {
      const [pair] = c.split(';');
      const [k, ...rest] = pair.split('=');
      if (/Max-Age=0/.test(c) || !rest.join('=')) jar.delete(k);
      else jar.set(k, rest.join('='));
    }
    return { status: res.status, data: await res.json().catch(() => null), cookies, headers: res.headers };
  };
  return {
    jar,
    get: (p, o) => call('GET', p, undefined, o),
    post: (p, b = {}, o) => call('POST', p, b, o),
    patch: (p, b = {}, o) => call('PATCH', p, b, o),
  };
}

const CONTACT = { name: 'Aisha Rahman', phone: '+60123456789', line1: '12 Jalan Bunga', city: 'Kuala Lumpur', postcode: '50450', country: 'Malaysia' };

async function signUp(env, email = 'aisha@example.com', ip) {
  const c = client(env, ip);
  const res = await c.post('/api/customer/register', { name: 'Aisha Rahman', email, password: GOOD });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return c;
}

async function signInAdmin(env, ip = '198.51.100.9') {
  const c = client(env, ip);
  const res = await c.post('/api/admin/login', { email: ADMIN.email, password: ADMIN.password, code: await totpCode(ADMIN.totp) });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return c;
}

const placeOrder = (c, items = [{ productId: 1, qty: 2 }], extra = {}) => c.post('/api/customer/orders', { items, contact: CONTACT, ...extra });

test('health shows what is configured', async () => {
  const env = await makeEnv();
  const res = await client(env).get('/api/health');
  assert.deepEqual(res.data, { ok: true, database: true, adminSignIn: true });
  const bare = await handle(new Request(ORIGIN + '/api/health'), {});
  assert.deepEqual(await bare.json(), { ok: true, database: false, adminSignIn: false });
});

test('without a database the API says it is not set up instead of crashing', async () => {
  const res = await handle(new Request(ORIGIN + '/api/products'), {});
  assert.equal(res.status, 503);
});

test('customer registers, gets a locked-down cookie, and can sign out', async () => {
  const env = await makeEnv();
  const c = client(env);
  const reg = await c.post('/api/customer/register', { name: 'Aisha Rahman', email: 'Aisha@Example.com', password: GOOD });
  assert.equal(reg.status, 201);
  assert.equal(reg.data.customer.email, 'aisha@example.com');
  assert.ok(!JSON.stringify(reg.data).includes('password'), 'no password data in responses');
  const cookie = reg.cookies[0];
  assert.match(cookie, /^__Host-jk_customer=/);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(cookie.includes(flag), flag);
  assert.equal((await c.get('/api/customer/me')).data.customer.name, 'Aisha Rahman');
  await c.post('/api/customer/logout');
  assert.equal((await c.get('/api/customer/me')).status, 401);
});

test('only a hash of the session token is stored, and passwords are hashed', async () => {
  const env = await makeEnv();
  const c = await signUp(env);
  const token = c.jar.get('__Host-jk_customer');
  const rows = (await env.DB.prepare('SELECT token_hash FROM sessions').all()).results;
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].token_hash, token);
  const customer = await env.DB.prepare('SELECT password_hash FROM customers').first();
  assert.match(customer.password_hash, /^pbkdf2-sha256\$100000\$/);
  assert.ok(!customer.password_hash.includes(GOOD));
});

test('weak, short or duplicate sign-ups are refused', async () => {
  const env = await makeEnv();
  const c = client(env);
  assert.equal((await c.post('/api/customer/register', { name: 'A', email: 'a@example.com', password: 'short' })).status, 422);
  assert.equal((await c.post('/api/customer/register', { name: 'A', email: 'a@example.com', password: 'aaaaaaaaaaaa' })).status, 422);
  assert.equal((await c.post('/api/customer/register', { name: 'A', email: 'not-an-email', password: GOOD })).status, 422);
  await signUp(env, 'dupe@example.com', '198.51.100.1');
  const again = await client(env, '198.51.100.2').post('/api/customer/register', { name: 'B', email: 'DUPE@example.com', password: GOOD });
  assert.equal(again.status, 409);
});

test('wrong password and unknown email look the same, and repeated failures lock the account', async () => {
  const env = await makeEnv();
  await signUp(env, 'lock@example.com');
  const c = client(env, '198.51.100.20');
  const wrong = await c.post('/api/customer/login', { email: 'lock@example.com', password: 'nope-nope-nope' });
  const unknown = await c.post('/api/customer/login', { email: 'ghost@example.com', password: 'nope-nope-nope' });
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.data, unknown.data);
  for (let i = 0; i < 4; i += 1) await c.post('/api/customer/login', { email: 'lock@example.com', password: 'nope-nope-nope' });
  const locked = await c.post('/api/customer/login', { email: 'lock@example.com', password: GOOD });
  assert.equal(locked.status, 429);
  assert.ok(locked.headers.get('retry-after'));
});

test('requests from another site are refused', async () => {
  const env = await makeEnv();
  await signUp(env, 'csrf@example.com');
  const c = client(env);
  const evil = await c.post('/api/customer/login', { email: 'csrf@example.com', password: GOOD }, { origin: 'https://evil.example' });
  assert.equal(evil.status, 403);
  const none = await c.post('/api/customer/login', { email: 'csrf@example.com', password: GOOD }, { origin: null });
  assert.equal(none.status, 403);
  const crossSite = await c.post('/api/customer/login', { email: 'csrf@example.com', password: GOOD }, { headers: { 'sec-fetch-site': 'cross-site' } });
  assert.equal(crossSite.status, 403);
});

test('customer can edit their profile', async () => {
  const env = await makeEnv();
  const c = await signUp(env);
  const res = await c.patch('/api/customer/me', { name: 'Aisha R.', phone: '+60111', address: { line1: '1 Road', city: 'Ipoh', postcode: '30000', country: 'Malaysia' } });
  assert.equal(res.status, 200);
  assert.equal(res.data.customer.address.city, 'Ipoh');
  assert.equal((await c.get('/api/customer/me')).data.customer.phone, '+60111');
});

test('order totals come from the database, never from the browser', async () => {
  const env = await makeEnv();
  const c = await signUp(env);
  const res = await placeOrder(c, [{ productId: 1, qty: 2, unitCents: 1, priceCents: 1 }, { productId: 1, qty: 1 }, { productId: 3, qty: 1 }], { totalCents: 5 });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const order = res.data.order;
  assert.equal(order.status, 'requested');
  assert.match(order.orderNo, /^JK-\d{6}-[A-Z0-9]{4}$/);
  assert.equal(order.currency, 'USD');
  assert.equal(order.totalCents, 3 * 4900 + 3600);
  assert.equal(order.items.find((i) => i.productId === 1).qty, 3);
  assert.equal(order.items.find((i) => i.productId === 1).unitCents, 4900);
});

test('bad orders are refused', async () => {
  const env = await makeEnv();
  const c = await signUp(env);
  assert.equal((await placeOrder(c, [])).status, 422);
  assert.equal((await placeOrder(c, [{ productId: 1, qty: 0 }])).status, 422);
  assert.equal((await placeOrder(c, [{ productId: 1, qty: 1.5 }])).status, 422);
  assert.equal((await placeOrder(c, [{ productId: 999, qty: 1 }])).status, 422);
  assert.equal((await c.post('/api/customer/orders', { items: [{ productId: 1, qty: 1 }], contact: { name: 'x' } })).status, 422);
  await env.DB.prepare("UPDATE products SET stock_status = 'out_of_stock' WHERE id = 2").run();
  await env.DB.prepare('UPDATE products SET active = 0 WHERE id = 3').run();
  assert.equal((await placeOrder(c, [{ productId: 2, qty: 1 }])).status, 422);
  assert.equal((await placeOrder(c, [{ productId: 3, qty: 1 }])).status, 422);
  const anon = await placeOrder(client(env), [{ productId: 1, qty: 1 }]);
  assert.equal(anon.status, 401);
});

test('a customer can never see or cancel someone else\'s order', async () => {
  const env = await makeEnv();
  const a = await signUp(env, 'a@example.com', '198.51.100.31');
  const b = await signUp(env, 'b@example.com', '198.51.100.32');
  const { order } = (await placeOrder(a)).data;
  assert.equal((await b.get(`/api/customer/orders/${order.id}`)).status, 404);
  assert.equal((await b.post(`/api/customer/orders/${order.id}/cancel`)).status, 404);
  assert.equal((await b.get('/api/customer/orders')).data.orders.length, 0);
  assert.equal((await a.get(`/api/customer/orders/${order.id}`)).status, 200);
  assert.equal((await env.DB.prepare('SELECT status FROM orders WHERE id = ?').bind(order.id).first()).status, 'requested');
});

test('customer and admin sessions do not work on each other\'s endpoints', async () => {
  const env = await makeEnv();
  const customer = await signUp(env);
  const admin = await signInAdmin(env);
  assert.equal((await customer.get('/api/admin/orders')).status, 401);
  assert.equal((await customer.get('/api/admin/customers')).status, 401);
  assert.equal((await customer.patch('/api/admin/products/1', { priceCents: 1 })).status, 401);
  assert.equal((await admin.get('/api/customer/orders')).status, 401);
  assert.equal((await client(env).get('/api/admin/summary')).status, 401);
});

test('admin sign-in needs email, password and a fresh authenticator code', async () => {
  const env = await makeEnv();
  const code = await totpCode(ADMIN.totp);
  const post = (body, ip) => client(env, ip).post('/api/admin/login', body);
  assert.equal((await post({ email: ADMIN.email, password: ADMIN.password, code: '000000' }, '198.51.100.40')).status, 401);
  assert.equal((await post({ email: ADMIN.email, password: 'wrong-wrong-wrong', code }, '198.51.100.41')).status, 401);
  assert.equal((await post({ email: 'someone@else.test', password: ADMIN.password, code }, '198.51.100.42')).status, 401);
  assert.equal((await post({ email: ADMIN.email, password: ADMIN.password }, '198.51.100.43')).status, 401);
  const ok = await post({ email: ADMIN.email, password: ADMIN.password, code }, '198.51.100.44');
  assert.equal(ok.status, 200);
  assert.match(ok.cookies[0], /^__Host-jk_admin=.*HttpOnly.*Secure.*SameSite=Strict/);
  // The same code cannot be used a second time.
  const replay = await post({ email: ADMIN.email, password: ADMIN.password, code }, '198.51.100.45');
  assert.equal(replay.status, 401);
});

test('admin sign-in is locked after repeated failures, even with the right details', async () => {
  const env = await makeEnv();
  const c = client(env, '198.51.100.50');
  for (let i = 0; i < 5; i += 1) await c.post('/api/admin/login', { email: ADMIN.email, password: 'wrong-wrong-wrong', code: '123456' });
  const res = await c.post('/api/admin/login', { email: ADMIN.email, password: ADMIN.password, code: await totpCode(ADMIN.totp) });
  assert.equal(res.status, 429);
});

test('admin sign-in says it is not set up when the secrets are missing', async () => {
  const env = await makeEnv({ admin: false });
  const res = await client(env).post('/api/admin/login', { email: 'a@b.co', password: 'x', code: '123456' });
  assert.equal(res.status, 503);
});

test('admin moves orders along a fixed path and the customer sees the result, not the internal note', async () => {
  const env = await makeEnv();
  const customer = await signUp(env);
  const admin = await signInAdmin(env);
  const { order } = (await placeOrder(customer)).data;

  assert.equal((await admin.patch(`/api/admin/orders/${order.id}`, { status: 'delivered' })).status, 409);
  const confirmed = await admin.patch(`/api/admin/orders/${order.id}`, { status: 'confirmed', adminNote: 'Paid by bank transfer, ref 123' });
  assert.equal(confirmed.status, 200);
  assert.deepEqual(confirmed.data.nextStatuses, ['packed', 'cancelled']);
  assert.equal(confirmed.data.order.adminNote, 'Paid by bank transfer, ref 123');
  assert.equal(confirmed.data.order.customer.email, 'aisha@example.com');

  const seen = (await customer.get(`/api/customer/orders/${order.id}`)).data.order;
  assert.equal(seen.status, 'confirmed');
  assert.ok(!('adminNote' in seen));
  assert.ok(!JSON.stringify(seen).includes('bank transfer'));

  // Customers can cancel only while the request is still waiting.
  assert.equal((await customer.post(`/api/customer/orders/${order.id}/cancel`)).status, 409);
  for (const s of ['packed', 'shipped', 'delivered']) assert.equal((await admin.patch(`/api/admin/orders/${order.id}`, { status: s })).status, 200);
  assert.equal((await admin.patch(`/api/admin/orders/${order.id}`, { status: 'cancelled' })).status, 409);

  const log = (await admin.get('/api/admin/audit')).data.entries.map((e) => e.action);
  assert.ok(log.includes('order.status') && log.includes('login'));
});

test('a customer can cancel a request that is still waiting', async () => {
  const env = await makeEnv();
  const customer = await signUp(env);
  const { order } = (await placeOrder(customer)).data;
  const res = await customer.post(`/api/customer/orders/${order.id}/cancel`);
  assert.equal(res.status, 200);
  assert.equal(res.data.order.status, 'cancelled');
});

test('disabling a customer signs them out and blocks sign-in until re-enabled', async () => {
  const env = await makeEnv();
  const customer = await signUp(env, 'gone@example.com');
  const admin = await signInAdmin(env);
  const id = (await admin.get('/api/admin/customers')).data.customers[0].id;
  assert.equal((await admin.patch(`/api/admin/customers/${id}`, { status: 'disabled' })).status, 200);
  assert.equal((await customer.get('/api/customer/me')).status, 401);
  const again = await client(env, '198.51.100.60').post('/api/customer/login', { email: 'gone@example.com', password: GOOD });
  assert.equal(again.status, 401);
  assert.equal((await admin.patch(`/api/admin/customers/${id}`, { status: 'active' })).status, 200);
  const back = await client(env, '198.51.100.61').post('/api/customer/login', { email: 'gone@example.com', password: GOOD });
  assert.equal(back.status, 200);
});

test('password reset: one-time password, forced change, old sessions revoked', async () => {
  const env = await makeEnv();
  const old = await signUp(env, 'reset@example.com');
  const admin = await signInAdmin(env);
  const id = (await admin.get('/api/admin/customers')).data.customers[0].id;
  const { temporaryPassword } = (await admin.post(`/api/admin/customers/${id}/reset-password`)).data;
  assert.ok(temporaryPassword.length >= 12);
  assert.equal((await old.get('/api/customer/me')).status, 401, 'old session is gone');
  assert.equal((await client(env, '198.51.100.70').post('/api/customer/login', { email: 'reset@example.com', password: GOOD })).status, 401, 'old password no longer works');

  const fresh = client(env, '198.51.100.71');
  const login = await fresh.post('/api/customer/login', { email: 'reset@example.com', password: temporaryPassword });
  assert.equal(login.status, 200);
  assert.equal(login.data.customer.mustChangePassword, true);
  assert.equal((await fresh.get('/api/customer/orders')).status, 403, 'blocked until the password is changed');
  assert.equal((await placeOrder(fresh)).status, 403);
  assert.equal((await fresh.get('/api/customer/me')).status, 200);

  assert.equal((await fresh.post('/api/customer/password', { currentPassword: 'wrong', newPassword: 'A-brand-new-passphrase-7' })).status, 403);
  assert.equal((await fresh.post('/api/customer/password', { currentPassword: temporaryPassword, newPassword: 'A-brand-new-passphrase-7' })).status, 200);
  assert.equal((await fresh.get('/api/customer/orders')).status, 200);
});

test('changing a password signs out the other devices', async () => {
  const env = await makeEnv();
  const phone = await signUp(env, 'two@example.com', '198.51.100.80');
  const laptop = client(env, '198.51.100.81');
  assert.equal((await laptop.post('/api/customer/login', { email: 'two@example.com', password: GOOD })).status, 200);
  assert.equal((await laptop.post('/api/customer/password', { currentPassword: GOOD, newPassword: 'Another-long-passphrase-3' })).status, 200);
  assert.equal((await phone.get('/api/customer/me')).status, 401);
  assert.equal((await laptop.get('/api/customer/me')).status, 200);
});

test('admin manages products; price changes never alter existing orders; hidden products leave the public list', async () => {
  const env = await makeEnv();
  const customer = await signUp(env);
  const admin = await signInAdmin(env);
  const { order } = (await placeOrder(customer, [{ productId: 1, qty: 1 }])).data;

  const edited = await admin.patch('/api/admin/products/1', { priceCents: 9900 });
  assert.equal(edited.data.product.priceCents, 9900);
  assert.equal((await customer.get(`/api/customer/orders/${order.id}`)).data.order.totalCents, 4900);
  assert.equal((await placeOrder(customer, [{ productId: 1, qty: 1 }])).data.order.totalCents, 9900);

  const created = await admin.post('/api/admin/products', { name: 'Glass Lid 24cm', description: 'Fits the pan', category: 'Pans', priceCents: 1500, stockStatus: 'in_stock' });
  assert.equal(created.status, 201);
  assert.equal((await client(env).get('/api/products')).data.products.length, 7);
  await admin.patch(`/api/admin/products/${created.data.product.id}`, { active: false });
  const pub = (await client(env).get('/api/products')).data;
  assert.equal(pub.products.length, 6);
  assert.equal(pub.currency, 'USD');
  assert.equal((await admin.patch('/api/admin/products/1', { priceCents: -5 })).status, 422);
  assert.equal((await admin.patch('/api/admin/products/1', { stockStatus: 'plenty' })).status, 422);
});

test('admin summary counts orders and customers', async () => {
  const env = await makeEnv();
  const customer = await signUp(env);
  const admin = await signInAdmin(env);
  await placeOrder(customer);
  const second = (await placeOrder(customer, [{ productId: 3, qty: 1 }])).data.order;
  await admin.patch(`/api/admin/orders/${second.id}`, { status: 'confirmed' });
  const s = (await admin.get('/api/admin/summary')).data;
  assert.equal(s.ordersByStatus.requested, 1);
  assert.equal(s.ordersByStatus.confirmed, 1);
  assert.equal(s.customers, 1);
  assert.equal(s.activeProducts, 6);
  assert.equal(s.openOrderValueCents, 2 * 4900 + 3600);
  assert.equal(s.recentOrders.length, 2);
  const filtered = (await admin.get('/api/admin/orders?status=confirmed')).data.orders;
  assert.equal(filtered.length, 1);
  assert.equal((await admin.get('/api/admin/orders?status=bogus')).status, 422);
});

test('unknown routes and wrong methods give clean errors', async () => {
  const env = await makeEnv();
  const c = client(env);
  assert.equal((await c.get('/api/nothing')).status, 404);
  assert.equal((await c.get('/api/customer/login')).status, 405);
  const bad = await handle(new Request(ORIGIN + '/api/customer/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'text/plain' }, body: 'x' }), env);
  assert.equal(bad.status, 415);
  const broken = await handle(new Request(ORIGIN + '/api/customer/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: '{nope' }), env);
  assert.equal(broken.status, 400);
});

test('responses are never cached', async () => {
  const env = await makeEnv();
  const res = await client(env).get('/api/products');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});
