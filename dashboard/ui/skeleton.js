// Shimmering placeholders shown while a view loads.
import { h } from '../core/dom.js';

const bar = (cls = '') => h('span', { class: `skeleton ${cls}`.trim() });

/** Skeleton({ variant: 'cards' | 'table' | 'form', count }) */
export function Skeleton({ variant = 'cards', count = 3 } = {}) {
  const items = [];
  if (variant === 'form') {
    items.push(h('div', { class: 'card' }, bar('skeleton--title'), bar(), bar(), bar('skeleton--short')));
  } else if (variant === 'table') {
    items.push(h('div', { class: 'card' }, ...Array.from({ length: count + 2 }, () => bar('skeleton--row'))));
  } else {
    for (let i = 0; i < count; i += 1) items.push(h('div', { class: 'card' }, bar('skeleton--title'), bar(), bar('skeleton--short')));
  }
  return h('div', { class: 'stack', role: 'status', 'aria-label': 'Loading' }, h('span', { class: 'sr-only', text: 'Loading…' }), ...items);
}
