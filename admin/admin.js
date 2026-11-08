// Admin dashboard: sign in (password + authenticator code), overview, orders, customers,
// products and activity. Data comes from /api/admin/*. Views live in ./views/.
import { ApiError, api } from '/dashboard/core/api.js';
import { currentRoute, go, onRouteChange } from '/dashboard/core/router.js';
import { h } from '/dashboard/core/dom.js';
import { createShell } from '/dashboard/shell/shell.js';
import { Card, Notice, toast } from '/dashboard/ui/index.js';
import { activityView } from './views/activity.js';
import { customersView } from './views/customers.js';
import { loginView } from './views/login.js';
import { ordersView } from './views/orders.js';
import { overviewView } from './views/overview.js';
import { productsView } from './views/products.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'orders', label: 'Orders', icon: 'bag' },
  { id: 'customers', label: 'Customers', icon: 'users' },
  { id: 'products', label: 'Products', icon: 'box' },
  { id: 'activity', label: 'Activity', icon: 'activity' },
];
const VIEWS = { overview: overviewView, orders: ordersView, customers: customersView, products: productsView, activity: activityView };

const shell = createShell({ area: 'Store admin', navLabel: 'Admin sections' });

let admin = null;
let pendingNotice = '';

const ctx = {
  shell,
  go,
  get admin() {
    return admin;
  },
  refresh: () => render(),
  signedIn(person) {
    admin = person;
    shell.setUser({ name: admin.email }, signOut);
    go('overview');
  },
  /** One answer for a failed request: back to sign-in if the session ended, else show the message. */
  fail(error, alert) {
    if (error instanceof ApiError && error.status === 401) return expire();
    if (alert) alert.show(error.message);
    else toast(error.message, 'error');
    return undefined;
  },
};

function showLogin() {
  shell.showNav(false);
  shell.setUser(null);
  const notice = pendingNotice;
  pendingNotice = '';
  const view = loginView(ctx, notice);
  shell.setView(view, { focus: false });
  view.focusFirst();
}

function expire(message = 'Your session ended. Please sign in again.') {
  admin = null;
  pendingNotice = message;
  showLogin();
}

async function signOut() {
  try {
    await api('POST', '/api/admin/logout', {});
  } catch {
    // The cookie expires on its own either way.
  }
  expire('You have signed out.');
  history.replaceState(null, '', location.pathname);
}

function render() {
  if (!admin) return showLogin();
  const { name, arg } = currentRoute();
  const view = VIEWS[name] ? name : 'overview';
  shell.showNav(true);
  shell.setCurrent(view);
  return shell.show(() => VIEWS[view](ctx, arg), {
    onError(error) {
      if (error instanceof ApiError && error.status === 401) return expire();
      return shell.setView(h('div', { class: 'stack' }, Card({}, Notice({ kind: 'error', text: error.message }))));
    },
  });
}

(async function boot() {
  shell.setTabs(TABS, (id) => go(id));
  onRouteChange(() => render());
  try {
    admin = (await api('GET', '/api/admin/me')).admin;
    shell.setUser({ name: admin.email }, signOut);
    if (!VIEWS[currentRoute().name]) history.replaceState(null, '', '#overview');
    render();
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      shell.showNav(false);
      shell.setView(h('div', { class: 'auth' }, Card({ title: 'Not set up yet', subtitle: 'The store database or the admin sign-in has not been set up. The setup steps are in docs/deployment.md.', tone: 'strong' })));
      return;
    }
    showLogin();
  }
})();
