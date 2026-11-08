// Browser test of both dashboards against the local preview (demo data, nothing real).
//   node --no-warnings tests/e2e/dashboards.e2e.mjs
// Needs Playwright and Node 22.5+. Pages run under the production Content-Security-Policy from
// _headers, so a page that needs an inline script or style fails here.
import { DEMO, launch, signInAdmin, signInCustomer } from './harness.mjs';

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok: Boolean(ok) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra && !ok ? `  -> ${extra}` : ''}`);
};

// Every flow gets its own preview server, so the demo data starts fresh each time.
const unlabeled = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('input:not([type=hidden]), select, textarea')]
      .filter((el) => !(el.labels && el.labels.length) && !el.getAttribute('aria-label'))
      .map((el) => el.outerHTML.slice(0, 90))
  );
const tablesFit = (page) => page.evaluate(() => [...document.querySelectorAll('.table-wrap')].every((el) => el.scrollWidth <= el.clientWidth + 1));
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
// On a phone or tablet the side navigation is replaced by a Menu button that opens a sheet.
async function openMenu(page) {
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.locator('.menu-sheet[open]').waitFor();
}
async function goTab(page, profile, tab) {
  if (profile === 'phone') {
    await openMenu(page);
    await page.locator(`.menu-sheet .menu__item[data-tab="${tab}"]`).click();
    await page.locator('.menu-sheet').waitFor({ state: 'hidden' });
  } else {
    await page.locator(`.nav__item[data-tab="${tab}"]`).click();
  }
}
async function signOut(page, profile) {
  if (profile === 'phone') {
    await openMenu(page);
    await page.locator('.menu-sheet').getByRole('button', { name: 'Sign out' }).click();
  } else {
    await page.locator('.topbar').getByRole('button', { name: 'Sign out' }).click();
  }
}
// A table row: on a phone you tap the row itself; on a computer you use its Open / Edit button.
async function openRow(page, profile, rowText, buttonName) {
  const row = page.locator('tr', { hasText: rowText }).first();
  await row.scrollIntoViewIfNeeded();
  if (profile === 'phone') await row.click();
  else await page.getByRole('button', { name: buttonName }).click();
}
const visible = (locator) => locator.first().isVisible().catch(() => false);

async function customerFlow(profile) {
  const t = `[customer ${profile}]`;
  const h = await launch();
  const { context, page, problems } = await h.open(profile);
  await page.goto(`${h.base}/account/`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  check(`${t} sign-in shows, every field labelled`, (await unlabeled(page)).length === 0);

  // The password Show / Hide button works
  const pw = page.getByLabel('Password', { exact: true });
  await pw.fill('secret-words');
  await page.getByRole('button', { name: 'Show' }).click();
  check(`${t} Show button reveals the password`, (await pw.getAttribute('type')) === 'text');
  await page.getByRole('button', { name: 'Hide' }).click();

  await page.getByLabel('Email').fill(DEMO.customerEmail);
  await pw.fill('wrong-password-here');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByText('Email or password is incorrect.').waitFor();
  check(`${t} wrong password shows a clear error`, true);

  await pw.fill(DEMO.customerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'My orders' }).waitFor();
  check(`${t} signs in and lists orders`, (await page.locator('.order').count()) === 3);
  check(`${t} newest order is first`, (await page.locator('.order').first().innerText()).includes('JK-261108-DEMO'));
  await page.waitForFunction(() => document.querySelector('.stat')?.querySelector('.stat__value')?.textContent === '2');
  check(`${t} stats count up to the right numbers`, true);

  // Buttons are not repeated: on a phone everything lives in the Menu; on a computer the Menu is hidden.
  const sideNav = page.locator('nav.nav');
  const menuBtn = page.getByRole('button', { name: 'Menu', exact: true });
  const topSignOut = page.locator('.topbar').getByRole('button', { name: 'Sign out' });
  const headerAction = page.locator('main').getByRole('button', { name: 'Request an order' });
  if (profile === 'phone') {
    check(`${t} phone shows one Menu button instead of the side navigation`, (await visible(menuBtn)) && !(await visible(sideNav)));
    check(`${t} phone does not repeat Sign out or Request an order outside the menu`, !(await visible(topSignOut)) && !(await visible(headerAction)));
  } else {
    check(`${t} computer shows the side navigation and no Menu button`, (await visible(sideNav)) && !(await visible(menuBtn)));
    check(`${t} computer shows Sign out and Request an order`, (await visible(topSignOut)) && (await visible(headerAction)));
  }
  check(`${t} there is no separate Details button on each order`, (await page.getByRole('button', { name: 'Details', exact: true }).count()) === 0);
  if (profile === 'phone') {
    await openMenu(page);
    const sheet = page.locator('.menu-sheet');
    check(`${t} menu lists every section, the person and Sign out`, (await sheet.locator('.menu__item').count()) === 4 && (await sheet.getByText('Aisha Rahman').count()) === 1 && (await sheet.getByRole('button', { name: 'Sign out' }).count()) === 1);
    check(`${t} menu marks the current section`, (await sheet.locator('.menu__item[aria-current="page"]').innerText()).includes('My orders'));
    check(`${t} menu fits the screen`, await noSideScroll(page));
    check(`${t} menu button reports open`, (await menuBtn.getAttribute('aria-expanded')) === 'true');
    await page.keyboard.press('Escape');
    await page.locator('.menu-sheet').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => document.querySelector('.topbar__menu')?.getAttribute('aria-expanded') === 'false');
    check(`${t} Esc closes the menu and returns focus to the Menu button`, await page.evaluate(() => document.activeElement?.classList.contains('topbar__menu')));
    await openMenu(page);
    await page.mouse.click(8, 780); // the dimmed area below the menu
    await page.locator('.menu-sheet').waitFor({ state: 'hidden' });
    check(`${t} tapping outside closes the menu`, true);
  }

  const waiting = page.locator('.order', { hasText: 'JK-261108-DEMO' });
  await waiting.locator('.order__toggle').click();
  await waiting.getByText('Deliver to').waitFor();
  check(`${t} tapping an order opens its details with delivery info and progress`, (await waiting.getByText('12 Jalan Bunga').count()) > 0 && (await waiting.locator('.stepper').count()) === 1 && (await waiting.locator('.order__toggle').getAttribute('aria-expanded')) === 'true');
  await waiting.locator('.order__toggle').click();
  await page.waitForFunction(() => document.querySelector('.order .order__toggle[aria-expanded="false"]'));
  check(`${t} tapping it again closes the details`, (await waiting.locator('.order__toggle').getAttribute('aria-expanded')) === 'false');

  await goTab(page, profile, 'request');
  await page.getByRole('heading', { name: 'Request an order' }).waitFor();
  check(`${t} delivery details are prefilled`, (await page.getByLabel('Address line 1').inputValue()) === '12 Jalan Bunga');
  await page.getByRole('button', { name: 'Send order request' }).click();
  await page.getByText('Choose at least one product').waitFor();
  check(`${t} refuses an empty request`, true);
  await page.getByRole('button', { name: 'One more Jels Glass Teapot 1.2L' }).click();
  await page.getByLabel('Quantity of Jels Clear Glass Pan 24cm').fill('2');
  check(`${t} total preview updates`, (await page.locator('.total-bar').innerText()).includes('$137.00'), await page.locator('.total-bar').innerText());
  await page.getByRole('button', { name: 'Send order request' }).click();
  await page.getByRole('heading', { name: 'Request sent' }).waitFor();
  check(`${t} sends an order request`, (await page.getByText(/JK-\d{6}-[A-Z0-9]{4}/).count()) > 0);

  await page.getByRole('button', { name: 'See my orders' }).click();
  await page.getByRole('heading', { name: 'My orders' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.order').length === 4);
  check(`${t} new request appears in My orders`, true);

  const mine = page.locator('.order').first();
  await mine.locator('.order__toggle').click();
  await mine.getByRole('button', { name: 'Cancel this request' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Keep it' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  check(`${t} "Keep it" leaves the request alone`, (await mine.locator('.status-requested').count()) === 1);
  await mine.getByRole('button', { name: 'Cancel this request' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, cancel it' }).click();
  await page.locator('.order').first().locator('.status-cancelled').waitFor();
  check(`${t} customer can cancel a waiting request`, true);

  await goTab(page, profile, 'profile');
  await page.getByRole('heading', { name: 'My details' }).waitFor();
  await page.getByLabel('Phone').fill('+60 19 876 5432');
  await page.getByRole('button', { name: 'Save my details' }).click();
  await page.getByText('Your details are saved.').waitFor();
  check(`${t} saves profile`, true);

  await goTab(page, profile, 'password');
  await page.getByLabel('Current password').fill('not-my-password');
  await page.getByLabel('New password').fill('another-long-passphrase-77');
  await page.getByRole('button', { name: 'Change password' }).click();
  await page.getByText('Your current password is incorrect.').waitFor();
  check(`${t} wrong current password gives an error and keeps you signed in`, (await page.getByRole('heading', { name: 'Sign in' }).count()) === 0);

  check(`${t} deep link reopens a tab after reload`, await (async () => {
    await page.reload();
    await page.getByRole('heading', { name: 'Password' }).first().waitFor();
    return page.url().endsWith('#password');
  })());

  await signOut(page, profile);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  check(`${t} signs out`, true);

  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill('Eve Tan');
  await page.getByLabel('Email').fill(`eve-${profile}@demo.local`);
  await page.getByLabel('Choose a password').fill('eve-long-passphrase-2026');
  await page.getByRole('button', { name: 'Create my account' }).click();
  await page.getByRole('heading', { name: 'My orders' }).waitFor();
  check(`${t} creates an account and lands signed in`, (await page.getByText('You have not sent any order requests yet.').count()) > 0);
  check(`${t} no sideways scrolling`, await noSideScroll(page));
  check(`${t} no script errors or CSP violations`, problems.length === 0, problems.join(' | '));
  await context.close();
  await h.close();
}

async function adminFlow(profile) {
  const t = `[admin ${profile}]`;
  const h = await launch();
  const { context, page, problems } = await h.open(profile);
  await page.goto(`${h.base}/admin/`);
  await page.getByRole('heading', { name: 'Admin sign-in' }).waitFor();
  check(`${t} sign-in shows, every field labelled`, (await unlabeled(page)).length === 0);
  await page.getByLabel('Admin email').fill(DEMO.adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(DEMO.adminPassword);
  await page.getByLabel('Authenticator code').fill('000000');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByText('Those sign-in details are incorrect.').waitFor();
  check(`${t} wrong authenticator code is refused`, true);
  await page.getByLabel('Password', { exact: true }).fill(DEMO.adminPassword);
  await page.getByLabel('Authenticator code').fill(await h.adminCode());
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Overview' }).waitFor();
  check(`${t} signs in with password + authenticator code`, true);
  await page.waitForFunction(() => document.querySelector('.stat')?.querySelector('.stat__value')?.textContent === '2');
  check(`${t} overview shows live numbers and the pipeline`, (await page.locator('.stat').count()) === 8 && (await page.locator('.pipeline__seg').count()) === 6);
  if (profile === 'phone') {
    check(`${t} phone shows one Menu button instead of the side navigation`, (await visible(page.getByRole('button', { name: 'Menu', exact: true }))) && !(await visible(page.locator('nav.nav'))));
    check(`${t} phone does not repeat Sign out in the top bar`, !(await visible(page.locator('.topbar').getByRole('button', { name: 'Sign out' }))));
    const actionCell = await page.locator('tr', { hasText: 'JK-261108-DEMO' }).first().locator('td.is-action').boundingBox();
    check(`${t} per-row Open buttons are hidden from view (rows are tappable)`, actionCell && actionCell.width <= 2 && actionCell.height <= 2, JSON.stringify(actionCell));
    await page.getByRole('button', { name: 'Open order JK-261108-DEMO' }).focus();
    const focusedCell = await page.locator('tr', { hasText: 'JK-261108-DEMO' }).first().locator('td.is-action').boundingBox();
    check(`${t} a keyboard user still sees the Open button when it is focused`, focusedCell && focusedCell.width > 20, JSON.stringify(focusedCell));
    await openMenu(page);
    check(`${t} menu lists the five sections and Sign out`, (await page.locator('.menu-sheet .menu__item').count()) === 5 && (await page.locator('.menu-sheet').getByRole('button', { name: 'Sign out' }).count()) === 1);
    await page.keyboard.press('Escape');
    await page.locator('.menu-sheet').waitFor({ state: 'hidden' });
  } else {
    check(`${t} computer shows the side navigation and Sign out`, (await visible(page.locator('nav.nav'))) && (await visible(page.locator('.topbar').getByRole('button', { name: 'Sign out' }))) && !(await visible(page.getByRole('button', { name: 'Menu', exact: true }))));
  }

  await goTab(page, profile, 'orders');
  await page.getByRole('heading', { name: 'Orders' }).first().waitFor();
  await page.getByLabel('Show').selectOption('requested');
  await page.waitForFunction(() => document.querySelectorAll('.table tbody tr').length === 2);
  check(`${t} filter lists only waiting requests`, true);
  check(`${t} orders table fits without sideways scroll`, await tablesFit(page));
  await openRow(page, profile, 'JK-261108-DEMO', 'Open order JK-261108-DEMO');
  await page.getByRole('heading', { name: 'Order JK-261108-DEMO' }).waitFor();
  check(`${t} order detail shows progress and items`, (await page.locator('#order-detail .stepper').count()) === 1 && (await page.locator('#order-detail .items tbody tr').count()) === 2);
  check(`${t} order opens as a deep link`, page.url().includes('#orders/'));
  await page.getByLabel('Internal note (customers never see this)').fill('Call before delivery');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.getByText('Note saved.').waitFor();
  check(`${t} saves an internal note`, true);
  await page.getByRole('button', { name: 'Mark as Confirmed' }).click();
  await page.getByText(/is now confirmed/).waitFor();
  check(`${t} moves an order to Confirmed`, (await page.locator('#order-detail .status-confirmed').count()) > 0);
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Keep the order' }).click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  check(`${t} cancelling asks first, and "Keep the order" keeps it`, (await page.locator('#order-detail .status-confirmed').count()) > 0);

  await goTab(page, profile, 'customers');
  await page.getByRole('heading', { name: 'Customers' }).first().waitFor();
  check(`${t} customers table fits without sideways scroll`, await tablesFit(page));
  await openRow(page, profile, 'Aisha Rahman', 'Open Aisha Rahman');
  await page.getByRole('heading', { name: 'Aisha Rahman' }).waitFor();
  await page.getByRole('button', { name: 'Reset password' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Create temporary password' }).click();
  await page.locator('.secret').waitFor();
  const temp = await page.locator('.secret').innerText();
  check(`${t} reset password shows a one-time password`, temp.length >= 10, `${temp.length} chars`);
  await openRow(page, profile, 'Ben Tan', 'Open Ben Tan');
  await page.getByRole('heading', { name: 'Ben Tan' }).waitFor();
  await page.getByRole('button', { name: 'Disable account' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Disable account' }).click();
  await page.getByRole('button', { name: 'Enable account' }).waitFor();
  check(`${t} disables an account after confirming`, true);
  await page.getByRole('button', { name: 'Enable account' }).click();
  await page.getByRole('button', { name: 'Disable account' }).waitFor();
  check(`${t} enables it again`, true);

  await goTab(page, profile, 'products');
  await page.getByRole('heading', { name: 'Products' }).first().waitFor();
  await openRow(page, profile, 'Jels Glass Teapot 1.2L', 'Edit Jels Glass Teapot 1.2L');
  await page.getByLabel('Price (US dollars)').fill('41.50');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.locator('tr', { hasText: 'Jels Glass Teapot 1.2L' }).getByText('$41.50').waitFor();
  check(`${t} edits a product price`, true);
  await page.getByRole('button', { name: 'Add a product' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Jels Glass Butter Dish');
  await page.getByLabel('Price (US dollars)').fill('abc');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.getByText('Enter the price as a number').waitFor();
  check(`${t} rejects a bad price`, true);
  await page.getByLabel('Price (US dollars)').fill('18');
  await page.getByRole('button', { name: 'Add product' }).click();
  await page.locator('tr', { hasText: 'Jels Glass Butter Dish' }).waitFor();
  check(`${t} adds a product`, true);

  await goTab(page, profile, 'activity');
  await page.getByRole('heading', { name: 'Activity' }).first().waitFor();
  check(`${t} activity log lists the changes just made`, (await page.getByText('customer.password_reset').count()) > 0 && (await page.getByText('order.status').count()) > 0);
  check(`${t} no sideways scrolling`, await noSideScroll(page));
  check(`${t} no script errors or CSP violations`, problems.length === 0, problems.join(' | '));
  await signOut(page, profile);
  await page.getByRole('heading', { name: 'Admin sign-in' }).waitFor();
  check(`${t} signs out`, true);
  await context.close();
  await h.close();
}

async function accessibilityAndTheme() {
  const h = await launch();
  // Keyboard: Tab reaches the skip link first, and a focused button shows a visible ring.
  const a = await h.open('desktop');
  await a.page.goto(`${h.base}/account/`);
  await a.page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await a.page.locator('.skip').focus();
  check('[a11y] skip link slides into view when focused', (await a.page.locator('.skip').evaluate((el) => el.getBoundingClientRect().top)) >= 0);
  await a.page.keyboard.press('Enter');
  check('[a11y] skip link moves focus to the content without changing the page', (await a.page.evaluate(() => document.activeElement?.id)) === 'main' && !a.page.url().includes('#main'));
  await a.context.close();

  // Reduced motion: animations collapse to nothing but the content is still there.
  const r = await h.open('desktop', { reducedMotion: 'reduce' });
  await signInCustomer(r.page, h.base);
  const dur = await r.page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.reveal')).animationDuration));
  check('[motion] reduced-motion setting removes animation time', dur < 0.01, String(dur));
  check('[motion] content is fully visible with reduced motion', (await r.page.locator('.order').first().evaluate((el) => getComputedStyle(el).opacity)) === '1');
  await r.context.close();

  // Dark mode follows the device setting.
  const d = await h.open('desktop', { colorScheme: 'dark' });
  await signInCustomer(d.page, h.base);
  const bg = await d.page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  const ink = await d.page.evaluate(() => getComputedStyle(document.body).color);
  check('[theme] dark mode uses a dark page and light text', bg === 'rgb(20, 17, 13)' && ink === 'rgb(243, 237, 225)', `${bg} / ${ink}`);
  check('[theme] dark mode has no script errors', d.problems.length === 0, d.problems.join(' | '));
  await d.context.close();

  await h.close();
}

try {
  await customerFlow('desktop');
  await customerFlow('phone');
  await adminFlow('desktop');
  await adminFlow('phone');
  await accessibilityAndTheme();
} catch (error) {
  check('tests completed without throwing', false, error.message.split('\n').slice(0, 4).join(' | '));
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
