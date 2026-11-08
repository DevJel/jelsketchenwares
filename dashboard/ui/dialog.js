// A confirmation box built on the native <dialog> element, so focus stays inside it,
// Escape closes it, and everything behind it is inert while it is open.
import { h, uid } from '../core/dom.js';
import { Button } from './button.js';

/**
 * confirmDialog({ title, body, confirmLabel, cancelLabel, tone: 'danger' | 'primary' })
 * Resolves true if the person confirmed, false otherwise. The safe choice has the focus.
 */
export function confirmDialog({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Go back', tone = 'danger' }) {
  return new Promise((resolve) => {
    const titleId = uid('dialog-title');
    const bodyId = uid('dialog-body');
    const cancel = Button({ label: cancelLabel, variant: 'ghost' });
    const confirm = Button({ label: confirmLabel, variant: tone === 'danger' ? 'danger-solid' : 'primary' });
    const dialog = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': titleId, 'aria-describedby': bodyId },
      h('div', { class: 'dialog__panel' }, h('h3', { id: titleId, text: title }), h('p', { id: bodyId, text: body }), h('div', { class: 'dialog__actions' }, cancel, confirm))
    );
    let answer = false;
    const finish = (value) => {
      answer = value;
      dialog.classList.add('is-closing');
      setTimeout(() => dialog.close(), 170);
    };
    cancel.addEventListener('click', () => finish(false));
    confirm.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) finish(false);
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(answer);
    });
    document.body.append(dialog);
    dialog.showModal();
    cancel.focus();
  });
}
