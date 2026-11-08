#!/usr/bin/env node
// Takes a screenshot of every dashboard tab (desktop and phone) from the local preview and
// refreshes the gallery in README.md. Run it after every visual change:
//
//   node --no-warnings scripts/screenshots.mjs
//
// Needs Playwright and Node 22.5+. It uses the demo data from scripts/dev-server.mjs, so nothing
// real appears in the pictures. Animations are switched off (reduced motion) so each picture shows
// the finished state. Options:  --out docs/screenshots   --readme README.md   --no-readme
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO, launch } from '../tests/e2e/harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const OUT = join(root, arg('--out', 'docs/screenshots'));
const README = join(root, arg('--readme', 'README.md'));
const UPDATE_README = !process.argv.includes('--no-readme');

/** Every picture: id, which dashboard, the tab it shows, and a one-line caption for the README. */
export const SHOTS = [
  { id: 'customer-sign-in', area: 'Customer', tab: 'Sign in', note: 'Email and password, with a Show button.' },
  { id: 'customer-create-account', area: 'Customer', tab: 'Create account', note: 'Name, email and a password with a hint.' },
  { id: 'customer-my-orders', area: 'Customer', tab: 'My orders', note: 'Counts, then one card per order request.' },
  { id: 'customer-order-details', area: 'Customer', tab: 'My orders (details open)', note: 'Items, delivery information and progress.' },
  { id: 'customer-cancel-dialog', area: 'Customer', tab: 'Cancel a request', note: 'A glass confirmation before anything is cancelled.' },
  { id: 'customer-request-order', area: 'Customer', tab: 'Request an order', note: 'Pick products, check delivery details, see the total.' },
  { id: 'customer-request-sent', area: 'Customer', tab: 'Request sent', note: 'Confirmation after sending. Nothing is charged.' },
  { id: 'customer-my-details', area: 'Customer', tab: 'My details', note: 'Name, phone and the saved delivery address.' },
  { id: 'customer-password', area: 'Customer', tab: 'Password', note: 'Change password, signs out other devices.' },
  { id: 'customer-mobile-menu', area: 'Customer', tab: 'Phone menu', note: 'Phones and tablets get one Menu button that opens this sheet.', phoneOnly: true },
  { id: 'admin-sign-in', area: 'Admin', tab: 'Sign in', note: 'Password plus a one-time authenticator code.' },
  { id: 'admin-overview', area: 'Admin', tab: 'Overview', note: 'Key numbers, the order pipeline, latest requests.' },
  { id: 'admin-orders', area: 'Admin', tab: 'Orders', note: 'Filter by status, open any order.' },
  { id: 'admin-order-detail', area: 'Admin', tab: 'Orders (one order open)', note: 'Progress, items, delivery, status buttons, internal note.' },
  { id: 'admin-customers', area: 'Admin', tab: 'Customers', note: 'Everyone with an account.' },
  { id: 'admin-customer-detail', area: 'Admin', tab: 'Customers (one open)', note: 'Details, disable or reset password, their orders.' },
  { id: 'admin-products', area: 'Admin', tab: 'Products', note: 'What customers can choose, and the prices.' },
  { id: 'admin-product-form', area: 'Admin', tab: 'Products (editing)', note: 'Edit a product or add a new one.' },
  { id: 'admin-activity', area: 'Admin', tab: 'Activity', note: 'Latest sign-ins and changes.' },
  { id: 'admin-mobile-menu', area: 'Admin', tab: 'Phone menu', note: 'The same Menu sheet, with the admin sections.', phoneOnly: true },
];
export const DARK_SHOTS = [
  { id: 'customer-my-orders-dark', area: 'Customer', tab: 'My orders (dark mode)' },
  { id: 'admin-overview-dark', area: 'Admin', tab: 'Overview (dark mode)' },
];

const captured = new Set();
let screenshotDir = OUT;
async function snap(page, id, profile) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(screenshotDir, `${id}.${profile}.jpg`), type: 'jpeg', quality: 88 });
  captured.add(`${id}.${profile}`);
  console.log(`  ${id}.${profile}.jpg`);
}
async function openMenu(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.locator('.menu-sheet[open]').waitFor();
}
// On a phone or tablet the side navigation is replaced by the Menu button and its sheet.
async function nav(page, tab, profile) {
  if (profile === 'phone') {
    await openMenu(page);
    await page.locator(`.menu-sheet .menu__item[data-tab="${tab}"]`).click();
    await page.locator('.menu-sheet').waitFor({ state: 'hidden' });
  } else {
    await page.locator(`.nav__item[data-tab="${tab}"]`).click();
  }
}
const settle = (page) => page.waitForTimeout(250);
async function openRow(page, profile, rowText, buttonName) {
  const row = page.locator('tr', { hasText: rowText }).first();
  await row.scrollIntoViewIfNeeded();
  if (profile === 'phone') await row.click();
  else await page.getByRole('button', { name: buttonName }).click();
}

async function customerShots(profile) {
  const h = await launch();
  const { context, page } = await h.open(profile, { reducedMotion: 'reduce' });
  await page.goto(`${h.base}/account/`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await snap(page, 'customer-sign-in', profile);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByRole('heading', { name: 'Create your account' }).waitFor();
  await snap(page, 'customer-create-account', profile);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Email').fill(DEMO.customerEmail);
  await page.getByLabel('Password', { exact: true }).fill(DEMO.customerPassword);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByRole('heading', { name: 'My orders' }).waitFor();
  await snap(page, 'customer-my-orders', profile);
  if (profile === 'phone') {
    await openMenu(page);
    await settle(page);
    await snap(page, 'customer-mobile-menu', profile);
    await page.keyboard.press('Escape');
    await page.locator('.menu-sheet').waitFor({ state: 'hidden' });
  }

  const waiting = page.locator('.order', { hasText: 'JK-261108-DEMO' });
  await waiting.locator('.order__toggle').click();
  await waiting.getByText('Deliver to').waitFor();
  await settle(page);
  await waiting.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -110));
  await snap(page, 'customer-order-details', profile);
  await waiting.getByRole('button', { name: 'Cancel this request' }).click();
  await page.getByRole('dialog').waitFor();
  await snap(page, 'customer-cancel-dialog', profile);
  await page.getByRole('dialog').getByRole('button', { name: 'Keep it' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });

  await nav(page, 'request', profile);
  await page.getByRole('heading', { name: 'Request an order' }).waitFor();
  await page.getByLabel('Quantity of Jels Clear Glass Pan 24cm').fill('2');
  await page.getByRole('button', { name: 'One more Jels Glass Teapot 1.2L' }).click();
  await page.getByLabel('Note for the store (optional)').fill('Please include a gift note.');
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap(page, 'customer-request-order', profile);
  await page.getByRole('button', { name: 'Send order request' }).click();
  await page.getByRole('heading', { name: 'Request sent' }).waitFor();
  await snap(page, 'customer-request-sent', profile);

  await nav(page, 'profile', profile);
  await page.getByRole('heading', { name: 'My details' }).waitFor();
  await snap(page, 'customer-my-details', profile);
  await nav(page, 'password', profile);
  await page.getByRole('heading', { name: 'Password', exact: true }).waitFor();
  await snap(page, 'customer-password', profile);
  await context.close();

  if (profile === 'desktop') {
    const dark = await h.open('desktop', { reducedMotion: 'reduce', colorScheme: 'dark' });
    await dark.page.goto(`${h.base}/account/`);
    await dark.page.getByLabel('Email').fill(DEMO.customerEmail);
    await dark.page.getByLabel('Password', { exact: true }).fill(DEMO.customerPassword);
    await dark.page.getByRole('button', { name: 'Sign in' }).click();
    await dark.page.getByRole('heading', { name: 'My orders' }).waitFor();
    await snap(dark.page, 'customer-my-orders-dark', 'desktop');
    await dark.context.close();
  }
  await h.close();
}

async function adminShots(profile) {
  const h = await launch();
  const { context, page } = await h.open(profile, { reducedMotion: 'reduce' });
  await page.goto(`${h.base}/admin/`);
  await page.getByRole('heading', { name: 'Admin sign-in' }).waitFor();
  await snap(page, 'admin-sign-in', profile);
  await page.getByLabel('Admin email').fill(DEMO.adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(DEMO.adminPassword);
  await page.getByLabel('Authenticator code').fill(await h.adminCode());
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Overview' }).waitFor();
  await snap(page, 'admin-overview', profile);
  if (profile === 'phone') {
    await openMenu(page);
    await settle(page);
    await snap(page, 'admin-mobile-menu', profile);
    await page.keyboard.press('Escape');
    await page.locator('.menu-sheet').waitFor({ state: 'hidden' });
  }

  await nav(page, 'orders', profile);
  await page.getByRole('heading', { name: 'Orders' }).first().waitFor();
  await snap(page, 'admin-orders', profile);
  await openRow(page, profile, 'JK-261108-DEMO', 'Open order JK-261108-DEMO');
  await page.getByRole('heading', { name: 'Order JK-261108-DEMO' }).waitFor();
  await page.getByLabel('Internal note (customers never see this)').fill('Call before delivery.');
  await settle(page);
  await snap(page, 'admin-order-detail', profile);

  await nav(page, 'customers', profile);
  await page.getByRole('heading', { name: 'Customers' }).first().waitFor();
  await snap(page, 'admin-customers', profile);
  await openRow(page, profile, 'Aisha Rahman', 'Open Aisha Rahman');
  await page.getByRole('heading', { name: 'Aisha Rahman' }).waitFor();
  await settle(page);
  await snap(page, 'admin-customer-detail', profile);

  await nav(page, 'products', profile);
  await page.getByRole('heading', { name: 'Products' }).first().waitFor();
  await snap(page, 'admin-products', profile);
  await openRow(page, profile, 'Jels Glass Teapot 1.2L', 'Edit Jels Glass Teapot 1.2L');
  await page.getByRole('heading', { name: 'Edit Jels Glass Teapot 1.2L' }).waitFor();
  await settle(page);
  await snap(page, 'admin-product-form', profile);

  await nav(page, 'activity', profile);
  await page.getByRole('heading', { name: 'Activity' }).first().waitFor();
  await snap(page, 'admin-activity', profile);
  await context.close();

  if (profile === 'desktop') {
    const dark = await h.open('desktop', { reducedMotion: 'reduce', colorScheme: 'dark' });
    await dark.page.goto(`${h.base}/admin/`);
    await dark.page.getByLabel('Admin email').fill(DEMO.adminEmail);
    await dark.page.getByLabel('Password', { exact: true }).fill(DEMO.adminPassword);
    await dark.page.getByLabel('Authenticator code').fill(await h.adminCode());
    await dark.page.getByRole('button', { name: 'Sign in' }).click();
    await dark.page.getByRole('heading', { name: 'Overview' }).waitFor();
    await snap(dark.page, 'admin-overview-dark', 'desktop');
    await dark.context.close();
  }
  await h.close();
}

function gallery() {
  const rel = (name) => relative(root, join(OUT, name)).split('\\').join('/');
  const img = (id, profile, width, alt) => `<img src="${rel(`${id}.${profile}.jpg`)}" width="${width}" alt="${alt}">`;
  const rows = SHOTS.map((s) => `| **${s.area}: ${s.tab}**<br><sub>${s.note}</sub> | ${s.phoneOnly ? '<sub>Phone and tablet only</sub>' : img(s.id, 'desktop', 520, `${s.area} ${s.tab}, desktop`)} | ${img(s.id, 'phone', 170, `${s.area} ${s.tab}, phone`)} |`);
  const dark = DARK_SHOTS.map((s) => `${img(s.id, 'desktop', 380, `${s.area} ${s.tab}`)}`).join(' ');
  const date = new Date().toISOString().slice(0, 10);
  return [
    '<!-- screenshots:start (generated by scripts/screenshots.mjs, do not edit by hand) -->',
    `_Captured ${date} from the local preview with demo data. Re-run \`node --no-warnings scripts/screenshots.mjs\` after every visual change._`,
    '',
    '| Tab | Desktop | Phone |',
    '| --- | --- | --- |',
    ...rows,
    '',
    '**Dark mode** follows the device setting:',
    '',
    dark,
    '<!-- screenshots:end -->',
  ].join('\n');
}

await mkdir(OUT, { recursive: true });
screenshotDir = OUT;
for (const profile of ['desktop', 'phone']) {
  console.log(`Customer dashboard (${profile})`);
  await customerShots(profile);
  console.log(`Admin dashboard (${profile})`);
  await adminShots(profile);
}
const expected = [...SHOTS.flatMap((s) => (s.phoneOnly ? [`${s.id}.phone`] : [`${s.id}.desktop`, `${s.id}.phone`])), ...DARK_SHOTS.map((s) => `${s.id}.desktop`)];
const missing = expected.filter((name) => !captured.has(name));
if (missing.length) {
  console.error(`Missing pictures: ${missing.join(', ')}`);
  process.exit(1);
}
if (UPDATE_README) {
  const text = await readFile(README, 'utf8');
  const block = /<!-- screenshots:start[\s\S]*?<!-- screenshots:end -->/;
  if (!block.test(text)) {
    console.error('README.md has no <!-- screenshots:start --> ... <!-- screenshots:end --> block to update.');
    process.exit(1);
  }
  await writeFile(README, text.replace(block, () => gallery()));
  console.log('README.md gallery updated.');
}
console.log(`${captured.size} pictures saved in ${relative(root, OUT)}/`);
