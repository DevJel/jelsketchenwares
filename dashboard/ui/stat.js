// A big number with a label. Numbers count up when they appear (not for reduced-motion users).
import { cx, h, prefersReducedMotion } from '../core/dom.js';
import { Icon } from './icon.js';

/** Stat({ label, value, format, icon, tone: 'default' | 'gold' | 'ok' | 'info' | 'violet' | 'teal', hint }) */
export function Stat({ label, value, format = (n) => String(n), icon, tone = 'default', hint }) {
  const number = h('strong', { class: 'stat__value', text: format(value) });
  const el = h(
    'div',
    { class: cx('stat', `stat--${tone}`), 'data-value': String(value) },
    icon ? h('span', { class: 'stat__icon' }, Icon(icon, { size: 20 })) : null,
    h('div', { class: 'stat__body' }, number, h('span', { class: 'stat__label', text: label }), hint ? h('span', { class: 'stat__hint', text: hint }) : null)
  );
  if (typeof value === 'number' && value > 0 && !prefersReducedMotion()) {
    const started = performance.now();
    const duration = 750;
    const tick = (now) => {
      const progress = Math.min(1, (now - started) / duration);
      number.textContent = format(progress < 1 ? Math.round(value * (1 - (1 - progress) ** 3)) : value);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  return el;
}
