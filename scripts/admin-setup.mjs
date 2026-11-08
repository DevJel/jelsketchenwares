#!/usr/bin/env node
// Creates the four private values for the store admin sign-in. Run it on your own computer:
//
//   node scripts/admin-setup.mjs
//
// It asks for the admin email and a password (typed without showing on screen), then prints
// the values to paste into Cloudflare and the key for your authenticator app. Nothing is sent
// anywhere and nothing is written to disk. Needs Node 20 or newer.
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { base32Encode, hashPassword } from '../functions/_shared/crypto.js';

export const MIN_ADMIN_PASSWORD = 14;

/** Pure function used by the CLI and by tests. */
export async function buildAdminSecrets({ email, password, secretBytes = crypto.getRandomValues(new Uint8Array(20)) }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) throw new Error('Enter a valid email address.');
  if (typeof password !== 'string' || password.length < MIN_ADMIN_PASSWORD) {
    throw new Error(`Use a password of at least ${MIN_ADMIN_PASSWORD} characters. A few unrelated words together work well.`);
  }
  if (password.length > 128) throw new Error('Use a password of 128 characters or fewer.');
  const { hash, salt } = await hashPassword(password);
  const totp = base32Encode(secretBytes);
  const label = encodeURIComponent(`Jels Kitchenwares:${cleanEmail}`);
  return {
    ADMIN_EMAIL: cleanEmail,
    ADMIN_PASSWORD_SALT: salt,
    ADMIN_PASSWORD_HASH: hash,
    ADMIN_TOTP_SECRET: totp,
    setupKey: totp.match(/.{1,4}/g).join(' '),
    otpauth: `otpauth://totp/${label}?secret=${totp}&issuer=${encodeURIComponent('Jels Kitchenwares')}&algorithm=SHA1&digits=6&period=30`,
  };
}

function askHidden(question) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) throw new Error('Run this in a terminal window so your password is not shown on screen.');
  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (fn, arg) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      fn(arg);
    };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === '\u0003') return finish(reject, new Error('Cancelled.'));
        if (ch === '\r' || ch === '\n') return finish(resolve, value);
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    }
    stdin.on('data', onData);
  });
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = await rl.question('Admin email (you will sign in with this): ');
  rl.close();
  const password = await askHidden(`Admin password (at least ${MIN_ADMIN_PASSWORD} characters, not shown): `);
  const again = await askHidden('Type the password again: ');
  if (password !== again) throw new Error('The two passwords do not match. Nothing was created. Run the script again.');
  const s = await buildAdminSecrets({ email, password });
  const line = '-'.repeat(64);
  console.log(`
${line}
STEP 1. Add these 4 values in Cloudflare
  Workers & Pages > your Jels Kitchenwares project > Settings >
  Variables and Secrets > Add (choose type "Secret") for Production.

  ADMIN_EMAIL          ${s.ADMIN_EMAIL}
  ADMIN_PASSWORD_SALT  ${s.ADMIN_PASSWORD_SALT}
  ADMIN_PASSWORD_HASH  ${s.ADMIN_PASSWORD_HASH}
  ADMIN_TOTP_SECRET    ${s.ADMIN_TOTP_SECRET}

STEP 2. Add the sign-in codes to your authenticator app
  In Google Authenticator, Microsoft Authenticator, 1Password or Authy
  choose "Enter a setup key" (time-based) and type this key:

  ${s.setupKey}

  (Some apps also accept this link: ${s.otpauth})

STEP 3. Clear this screen and keep the values private
  The salt and hash cannot be turned back into your password, but the
  authenticator key is as sensitive as a password. Do not paste any of
  this into chat, email or a file in the repository.
${line}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`\n${error.message}`);
    process.exit(1);
  });
}
