// Small HTTP helpers shared by the store API.

export class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

export function json(data, status = 200, { cookies = [], headers = {} } = {}) {
  const h = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...headers,
  });
  for (const cookie of cookies) h.append('set-cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers: h });
}

// The __Host- prefix makes browsers accept the cookie only over HTTPS, for this exact host.
export const COOKIE_NAMES = { customer: '__Host-jk_customer', admin: '__Host-jk_admin' };

export const setCookie = (name, value, maxAge) =>
  `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

export const clearCookie = (name) => setCookie(name, '', 0);

export function readCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return '';
}

export async function readJson(request, maxBytes = 20000) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('application/json')) throw new HttpError(415, 'The request must be JSON.');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'The request is too large.');
  try {
    const value = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch {
    throw new HttpError(400, 'The request could not be read.');
  }
}

/** Browsers send Origin on every state-changing request. Anything from another site is refused. */
export function checkOrigin(request) {
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') throw new HttpError(403, 'Request refused.');
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new HttpError(403, 'Request refused.');
}

export const clientIp = (request) => request.headers.get('cf-connecting-ip') || 'unknown';
