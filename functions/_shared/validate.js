import { HttpError } from './http.js';

/** A trimmed string with length limits. Control characters are removed. */
export function text(value, { field = 'This field', min = 0, max = 200 } = {}) {
  const raw = typeof value === 'string' ? value : value == null ? '' : String(value);
  // eslint-disable-next-line no-control-regex
  const clean = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
  if (clean.length < min) throw new HttpError(422, min === 1 ? `${field} is required.` : `${field} is too short.`);
  if (clean.length > max) throw new HttpError(422, `${field} is too long (maximum ${max} characters).`);
  return clean;
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function email(value) {
  const clean = text(value, { field: 'Email', min: 1, max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(clean)) throw new HttpError(422, 'Enter a valid email address.');
  return clean;
}

export function integer(value, { field = 'Number', min = 0, max = 1e9 } = {}) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (!Number.isInteger(n) || n < min || n > max) throw new HttpError(422, `${field} must be a whole number from ${min} to ${max}.`);
  return n;
}

export function password(value, { field = 'Password', min = 10, forbid = [] } = {}) {
  if (typeof value !== 'string') throw new HttpError(422, `${field} is required.`);
  if (value.length < min) throw new HttpError(422, `${field} must be at least ${min} characters.`);
  if (value.length > 128) throw new HttpError(422, `${field} must be 128 characters or fewer.`);
  const lower = value.toLowerCase();
  if (forbid.some((f) => f && lower === String(f).toLowerCase())) throw new HttpError(422, `${field} is too easy to guess.`);
  if (/^(.)\1+$/.test(value)) throw new HttpError(422, `${field} is too easy to guess.`);
  return value;
}

export const oneOf = (value, allowed, field = 'Value') => {
  if (!allowed.includes(value)) throw new HttpError(422, `${field} is not valid.`);
  return value;
};
