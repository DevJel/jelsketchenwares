// Inline SVG icons (stroke style, 24px grid). Decorative by default: pass `label` to name one.
const NS = 'http://www.w3.org/2000/svg';

// Each icon is a list of shapes: a string is a path, {c:[cx,cy,r]} a circle, {r:[x,y,w,h,rx]} a rect.
const ICONS = {
  home: ['M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z'],
  grid: [{ r: [3, 3, 7, 7, 1.5] }, { r: [14, 3, 7, 7, 1.5] }, { r: [14, 14, 7, 7, 1.5] }, { r: [3, 14, 7, 7, 1.5] }],
  bag: ['M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', { c: [12, 7, 4] }],
  users: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', { c: [9, 7, 4] }, 'M23 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  lock: [{ r: [3, 11, 18, 11, 2] }, 'M7 11V7a5 5 0 0 1 10 0v4'],
  box: ['M21 8l-9-5-9 5v8l9 5 9-5z', 'M3.3 7L12 12l8.7-5', 'M12 22V12'],
  activity: ['M22 12h-4l-3 9L9 3l-3 9H2'],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  check: ['M20 6L9 17l-5-5'],
  x: ['M18 6L6 18', 'M6 6l12 12'],
  chevron: ['M6 9l6 6 6-6'],
  'chevron-right': ['M9 6l6 6-6 6'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  alert: [{ c: [12, 12, 10] }, 'M12 8v4', 'M12 16h.01'],
  info: [{ c: [12, 12, 10] }, 'M12 16v-4', 'M12 8h.01'],
  copy: [{ r: [9, 9, 13, 13, 2] }, 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  truck: ['M1 3h15v13H1z', 'M16 8h4l3 3v5h-7z', { c: [5.5, 18.5, 2.5] }, { c: [18.5, 18.5, 2.5] }],
  shield: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', 'M9 12l2 2 4-4'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'],
  eye: ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', { c: [12, 12, 3] }],
};

export function Icon(name, { size = 20, label } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'icon');
  if (label) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', label);
  } else {
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }
  for (const shape of ICONS[name] || []) {
    let node;
    if (typeof shape === 'string') {
      node = document.createElementNS(NS, 'path');
      node.setAttribute('d', shape);
    } else if (shape.c) {
      node = document.createElementNS(NS, 'circle');
      node.setAttribute('cx', shape.c[0]);
      node.setAttribute('cy', shape.c[1]);
      node.setAttribute('r', shape.c[2]);
    } else {
      node = document.createElementNS(NS, 'rect');
      node.setAttribute('x', shape.r[0]);
      node.setAttribute('y', shape.r[1]);
      node.setAttribute('width', shape.r[2]);
      node.setAttribute('height', shape.r[3]);
      node.setAttribute('rx', shape.r[4]);
    }
    svg.append(node);
  }
  return svg;
}

export const ICON_NAMES = Object.keys(ICONS);
