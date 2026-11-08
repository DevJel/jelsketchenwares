// A round badge with someone's initials.
import { h } from '../core/dom.js';
import { initials } from '../core/format.js';

export const Avatar = (name) => h('span', { class: 'avatar', 'aria-hidden': 'true', text: initials(name) });
