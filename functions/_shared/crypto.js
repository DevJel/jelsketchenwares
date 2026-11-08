// WebCrypto helpers (Cloudflare Workers and Node 20+). Adapted from the JelHR project (MIT).
const enc = new TextEncoder();

export const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('=', '').replaceAll('+', '-').replaceAll('/', '_');

export const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function sha256hex(value) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(value)));
}

/** Constant-time string comparison (only the length can leak). */
export function safeEqual(a, b) {
  a = String(a ?? '');
  b = String(b ?? '');
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const randomToken = (bytes = 32) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

// Cloudflare Workers rejects PBKDF2 iteration counts above 100,000, so that is the
// strongest setting the runtime allows. The count is stored with the hash so it can be
// raised later without breaking existing accounts.
// Stored format: pbkdf2-sha256$<iterations>$<hash>; the salt is stored separately.
export const PBKDF2_ITERATIONS = 100000;

async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' },
    key,
    256
  );
  return b64url(bits);
}

export async function hashPassword(password, salt = randomToken(24)) {
  return { hash: `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${await derive(password, salt, PBKDF2_ITERATIONS)}`, salt };
}

export async function verifyPassword(password, salt, stored) {
  const parts = String(stored || '').split('$');
  if (!salt || parts.length !== 3 || parts[0] !== 'pbkdf2-sha256') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1000 || iterations > PBKDF2_ITERATIONS) return false;
  return safeEqual(await derive(String(password), salt, iterations), parts[2]);
}

/** Burns the same time as a real check so unknown accounts cannot be told apart by speed. */
export async function dummyPasswordWork(password) {
  await derive(String(password), 'jels-kitchenwares-dummy-salt', PBKDF2_ITERATIONS);
}

// TOTP (RFC 6238, SHA-1, 30 s, 6 digits): works with Google/Microsoft Authenticator, 1Password, Authy.
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of new Uint8Array(bytes)) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text) {
  const clean = String(text).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export async function totpCode(secretB32, timeMs = Date.now(), step = 30) {
  let counter = Math.floor(timeMs / 1000 / step);
  const msg = new Uint8Array(8);
  for (let i = 7; i >= 0; i -= 1) {
    msg[i] = counter & 255;
    counter = Math.floor(counter / 256);
  }
  const key = await crypto.subtle.importKey('raw', base32Decode(secretB32), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const offset = mac[19] & 15;
  const bin = ((mac[offset] & 127) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(bin % 1e6).padStart(6, '0');
}

/** Accepts the current code and one step either side (clock drift). Returns the matched time step, or null. */
export async function verifyTotp(secretB32, code, timeMs = Date.now()) {
  const given = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  let matched = null;
  for (const drift of [0, -1, 1]) {
    const t = timeMs + drift * 30000;
    if (safeEqual(await totpCode(secretB32, t), given) && matched === null) matched = Math.floor(t / 30000);
  }
  return matched;
}
