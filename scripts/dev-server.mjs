#!/usr/bin/env node
// Local preview of the store with working customer and admin dashboards.
//
//   node --no-warnings scripts/dev-server.mjs [--port 8788] [--empty]
//
// Needs Node 22.5 or newer. Everything lives in memory and disappears when you stop it. It listens
// on this computer only (127.0.0.1) and uses made-up demo accounts, so it never touches Cloudflare
// or any real data. Do not reuse the demo passwords anywhere.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../functions/_shared/app.js';
import { hashPassword, totpCode } from '../functions/_shared/crypto.js';
import { D1Shim } from '../tests/d1-shim.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const portIndex = args.indexOf('--port');
const PORT = portIndex >= 0 ? Number(args[portIndex + 1]) : 8788;
const EMPTY = args.includes('--empty');

export const DEMO = {
  adminEmail: 'owner@demo.local',
  adminPassword: 'demo-admin-passphrase-2026',
  totpSecret: 'JBSWY3DPEHPK3PXP',
  customerEmail: 'aisha@demo.local',
  customerPassword: 'demo-customer-pass-2026',
};

// Only these parts of the repository are served as web pages.
const PUBLIC_FILES = new Set(['index.html', 'jels-bag-icon.svg']);
const PUBLIC_DIRS = new Set(['account', 'admin', 'dashboard']);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const HOUR = 3_600_000;
const ago = (hours) => new Date(Date.now() - hours * HOUR).toISOString();

/** Four customers and a spread of orders, so every screen has something to show. */
async function seedDemoData(DB) {
  const people = [
    // email, name, phone, city, region, postcode, line1, status, joined (hours ago), last sign-in (hours ago)
    [DEMO.customerEmail, 'Aisha Rahman', '+60 12 345 6789', 'Kuala Lumpur', 'Wilayah Persekutuan', '50450', '12 Jalan Bunga', 'active', 24 * 40, 2],
    ['ben.tan@demo.local', 'Ben Tan', '+60 16 222 3344', 'Petaling Jaya', 'Selangor', '47301', '8 Lorong Cempaka', 'active', 24 * 22, 30],
    ['chloe.lim@demo.local', 'Chloe Lim', '+65 8123 4567', 'Singapore', '', '238823', '21 Orchard Road', 'active', 24 * 15, 80],
    ['daniel.wong@demo.local', 'Daniel Wong', '+60 11 555 0199', 'Johor Bahru', 'Johor', '80000', '5 Jalan Tebrau', 'disabled', 24 * 60, 24 * 20],
  ];
  const pw = await hashPassword(DEMO.customerPassword);
  for (const [email, name, phone, city, region, postcode, line1, status, joined, seen] of people) {
    const address = JSON.stringify({ line1, line2: '', city, region, postcode, country: city === 'Singapore' ? 'Singapore' : 'Malaysia' });
    await DB.prepare('INSERT INTO customers (email, name, phone, address_json, password_hash, password_salt, status, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(email, name, phone, address, pw.hash, pw.salt, status, ago(joined), ago(seen))
      .run();
  }

  // order number, customer id, status, [[product id, qty]], hours ago, customer note
  const orders = [
    ['JK-261031-DAN1', 4, 'delivered', [[2, 1], [3, 2]], 24 * 9, ''],
    ['JK-261102-CHL2', 3, 'delivered', [[5, 1]], 24 * 6, ''],
    ['JK-261105-DEMO', 1, 'delivered', [[1, 1], [3, 1]], 24 * 4, ''],
    ['JK-261106-CHL3', 3, 'cancelled', [[3, 1]], 50, 'Ordered by mistake.'],
    ['JK-261103-CHL1', 3, 'packed', [[1, 2]], 48, 'Gift: please leave out the price slip.'],
    ['JK-261104-BEN1', 2, 'confirmed', [[4, 1], [6, 2]], 28, ''],
    ['JK-261107-DEMO', 1, 'shipped', [[2, 1]], 26, ''],
    ['JK-261108-BEN2', 2, 'requested', [[2, 1]], 3, ''],
    ['JK-261108-DEMO', 1, 'requested', [[5, 2], [6, 1]], 1, 'Please pack the jars with extra care.'],
  ];
  for (const [orderNo, customerId, status, lines, hours, note] of orders) {
    const who = await DB.prepare('SELECT * FROM customers WHERE id = ?').bind(customerId).first();
    const a = JSON.parse(who.address_json);
    const contact = JSON.stringify({ name: who.name, phone: who.phone, line1: a.line1, line2: '', city: a.city, region: a.region, postcode: a.postcode, country: a.country });
    const items = [];
    for (const [productId, qty] of lines) {
      const p = await DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first();
      items.push({ productId, name: p.name, unitCents: p.price_cents, qty, lineCents: p.price_cents * qty });
    }
    const total = items.reduce((sum, i) => sum + i.lineCents, 0);
    await DB.prepare("INSERT INTO orders (order_no, customer_id, status, items_json, total_cents, currency, contact_json, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'USD', ?, ?, ?, ?)")
      .bind(orderNo, customerId, status, JSON.stringify(items), total, contact, note, ago(hours), ago(Math.max(0, hours - 1)))
      .run();
  }

  const log = [
    [2, 'login', '', 'ip 127.0.0.1'],
    [3, 'order.status', 'JK-261104-BEN1', 'requested -> confirmed'],
    [26, 'order.status', 'JK-261107-DEMO', 'packed -> shipped'],
    [27, 'order.status', 'JK-261103-CHL1', 'confirmed -> packed'],
    [50, 'order.note', 'JK-261106-CHL3'],
    [24 * 20, 'customer.disabled', 'daniel.wong@demo.local'],
  ];
  for (const [hours, action, target, detail = ''] of log) {
    await DB.prepare('INSERT INTO audit_log (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)').bind(ago(hours), 'admin', action, target, detail).run();
  }
}

export async function createDemoEnv({ empty = false } = {}) {
  const DB = new D1Shim().migrate(join(root, 'migrations'));
  const admin = await hashPassword(DEMO.adminPassword);
  const env = {
    DB,
    ADMIN_EMAIL: DEMO.adminEmail,
    ADMIN_PASSWORD_HASH: admin.hash,
    ADMIN_PASSWORD_SALT: admin.salt,
    ADMIN_TOTP_SECRET: DEMO.totpSecret,
  };
  if (!empty) await seedDemoData(DB);
  return env;
}

async function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  rel = normalize(rel).replace(/^[/\\]+/, '');
  const first = rel.split(sep)[0];
  if (!(PUBLIC_FILES.has(rel) || PUBLIC_DIRS.has(first)) || rel.split(sep).some((part) => part.startsWith('.') || part === '..')) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  const file = join(root, rel);
  if (!file.startsWith(root + sep)) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
  }
}

// Each authenticator code works once. The sign-in accepts the current 30-second step and one either
// side, so a test can have up to three different codes per half minute; after that it waits.
const handedOut = new Set();
async function freshAdminCode() {
  for (;;) {
    const now = Date.now();
    for (const drift of [0, 1, -1]) {
      const step = Math.floor((now + drift * 30_000) / 30_000);
      if (!handedOut.has(step)) {
        handedOut.add(step);
        return totpCode(DEMO.totpSecret, now + drift * 30_000);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

export async function startDevServer({ port = PORT, empty = EMPTY } = {}) {
  const env = await createDemoEnv({ empty });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${port}`}`);
      if (url.pathname === '/__dev/admin-code') {
        // Local convenience only: the demo authenticator code, so a test or a demo can sign in.
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ code: await freshAdminCode() }));
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const headers = new Headers();
        for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        headers.set('cf-connecting-ip', '127.0.0.1');
        const hasBody = !['GET', 'HEAD'].includes(req.method);
        const response = await handle(new Request(url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }), env);
        const out = {};
        response.headers.forEach((value, key) => { if (key !== 'set-cookie') out[key] = value; });
        out['set-cookie'] = response.headers.getSetCookie();
        res.writeHead(response.status, out).end(Buffer.from(await response.arrayBuffer()));
        return;
      }
      await serveStatic(url.pathname, res);
    } catch (error) {
      console.error(error);
      res.writeHead(500, { 'content-type': 'text/plain' }).end('Server error');
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  return { server, env, port: server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { port } = await startDevServer();
  console.log(`
Jels Kitchenwares local preview (demo data, nothing is saved)
  Store:      http://127.0.0.1:${port}/
  Customers:  http://127.0.0.1:${port}/account/   ${EMPTY ? '(create an account to try it)' : `${DEMO.customerEmail} / ${DEMO.customerPassword}`}
  Admin:      http://127.0.0.1:${port}/admin/     ${DEMO.adminEmail} / ${DEMO.adminPassword}
              authenticator key (demo only): ${DEMO.totpSecret}
Stop with Ctrl+C.
`);
  setInterval(async () => process.stdout.write(`\r  Admin code right now: ${await totpCode(DEMO.totpSecret)}   `), 1000).unref?.();
}
