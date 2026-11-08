// Button. Variants: primary, ghost, quiet, danger (outlined), danger-solid. Sizes: md, sm.
import { cx, h } from '../core/dom.js';
import { Icon } from './icon.js';

export function Button({ label, variant = 'primary', size = 'md', type = 'button', icon, onClick, full = false, class: extra, ...attrs } = {}) {
  const el = h(
    'button',
    { type, class: cx('btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, full && 'btn--full', !label && 'btn--icon', extra), ...attrs },
    icon ? Icon(icon, { size: size === 'sm' ? 16 : 18 }) : null,
    label ? h('span', { class: 'btn__label', text: label }) : null
  );
  if (onClick) el.addEventListener('click', onClick);
  return el;
}

/** Changes the visible words on a button, keeping its icon. */
export function setLabel(button, text) {
  const target = button.querySelector('.btn__label');
  if (target) target.textContent = text;
}

/**
 * Runs `work` while the button shows a busy state, so it cannot be double-submitted.
 * The label is restored afterwards, even if `work` throws.
 */
export async function withBusy(button, work, busyLabel) {
  const target = button.querySelector('.btn__label');
  const original = target ? target.textContent : '';
  button.disabled = true;
  button.classList.add('is-busy');
  button.setAttribute('aria-busy', 'true');
  if (busyLabel) setLabel(button, busyLabel);
  try {
    return await work();
  } finally {
    button.disabled = false;
    button.classList.remove('is-busy');
    button.removeAttribute('aria-busy');
    if (target) target.textContent = original;
  }
}
