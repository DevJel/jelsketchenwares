# Components

Everything on both dashboards is built from this one library in `dashboard/ui/`, so a button, card or table looks and behaves the same everywhere. Import what you need from one place:

```js
import { Button, Card, DataTable, PageHeader } from '/dashboard/ui/index.js';
```

Components are plain functions that return DOM elements. Build markup with the `h()` helper from `dashboard/core/dom.js`:

```js
import { h } from '/dashboard/core/dom.js';
h('div', { class: 'stack' }, PageHeader({ title: 'Example' }), Card({ title: 'Hello' }, h('p', { text: 'Text is set safely, never as HTML.' })));
```

`h(tag, attributes, ...children)` rules: `text` sets text content, `class` sets classes, `onclick`-style keys add event listeners, `null` and `false` children are skipped, and a `style` attribute **throws** (the pages run under a Content-Security-Policy that forbids inline styles, see [dashboards.md](dashboards.md)).

## The shell

`dashboard/shell/shell.js` builds the frame both dashboards share.

```js
const shell = createShell({ area: 'Store admin', navLabel: 'Admin sections', footer: 'Optional footer text' });
shell.setTabs([{ id: 'overview', label: 'Overview', icon: 'grid' }, ...], (id) => go(id));
shell.setUser({ name: 'owner@example.com' }, onSignOut);   // or setUser(null) when signed out
shell.setCurrent('overview');
shell.showNav(true);                                        // false for the sign-in screens
shell.show(() => loadAnElement(), { onError });             // skeleton if slow, ignores stale results
shell.setView(element);
```

| Screen | What the person sees |
| --- | --- |
| 900px and wider | Floating glass top bar with name and Sign out, and a sticky side navigation |
| Narrower than 900px | The top bar has one **Menu** button. It opens a glass sheet with every section, who is signed in and Sign out. Selecting a section closes the sheet. Esc, the close button or a tap outside also close it, and focus returns to the Menu button |

The sheet is a native `<dialog>` (focus stays inside, the page behind is inert). To keep buttons from being repeated on a phone, put `class: 'hide-in-menu'` on any page button that already has a Menu entry (for example *Request an order* in the customer page header).

## Components

| Component | Use it for | Main options |
| --- | --- | --- |
| `Button` | Every button | `label`, `variant` (`primary`, `ghost`, `quiet`, `danger`, `danger-solid`), `size` (`md`, `sm`), `icon`, `full`, `onClick`, any attribute (such as `aria-label`) |
| `withBusy(button, work, busyLabel)` | Stops double submits: shows a spinner and a busy label while `work` runs, then restores the label even on error | |
| `setLabel(button, text)` | Change a button's words and keep its icon | |
| `Card` | The glass panel every section sits on | `Card({ title, subtitle, actions, tone: 'default' \| 'strong' \| 'flat', as, class }, ...children)`. The title is an `h2` |
| `PageHeader` | Top of every view | `title` (the page `h1`), `eyebrow`, `lead`, `actions` |
| `Field` | A labelled input, select or textarea | `label`, `hint`, `tag`, `options: [[value, text]]`, `value`, any attribute. Returns `{ el, input }` |
| `PasswordField` | Password with a Show / Hide button | `label`, `hint`, `autocomplete`. Returns `{ el, input }` |
| `Checkbox` | Checkbox with its label | `label`, `checked`. Returns `{ el, input }` |
| `DataTable` | Lists of rows | `caption`, `columns`, `rows`, `onRowOpen`. Columns: `{ label, key?, render?(row), align?: 'end', srOnly?, className? }`. On a phone each row becomes a labelled card. With `onRowOpen` the whole row is tappable and its own Open / Edit button is hidden from view on phones (it stays for keyboard and screen-reader users) |
| `Stat` | A big number with a label | `label`, `value`, `format`, `icon`, `tone`, `hint`. Counts up when it appears |
| `Stepper` | Order progress | `steps: [{ id, label }]`, `current`, `label` |
| `Badge`, `StatusBadge`, `StockBadge`, `YesNoBadge`, `AccountBadge` | Small coloured pills | `Badge({ kind, text, dot })`; the others take a value and pick the words and colour. A waiting request has a softly pulsing dot |
| `Alert` | A message area that is read out when it changes (form errors) | `const a = Alert(); a.show('text'); a.clear()` |
| `Notice` | A message that is always visible | `kind` (`info`, `ok`, `warn`, `error`), `text` |
| `toast(text, kind, ms)` | A short confirmation that slides in and leaves by itself | `kind`: `ok`, `error`, `info` |
| `confirmDialog` | Ask before anything that cannot be undone | `await confirmDialog({ title, body, confirmLabel, cancelLabel, tone })` resolves `true` or `false`. The safe choice has focus; Esc cancels |
| `EmptyState` | What to show when a list is empty | `icon`, `title`, `text`, `action` |
| `Skeleton` | Placeholder while loading | `variant` (`cards`, `table`, `form`), `count` |
| `DescriptionList` | A label / value list | `DescriptionList([[label, value], ...])`; pairs with an empty value are skipped |
| `Avatar` | Round badge with initials | `Avatar(name)` |
| `Icon` | Inline icon | `Icon(name, { size, label })`. Decorative unless `label` is given. Names: see `ICON_NAMES` |

## Helpers

| File | What it gives you |
| --- | --- |
| `core/dom.js` | `h`, `$`, `clear`, `cx` (join class names), `uid` (unique ids), `stagger` (entrance animation delays), `focusHeading` (moves focus to a new page's heading), `prefersReducedMotion` |
| `core/api.js` | `api(method, path, body)` returns the JSON, throws `ApiError` (with `status` and a readable `message`) |
| `core/format.js` | `money`, `when`, status and stock labels, `initials`, address formatting |
| `core/router.js` | `currentRoute`, `go(name, arg)`, `setHash`, `onRouteChange` |

## Rules that keep it consistent

- **Words for people.** Say "order request", "Waiting for the store", "Sign out". Never show codes or database words.
- **Every control has a visible label** (or an `aria-label` for icon-only buttons). The browser test fails on any unlabelled field.
- **One way to confirm danger.** Cancelling, disabling and resetting always go through `confirmDialog`.
- **Never build HTML from text.** Use `text:` and `h()` so customer-supplied names and notes can never run as code.
- **No inline styles.** See above.
- **Phones first.** New tables use `DataTable` so they become cards. Do not repeat a button on every row; use `onRowOpen`.
