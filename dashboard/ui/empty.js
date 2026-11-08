// What a view shows when there is nothing to list yet.
import { h } from '../core/dom.js';
import { Icon } from './icon.js';

export function EmptyState({ icon = 'bag', title, text, action }) {
  return h('div', { class: 'empty' }, h('span', { class: 'empty__icon' }, Icon(icon, { size: 28 })), h('h2', { class: 'empty__title', text: title }), text ? h('p', { text }) : null, action || null);
}
