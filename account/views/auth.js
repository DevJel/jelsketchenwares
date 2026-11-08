// Sign in / create an account.
import { api } from '/dashboard/core/api.js';
import { h } from '/dashboard/core/dom.js';
import { Alert, Button, Card, Field, PasswordField, withBusy } from '/dashboard/ui/index.js';

export function authView(ctx, mode = 'login', notice = '') {
  const isLogin = mode === 'login';
  const alert = Alert();
  if (notice) alert.show(notice, 'ok');

  const name = isLogin ? null : Field({ label: 'Your name', type: 'text', autocomplete: 'name', required: true, maxlength: 100 });
  const email = Field({ label: 'Email', type: 'email', autocomplete: 'username', required: true, maxlength: 254, inputmode: 'email' });
  const password = PasswordField({
    label: isLogin ? 'Password' : 'Choose a password',
    autocomplete: isLogin ? 'current-password' : 'new-password',
    required: true,
    maxlength: 128,
    hint: isLogin ? undefined : 'At least 10 characters. A few words together make a strong password.',
  });
  const submit = Button({ label: isLogin ? 'Sign in' : 'Create my account', type: 'submit', full: true });
  const form = h('form', { class: 'form', novalidate: true }, name && name.el, email.el, password.el, alert.el, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    alert.hide();
    if (!email.input.value.trim() || !password.input.value || (name && !name.input.value.trim())) {
      alert.show('Please fill in every field.');
      return;
    }
    await withBusy(
      submit,
      async () => {
        try {
          const data = isLogin
            ? await api('POST', '/api/customer/login', { email: email.input.value, password: password.input.value })
            : await api('POST', '/api/customer/register', { name: name.input.value, email: email.input.value, password: password.input.value });
          ctx.signedIn(data.customer);
        } catch (error) {
          alert.show(error.message);
        }
      },
      'Please wait…'
    );
  });

  const title = h('h1', { id: 'auth-title', text: isLogin ? 'Sign in' : 'Create your account' });
  const card = Card(
    { tone: 'strong' },
    h('img', { class: 'auth__logo', src: '/jels-bag-icon.svg', alt: '', width: '56', height: '56' }),
    title,
    h('p', { class: 'lead', text: isLogin ? 'See your order requests and manage your details.' : 'Save your delivery details and send order requests in a few taps.' }),
    h('div', { class: 'stack--tight' }, form),
    h(
      'p',
      { class: 'auth__switch' },
      isLogin ? 'New here? ' : 'Already have an account? ',
      h('button', { class: 'linklike', type: 'button', text: isLogin ? 'Create an account' : 'Sign in', onclick: () => ctx.showAuth(isLogin ? 'register' : 'login') })
    )
  );
  card.setAttribute('aria-labelledby', 'auth-title');
  const view = h('div', { class: 'auth' }, card);
  view.focusFirst = () => (name ? name.input : email.input).focus();
  return view;
}
