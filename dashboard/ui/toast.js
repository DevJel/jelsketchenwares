// Short confirmations that slide in and leave on their own. Screen readers hear them politely.
import { h } from '../core/dom.js';
import { Icon } from './icon.js';

let region;
function ensureRegion() {
  if (!region || !region.isConnected) {
    region = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(region);
  }
  return region;
}

/** toast('Saved.', 'ok') -- kind: ok | error | info */
export function toast(text, kind = 'ok', ms = 4500) {
  const dismiss = h('button', { type: 'button', class: 'toast__close', 'aria-label': 'Dismiss message' }, Icon('x', { size: 16 }));
  const el = h('div', { class: `toast toast--${kind}` }, Icon(kind === 'error' ? 'alert' : kind === 'info' ? 'info' : 'check', { size: 18 }), h('span', { class: 'toast__text', text }), dismiss);
  const leave = () => {
    if (!el.isConnected || el.classList.contains('is-leaving')) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  };
  dismiss.addEventListener('click', leave);
  ensureRegion().append(el);
  setTimeout(leave, ms);
  return el;
}
