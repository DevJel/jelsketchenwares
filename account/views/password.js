// Change password. Also used (forced = true) when the store has set a temporary password.
import { api } from '/dashboard/core/api.js';
import { h } from '/dashboard/core/dom.js';
import { Alert, Button, Card, Icon, PageHeader, PasswordField, toast, withBusy } from '/dashboard/ui/index.js';

export function passwordView(ctx, { forced = false } = {}) {
  const alert = Alert();
  const current = PasswordField({ label: forced ? 'Temporary password from the store' : 'Current password', autocomplete: 'current-password', required: true, maxlength: 200 });
  const next = PasswordField({ label: 'New password', autocomplete: 'new-password', required: true, maxlength: 128, hint: 'At least 10 characters. A few unrelated words together work well.' });
  const submit = Button({ label: 'Change password', type: 'submit', icon: 'lock' });
  const form = h('form', { class: 'form', novalidate: true }, current.el, next.el, alert.el, h('div', { class: 'form-actions' }, submit));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.hide();
    if (!current.input.value || !next.input.value) {
      alert.show('Please fill in both fields.');
      return;
    }
    await withBusy(
      submit,
      async () => {
        try {
          await api('POST', '/api/customer/password', { currentPassword: current.input.value, newPassword: next.input.value });
          current.input.value = '';
          next.input.value = '';
          if (forced) {
            await ctx.reloadMe();
            ctx.go('orders');
          } else {
            toast('Your password is changed. You were signed out on your other devices.', 'ok');
          }
        } catch (error) {
          ctx.fail(error, alert);
        }
      },
      'Saving…'
    );
  });

  const card = Card({ title: forced ? 'Choose a new password' : 'Change password', subtitle: forced ? 'The store set a temporary password for you. Choose your own to continue.' : 'Changing it signs you out on your other devices.', tone: 'strong' }, form);
  if (forced) {
    return h('div', { class: 'auth' }, h('div', { class: 'stack' }, h('div', { class: 'cluster' }, Icon('shield', { size: 22 }), h('h1', { class: 'page-title', text: 'Password needed' })), card));
  }
  return h('div', { class: 'stack' }, PageHeader({ eyebrow: 'Security', title: 'Password', lead: 'Use a long password you do not use anywhere else.' }), h('div', { class: 'auth auth--left' }, card));
}
