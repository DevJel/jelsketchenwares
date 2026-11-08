// Run with: node --no-warnings --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../functions/_shared/app.js';
import { base32Decode, totpCode } from '../functions/_shared/crypto.js';
import { buildAdminSecrets } from '../scripts/admin-setup.mjs';
import { D1Shim } from './d1-shim.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://store.test';

test('the setup script makes values the admin sign-in accepts', async () => {
  const s = await buildAdminSecrets({ email: ' Owner@Jels.Test ', password: 'a long unrelated phrase 42' });
  assert.equal(s.ADMIN_EMAIL, 'owner@jels.test');
  assert.match(s.ADMIN_PASSWORD_HASH, /^pbkdf2-sha256\$100000\$/);
  assert.equal(base32Decode(s.ADMIN_TOTP_SECRET).length, 20);
  assert.match(s.otpauth, /^otpauth:\/\/totp\/Jels%20Kitchenwares%3Aowner%40jels\.test\?secret=[A-Z2-7]+/);

  const env = {
    DB: new D1Shim().migrate(join(root, 'migrations')),
    ADMIN_EMAIL: s.ADMIN_EMAIL,
    ADMIN_PASSWORD_HASH: s.ADMIN_PASSWORD_HASH,
    ADMIN_PASSWORD_SALT: s.ADMIN_PASSWORD_SALT,
    ADMIN_TOTP_SECRET: s.ADMIN_TOTP_SECRET,
  };
  const login = (body) =>
    handle(
      new Request(`${ORIGIN}/api/admin/login`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json', 'cf-connecting-ip': '198.51.100.20' },
        body: JSON.stringify(body),
      }),
      env
    );
  const wrong = await login({ email: s.ADMIN_EMAIL, password: 'not the password at all', code: await totpCode(s.ADMIN_TOTP_SECRET) });
  assert.equal(wrong.status, 401);
  const right = await login({ email: s.ADMIN_EMAIL, password: 'a long unrelated phrase 42', code: await totpCode(s.ADMIN_TOTP_SECRET) });
  assert.equal(right.status, 200);
});

test('the setup script refuses weak passwords and bad emails', async () => {
  await assert.rejects(buildAdminSecrets({ email: 'owner@jels.test', password: 'short' }), /at least 14/);
  await assert.rejects(buildAdminSecrets({ email: 'not-an-email', password: 'a long unrelated phrase 42' }), /valid email/);
});
