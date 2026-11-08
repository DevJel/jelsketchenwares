// Sessions and sign-in throttling.
import { sha256hex, randomToken } from './crypto.js';
import { COOKIE_NAMES, HttpError, readCookie } from './http.js';

export const CUSTOMER_SESSION_SECONDS = 7 * 24 * 3600;
export const ADMIN_SESSION_SECONDS = 8 * 3600;

export const nowSeconds = () => Math.floor(Date.now() / 1000);

export async function createSession(env, role, customerId = null) {
  const token = randomToken(32);
  const now = nowSeconds();
  const maxAge = role === 'admin' ? ADMIN_SESSION_SECONDS : CUSTOMER_SESSION_SECONDS;
  await env.DB.prepare('INSERT INTO sessions (token_hash, role, customer_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256hex(token), role, customerId, now, now + maxAge)
    .run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  return { token, maxAge, name: COOKIE_NAMES[role] };
}

export async function findSession(env, request, role) {
  const token = readCookie(request, COOKIE_NAMES[role]);
  if (!token || token.length > 200) return null;
  const session = await env.DB.prepare('SELECT * FROM sessions WHERE token_hash = ? AND role = ? AND expires_at > ?')
    .bind(await sha256hex(token), role, nowSeconds())
    .first();
  if (!session) return null;
  if (role === 'admin') return { session };
  const customer = await env.DB.prepare(
    'SELECT id, email, name, phone, address_json, must_change_password, status, created_at FROM customers WHERE id = ?'
  )
    .bind(session.customer_id)
    .first();
  if (!customer || customer.status !== 'active') return null;
  return { session, customer };
}

export async function requireCustomer(ctx, { allowMustChange = false } = {}) {
  const found = await findSession(ctx.env, ctx.request, 'customer');
  if (!found) throw new HttpError(401, 'Please sign in.');
  if (found.customer.must_change_password && !allowMustChange) {
    throw new HttpError(403, 'Please choose a new password before continuing.');
  }
  return found;
}

export async function requireAdmin(ctx) {
  const found = await findSession(ctx.env, ctx.request, 'admin');
  if (!found) throw new HttpError(401, 'Please sign in.');
  return found;
}

export async function destroySession(env, request, role) {
  const token = readCookie(request, COOKIE_NAMES[role]);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256hex(token)).run();
}

// ---- Throttling: too many failures on a key locks it for a while. ----

export async function assertNotLocked(env, keys) {
  const now = nowSeconds();
  for (const key of keys) {
    const row = await env.DB.prepare('SELECT locked_until FROM auth_attempts WHERE key = ?').bind(key).first();
    if (row?.locked_until && row.locked_until > now) {
      throw new HttpError(429, 'Too many attempts. Please wait a few minutes and try again.', {
        'retry-after': String(row.locked_until - now),
      });
    }
  }
}

export async function recordFailure(env, key, { limit = 5, windowSeconds = 900, lockSeconds = 900 } = {}) {
  const now = nowSeconds();
  const row = await env.DB.prepare('SELECT attempts, window_started_at FROM auth_attempts WHERE key = ?').bind(key).first();
  const fresh = row && now - row.window_started_at < windowSeconds;
  const attempts = (fresh ? row.attempts : 0) + 1;
  await env.DB.prepare(
    `INSERT INTO auth_attempts (key, attempts, window_started_at, locked_until) VALUES (?, ?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET attempts = excluded.attempts,
       window_started_at = excluded.window_started_at, locked_until = excluded.locked_until`
  )
    .bind(key, attempts, fresh ? row.window_started_at : now, attempts >= limit ? now + lockSeconds : null)
    .run();
}

export async function clearFailures(env, key) {
  await env.DB.prepare('DELETE FROM auth_attempts WHERE key = ?').bind(key).run();
}
