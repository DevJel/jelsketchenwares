// Form controls. Every control gets a visible label linked by id, and an optional hint.
import { cx, h, uid } from '../core/dom.js';

/**
 * A labelled input, select or textarea.
 * Field({ label, hint, tag: 'input' | 'select' | 'textarea', options: [[value, text]], value, ...attributes })
 * Returns { el, input }.
 */
export function Field({ label, hint, tag = 'input', options = [], value, class: extra, ...attrs }) {
  const id = uid('field');
  let input;
  if (tag === 'select') {
    input = h('select', { id, ...attrs }, options.map(([v, text]) => h('option', { value: v, text })));
  } else if (tag === 'textarea') {
    input = h('textarea', { id, rows: 3, ...attrs });
  } else {
    input = h('input', { id, ...attrs });
  }
  if (value !== undefined && value !== null) input.value = value;
  const hintEl = hint ? h('p', { class: 'field__hint', id: `${id}-hint`, text: hint }) : null;
  if (hintEl) input.setAttribute('aria-describedby', hintEl.id);
  const el = h('div', { class: cx('field', extra) }, h('label', { for: id, text: label }), h('div', { class: 'field__control' }, input), hintEl);
  return { el, input };
}

/** A password field with a Show / Hide button inside it. */
export function PasswordField({ label, hint, autocomplete = 'current-password', ...attrs }) {
  const field = Field({ label, hint, type: 'password', autocomplete, ...attrs });
  const toggle = h('button', { type: 'button', class: 'field__toggle', 'aria-controls': field.input.id, 'aria-pressed': 'false', text: 'Show' });
  toggle.addEventListener('click', () => {
    const showing = field.input.type === 'password';
    field.input.type = showing ? 'text' : 'password';
    toggle.textContent = showing ? 'Hide' : 'Show';
    toggle.setAttribute('aria-pressed', String(showing));
  });
  field.el.querySelector('.field__control').append(toggle);
  field.el.classList.add('field--has-toggle');
  return field;
}

/** A checkbox with its label. Returns { el, input }. */
export function Checkbox({ label, checked = false, ...attrs }) {
  const id = uid('check');
  const input = h('input', { type: 'checkbox', id, ...attrs });
  input.checked = checked;
  return { el: h('div', { class: 'check' }, input, h('label', { for: id, text: label })), input };
}
