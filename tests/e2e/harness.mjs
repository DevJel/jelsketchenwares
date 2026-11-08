// Shared setup for the browser tests and the screenshot script.
// Needs Playwright (https://playwright.dev) and Node 22.5+. Not run in CI: see docs/dashboards.md (Testing).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO, startDevServer } from '../../scripts/dev-server.mjs';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export { DEMO };

/** The Content-Security-Policy the pages get in production, read from _headers. */
function productionCsp() {
  const match = /\/account\/\*\n\s+Content-Security-Policy: (.+)/.exec(readFileSync(join(root, '_headers'), 'utf8'));
  if (!match) throw new Error('Could not find the account Content-Security-Policy in _headers');
  return match[1];
}

/** Starts the local preview and a browser. Pages opened with it run under the production CSP. */
export async function launch({ port = 0 } = {}) {
  const { chromium, devices } = require('playwright');
  const server = await startDevServer({ port });
  const base = `http://127.0.0.1:${server.port}`;
  const browser = await chromium.launch();
  const csp = productionCsp();

  /** profile: 'desktop' | 'phone'. Extra options go to browser.newContext (for example colorScheme). */
  async function open(profile = 'desktop', options = {}) {
    const device = profile === 'phone' ? { ...devices['Pixel 7'] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
    const context = await browser.newContext({ ...device, ...options });
    await context.route(/\/(account|admin)\/(index\.html)?(\?.*)?$/, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
    });
    const page = await context.newPage();
    const problems = [];
    // Expected: the pages ask "who am I?" before sign-in and some tests try wrong passwords, so a
    // failed 4xx request is normal. Anything else (script errors, CSP violations) is a problem.
    page.on('console', (m) => {
      if (!['error', 'warning'].includes(m.type())) return;
      if (/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) return;
      problems.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    return { context, page, problems };
  }

  return {
    base,
    open,
    browser,
    /** A fresh single-use authenticator code for the demo admin. */
    adminCode: async () => (await (await fetch(`${base}/__dev/admin-code`)).json()).code,
    close: async () => {
      await browser.close();
      await server.close();
    },
  };
}

export async function signInCustomer(page, base, { email = DEMO.customerEmail, password = DEMO.customerPassword } = {}) {
  await page.goto(`${base}/account/`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'My orders' }).waitFor();
}

export async function signInAdmin(page, base, adminCode) {
  await page.goto(`${base}/admin/`);
  await page.getByLabel('Admin email').fill(DEMO.adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(DEMO.adminPassword);
  await page.getByLabel('Authenticator code').fill(await adminCode());
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Overview' }).waitFor();
}
