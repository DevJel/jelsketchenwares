// A neat label / value list (delivery address, customer details, and so on).
import { h } from '../core/dom.js';

/** DescriptionList([[label, value], ...]) -- pairs with an empty value are skipped. */
export function DescriptionList(pairs) {
  return h(
    'dl',
    { class: 'dl' },
    pairs.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => h('div', { class: 'dl__row' }, h('dt', { text: label }), h('dd', {}, value)))
  );
}
