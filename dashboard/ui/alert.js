// Inline messages. Alert() is a live region that is filled in when something happens;
// Notice() is a fixed message that is always shown.
import { cx, h } from '../core/dom.js';
import { Icon } from './icon.js';

/** A message area that screen readers announce when it changes. kind: error | ok | info */
export function Alert({ role = 'alert' } = {}) {
  const el = h('p', { class: 'alert', role, hidden: true });
  return {
    el,
    show(text, kind = 'error') {
      if (!text) return this.hide();
      el.textContent = text;
      el.className = `alert alert--${kind}`;
      el.hidden = false;
    },
    hide() {
      el.textContent = '';
      el.hidden = true;
    },
  };
}

/** A message that is always visible. kind: info | ok | warn | error */
export function Notice({ kind = 'info', text, icon = kind === 'ok' ? 'check' : kind === 'info' ? 'info' : 'alert', class: extra }) {
  return h('div', { class: cx('notice', `notice--${kind}`, extra) }, Icon(icon, { size: 18 }), h('p', { text }));
}
