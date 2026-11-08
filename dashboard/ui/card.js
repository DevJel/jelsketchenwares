// The glass panel every section sits on. Same padding, same header, everywhere.
import { cx, h, uid } from '../core/dom.js';

/**
 * Card({ title, subtitle, actions, tone, as, class }, ...children)
 * tone: 'default' | 'strong' (more opaque, for forms) | 'flat' (no glass, for nested use)
 */
export function Card({ title, subtitle, actions, tone = 'default', as = 'section', class: extra } = {}, ...children) {
  const titleId = uid('card-title');
  const header =
    title || actions
      ? h(
          'header',
          { class: 'card__head' },
          h('div', { class: 'card__titles' }, title ? h('h2', { id: titleId, class: 'card__title', text: title }) : null, subtitle ? h('p', { class: 'card__subtitle', text: subtitle }) : null),
          actions ? h('div', { class: 'card__actions' }, actions) : null
        )
      : null;
  return h(as, { class: cx('card', tone !== 'default' && `card--${tone}`, extra), 'aria-labelledby': title ? titleId : null }, header, ...children);
}
