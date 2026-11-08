// Tiny DOM helpers shared by every dashboard component. No framework, no build step.
//
// Security notes
//  - Text from the server is only ever added with textContent (the `text` attribute or a string
//    child), never as HTML.
//  - The pages run under a Content-Security-Policy that blocks inline styles, so `h()` refuses a
//    `style` attribute. Use a class, or element.style.setProperty('--name', value) for a value that
//    must be computed (that is allowed).

/** Joins class names, skipping anything falsy. */
export const cx = (...parts) => parts.flat().filter(Boolean).join(' ');

/** Builds an element. Attributes: class, text, dataset, on* handlers, true/false attributes. */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'style') throw new Error('Inline styles are blocked by the page security policy. Use a class or style.setProperty().');
    if (key === 'class') el.className = Array.isArray(value) ? cx(value) : value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === undefined || child === null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const $ = (selector, root = document) => root.querySelector(selector);

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

let counter = 0;
/** A unique id for linking labels, hints and dialogs. */
export const uid = (prefix = 'id') => `${prefix}-${(counter += 1)}`;

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Marks the direct children of `container` to fade up one after another. The delay is a CSS
 * custom property, so the timing lives in motion.css and reduced-motion users get no animation.
 */
export function stagger(container, { max = 10 } = {}) {
  let index = 0;
  for (const child of container.children) {
    // A child marked data-stagger="children" lets its own children rise one by one instead.
    if (child.dataset.stagger === 'children') {
      for (const grandchild of child.children) {
        grandchild.classList.add('reveal');
        grandchild.style.setProperty('--i', String(Math.min(index, max)));
        index += 1;
      }
    } else {
      child.classList.add('reveal');
      child.style.setProperty('--i', String(Math.min(index, max)));
      index += 1;
    }
  }
  return container;
}

/** Moves keyboard and screen-reader focus to the first heading of a new view. */
export function focusHeading(root) {
  const heading = root.querySelector('h1, h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}
