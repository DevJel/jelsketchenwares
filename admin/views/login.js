// Admin sign-in: email + password + a fresh authenticator code.
import { api } from '/dashboard/core/api.js';
import { h } from '/dashboard/core/dom.js';
import { Alert, Button, Card, Field, Icon, PasswordField, withBusy } from '/dashboard/ui/index.js';

export function loginView(ctx, notice = '') {
  const alert = Alert();
  if (notice) alert.show(notice, 'ok');
  const email = Field({ label: 'Admin email', type: 'email', autocomplete: 'username', required: true, maxlength: 254 });
  const password = PasswordField({ label: 'Password', autocomplete: 'current-password', required: true, maxlength: 200 });
  const code = Field({
    label: 'Authenticator code',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'one-time-code',
    required: true,
    maxlength: 7,
    pattern: '[0-9 ]*',
    hint: 'The 6-digit code from your authenticator app. Each code works once.',
  });
  const submit = Button({ label: 'Sign in', type: 'submit', icon: 'lock', full: true });
  const form = h('form', { class: 'form', novalidate: true }, email.el, password.el, code.el, alert.el, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.hide();
    if (!email.input.value.trim() || !password.input.value || !code.input.value.trim()) {
      alert.show('Please fill in all three fields.');
      return;
    }
    await withBusy(
      submit,
      async () => {
        try {
          const data = await api('POST', '/api/admin/login', { email: email.input.value, password: password.input.value, code: code.input.value });
          password.input.value = '';
          ctx.signedIn(data.admin);
        } catch (error) {
          code.input.value = '';
          alert.show(error.message);
        }
      },
      'Please wait…'
    );
  });

  const card = Card(
    { tone: 'strong' },
    h('div', { class: 'cluster' }, Icon('shield', { size: 26 }), h('h1', { id: 'auth-title', text: 'Admin sign-in' })),
    h('p', { class: 'lead', text: 'For the store owner only. You need your password and a fresh authenticator code.' }),
    h('div', { class: 'stack--tight' }, form)
  );
  card.setAttribute('aria-labelledby', 'auth-title');
  const view = h('div', { class: 'auth' }, card);
  view.focusFirst = () => email.input.focus();
  return view;
}
