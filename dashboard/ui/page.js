// The heading block at the top of every view: eyebrow, title, one line of help, and actions.
import { h } from '../core/dom.js';

export function PageHeader({ title, lead, eyebrow, actions }) {
  return h(
    'header',
    { class: 'page-head' },
    h('div', { class: 'page-head__text' }, eyebrow ? h('p', { class: 'eyebrow', text: eyebrow }) : null, h('h1', { class: 'page-title', text: title }), lead ? h('p', { class: 'lead', text: lead }) : null),
    actions && (Array.isArray(actions) ? actions.length : true) ? h('div', { class: 'page-head__actions' }, actions) : null
  );
}
