// Customer dashboard: sign in or create an account, see order requests, request an order,
// edit details, change password. Data comes from /api/customer/*. Views live in ./views/.
import { ApiError, api } from '/dashboard/core/api.js';
import { currentRoute, go, onRouteChange } from '/dashboard/core/router.js';
import { h } from '/dashboard/core/dom.js';
import { createShell } from '/dashboard/shell/shell.js';
import { Card, Notice, toast } from '/dashboard/ui/index.js';
import { authView } from './views/auth.js';
import { ordersView } from './views/orders.js';
import { passwordView } from './views/password.js';
import { profileView } from './views/profile.js';
import { requestView } from './views/request.js';

const TABS = [
  { id: 'orders', label: 'My orders', icon: 'bag' },
  { id: 'request', label: 'Request an order', icon: 'plus' },
  { id: 'profile', label: 'My details', icon: 'user' },
  { id: 'password', label: 'Password', icon: 'lock' },
];
const VIEWS = { orders: ordersView, request: requestView, profile: profileView, password: (ctx) => passwordView(ctx) };

const shell = createShell({
  area: 'My account',
  navLabel: 'My account sections',
  footer: 'No payment is taken on this site. The store contacts you to confirm payment and delivery for every order request.',
});

let me = null;
let pendingNotice = '';

const ctx = {
  shell,
  go,
  get me() {
    return me;
  },
  setMe(customer) {
    me = customer;
    shell.setUser(me, signOut);
  },
  async reloadMe() {
    ctx.setMe((await api('GET', '/api/customer/me')).customer);
  },
  refresh: () => render(),
  /** Called after a successful sign-in or registration. */
  signedIn(customer) {
    ctx.setMe(customer);
    go(customer.mustChangePassword ? 'password' : 'orders');
  },
  showAuth,
  /** One answer for a failed request: back to sign-in if the session ended, else show the message. */
  fail(error, alert) {
    if (error instanceof ApiError && error.status === 401) return expire();
    if (alert) alert.show(error.message);
    else toast(error.message, 'error');
    return undefined;
  },
};

function showAuth(mode = 'login') {
  shell.showNav(false);
  shell.setUser(null);
  const notice = pendingNotice;
  pendingNotice = '';
  const view = authView(ctx, mode, notice);
  shell.setView(view, { focus: false });
  view.focusFirst();
}

function expire(message = 'Your session ended. Please sign in again.') {
  me = null;
  pendingNotice = message;
  showAuth('login');
}

async function signOut() {
  try {
    await api('POST', '/api/customer/logout', {});
  } catch {
    // Even if the request fails the cookie expires on its own.
  }
  expire('You have signed out.');
  history.replaceState(null, '', location.pathname);
}

async function render() {
  if (!me) return showAuth('login');
  if (me.mustChangePassword) {
    shell.showNav(false);
    return shell.show(() => passwordView(ctx, { forced: true }), { onError: (e) => ctx.fail(e) });
  }
  const { name } = currentRoute();
  const view = VIEWS[name] ? name : 'orders';
  shell.showNav(true);
  shell.setCurrent(view);
  return shell.show(() => VIEWS[view](ctx), {
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
    me = (await api('GET', '/api/customer/me')).customer;
    shell.setUser(me, signOut);
    if (!VIEWS[currentRoute().name]) history.replaceState(null, '', '#orders');
    render();
  } catch (error) {
    if (error instanceof ApiError && error.status === 503) {
      shell.showNav(false);
      shell.setView(h('div', { class: 'auth' }, Card({ title: 'Accounts are not open yet', subtitle: 'This part of the store is being set up. Please check back soon.', tone: 'strong' })));
      return;
    }
    showAuth('login');
  }
})();
