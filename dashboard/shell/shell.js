// The frame around every dashboard page: floating glass top bar, side navigation on a wide screen
// (a bottom bar on a phone), the content area, and the footer. Both dashboards use this same shell,
// which is what keeps them aligned with each other.
import { clear, focusHeading, h, stagger } from '../core/dom.js';
import { Avatar, Button, Icon, Skeleton } from '../ui/index.js';

const WIDE = window.matchMedia('(min-width: 900px)');

/**
 * createShell({ area, navLabel, footer })
 *   area      short name shown next to the logo ("My account", "Store admin")
 *   navLabel  accessible name of the navigation
 */
export function createShell({ area, navLabel, footer }) {
  const root = document.getElementById('root');

  const brand = h('a', { class: 'brand', href: '/' }, h('img', { class: 'brand__mark', src: '/jels-bag-icon.svg', alt: '', width: '28', height: '28' }), h('span', { class: 'brand__name', text: 'Jels Kitchenwares' }));
  const userBox = h('div', { class: 'userbox', hidden: true });
  // On a phone or tablet the side navigation is replaced by one Menu button.
  const menuButton = Button({ label: 'Menu', variant: 'ghost', size: 'sm', icon: 'menu', class: 'topbar__menu', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', hidden: true });
  const topbar = h('header', { class: 'topbar' }, brand, h('span', { class: 'chip chip--gold topbar__area', text: area }), h('span', { class: 'spacer' }), userBox, menuButton);

  const nav = h('nav', { class: 'nav', 'aria-label': navLabel, hidden: true });
  const view = h('div', { class: 'view' });
  const main = h('main', { id: 'main', class: 'main', tabindex: '-1' }, view);
  const body = h('div', { class: 'shell-body', 'data-nav': 'false' }, nav, main);

  const parts = [h('div', { class: 'container topbar-wrap' }, topbar), h('div', { class: 'container' }, body)];
  if (footer) parts.push(h('div', { class: 'container' }, h('footer', { class: 'footer', text: footer })));
  root.replaceChildren(...parts);

  // The skip link would change the address hash, which the router reads as a page change.
  // Move focus directly instead.
  document.querySelector('.skip')?.addEventListener('click', (event) => {
    event.preventDefault();
    main.focus();
  });

  // ---- Mobile menu: a glass sheet with every section, who is signed in, and Sign out.
  const sheet = h('dialog', { class: 'menu-sheet', 'aria-label': `${area} menu` });
  const menu = { tabs: [], current: '', user: null, onSelect: () => {}, onSignOut: () => {} };

  function renderMenu() {
    clear(sheet);
    sheet.append(
      h(
        'div',
        { class: 'menu__panel' },
        h('div', { class: 'menu__head' }, h('span', { class: 'menu__title', text: area }), Button({ variant: 'quiet', size: 'sm', icon: 'x', 'aria-label': 'Close menu', onClick: closeMenu })),
        menu.user ? h('div', { class: 'menu__user' }, Avatar(menu.user.name), h('div', { class: 'menu__who' }, h('strong', { text: menu.user.name }), h('small', { text: 'Signed in' }))) : null,
        h(
          'ul',
          { class: 'menu__list' },
          menu.tabs.map((tab) =>
            h(
              'li',
              {},
              h(
                'button',
                {
                  type: 'button',
                  class: 'menu__item',
                  'data-tab': tab.id,
                  'aria-current': tab.id === menu.current ? 'page' : null,
                  onclick: () => {
                    closeMenu();
                    menu.onSelect(tab.id);
                  },
                },
                h('span', { class: 'menu__icon' }, Icon(tab.icon, { size: 20 })),
                h('span', { class: 'menu__label', text: tab.label }),
                Icon('chevron-right', { size: 18 })
              )
            )
          )
        ),
        menu.user
          ? h(
              'div',
              { class: 'menu__foot' },
              Button({
                label: 'Sign out',
                variant: 'ghost',
                icon: 'logout',
                full: true,
                onClick: () => {
                  closeMenu();
                  menu.onSignOut();
                },
              })
            )
          : null
      )
    );
  }

  function openMenu() {
    if (WIDE.matches || sheet.open) return;
    renderMenu();
    sheet.classList.remove('is-closing');
    sheet.showModal();
    menuButton.setAttribute('aria-expanded', 'true');
    (sheet.querySelector('.menu__item[aria-current="page"]') || sheet.querySelector('.menu__item'))?.focus();
  }
  function closeMenu() {
    if (!sheet.open || sheet.classList.contains('is-closing')) return;
    sheet.classList.add('is-closing');
    setTimeout(() => sheet.close(), 170);
  }
  menuButton.addEventListener('click', () => (sheet.open ? closeMenu() : openMenu()));
  sheet.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMenu();
  });
  sheet.addEventListener('click', (event) => {
    if (event.target === sheet) closeMenu();
  });
  sheet.addEventListener('close', () => {
    sheet.classList.remove('is-closing');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.focus();
  });
  WIDE.addEventListener('change', () => {
    if (WIDE.matches && sheet.open) sheet.close();
  });
  document.body.append(sheet);

  let token = 0;

  const shell = {
    view,

    /** Shows who is signed in with a Sign out button, or hides the box when nobody is. */
    setUser(user, onSignOut) {
      menu.user = user;
      menu.onSignOut = onSignOut;
      clear(userBox);
      userBox.hidden = !user;
      if (!user) return;
      userBox.append(Avatar(user.name), h('span', { class: 'userbox__name', text: user.name }), Button({ label: 'Sign out', variant: 'ghost', size: 'sm', icon: 'logout', onClick: onSignOut }));
    },

    /** Builds the navigation. tabs: [{ id, label, short?, icon }] */
    setTabs(tabs, onSelect) {
      menu.tabs = tabs;
      menu.onSelect = onSelect;
      clear(nav);
      nav.append(
        h(
          'ul',
          { class: 'nav__list' },
          tabs.map((tab) =>
            h(
              'li',
              {},
              h(
                'button',
                { type: 'button', class: 'nav__item', 'data-tab': tab.id, onclick: () => onSelect(tab.id) },
                Icon(tab.icon, { size: 20 }),
                h('span', { class: 'nav__label', text: tab.label })
              )
            )
          )
        )
      );
    },

    setCurrent(id) {
      menu.current = id;
      for (const item of nav.querySelectorAll('.nav__item')) {
        if (item.dataset.tab === id) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      }
    },

    /** Signed-in layout (navigation visible) or signed-out layout (centered card). */
    showNav(visible) {
      menuButton.hidden = !visible;
      nav.hidden = !visible;
      body.dataset.nav = String(visible);
    },

    /** Puts a finished view on screen with the entrance animation. */
    setView(el, { focus = true, scroll = true } = {}) {
      view.classList.remove('view--enter');
      view.replaceChildren(el);
      stagger(el);
      void view.offsetWidth; // restart the animation
      view.classList.add('view--enter');
      if (scroll) window.scrollTo({ top: 0 });
      if (focus) focusHeading(el);
    },

    /**
     * Loads a view. Shows a skeleton only if loading takes longer than a moment, and ignores the
     * result if the person has already moved on to another view.
     * loader() returns an element. Errors go to onError(error).
     */
    async show(loader, { onError, focus = true } = {}) {
      const mine = (token += 1);
      const timer = setTimeout(() => {
        if (mine === token) shell.setView(Skeleton({ variant: 'cards', count: 2 }), { focus: false, scroll: false });
      }, 160);
      try {
        const el = await loader();
        if (mine !== token || !el) return;
        shell.setView(el, { focus });
      } catch (error) {
        if (mine !== token) return;
        if (onError) onError(error);
        else throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
  return shell;
}
