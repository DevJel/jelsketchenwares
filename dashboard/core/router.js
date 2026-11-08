// Hash routing: /account/#orders, /admin/#orders/12. Deep links work, the back button works,
// and nothing needs server support.

/** "#orders/12" -> { name: 'orders', arg: '12' } */
export function currentRoute() {
  const [name = '', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { name, arg };
}

const hashFor = (name, arg) => `#${name}${arg ? `/${arg}` : ''}`;

/** Goes to a view. If we are already there, asks for a fresh render instead. */
export function go(name, arg = '') {
  const target = hashFor(name, arg);
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = target;
}

/** Updates the address bar without re-rendering (used when a detail panel opens inside a view). */
export function setHash(name, arg = '') {
  history.replaceState(null, '', hashFor(name, arg));
}

export const onRouteChange = (handler) => window.addEventListener('hashchange', handler);
