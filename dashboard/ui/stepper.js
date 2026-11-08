// Shows how far an order has come: Requested > Confirmed > Packed > Shipped > Delivered.
import { cx, h } from '../core/dom.js';
import { Icon } from './icon.js';

/** Stepper({ steps: [{ id, label }], current }) */
export function Stepper({ steps, current, label = 'Order progress' }) {
  const index = steps.findIndex((s) => s.id === current);
  const list = h(
    'ol',
    { class: 'stepper', 'aria-label': label },
    steps.map((step, i) => {
      const li = h(
        'li',
        { class: cx('stepper__step', i < index && 'is-done', i === index && 'is-current'), 'aria-current': i === index ? 'step' : null },
        h('span', { class: 'stepper__dot' }, i < index ? Icon('check', { size: 14 }) : String(i + 1)),
        h('span', { class: 'stepper__label', text: step.label })
      );
      li.style.setProperty('--i', String(i)); // staggers the connector animation
      return li;
    })
  );
  return list;
}
