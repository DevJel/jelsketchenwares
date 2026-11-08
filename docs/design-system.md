# Design system

A warm, frosted-glass look shared by the customer and admin dashboards. Everything is controlled from a few small files in `dashboard/css/`, so a change made once shows up everywhere.

| File | What it holds |
| --- | --- |
| `tokens.css` | Colours (light and dark), glass settings, spacing, corner sizes, motion timings |
| `base.css` | Page background, type, links, focus ring, small utilities |
| `layout.css` | Top bar, navigation, page grid, breakpoints |
| `components.css` | Every component's look |
| `motion.css` | Animations, and the rule that switches them off |

## The glass look

- **Aurora.** A soft blurred glow of gold, teal, coral and violet sits behind the page and drifts slowly.
- **Glass surfaces.** Cards, the top bar, the navigation, dialogs and the phone Menu sheet are translucent white (or dark) with a blur, a thin lighter edge and a faint highlight. `--glass`, `--glass-strong`, `--sheen`, `--glass-rim` and `--glass-blur` define it.
- **Strong glass for forms.** Cards that hold forms use a more opaque glass (`tone: 'strong'`) so text on inputs stays easy to read.
- **Fallbacks.** If a device cannot blur (`@supports not (backdrop-filter)`), asks for less transparency (`prefers-reduced-transparency`) or uses forced colours, surfaces become solid colour with a clear border.

## Colour

Light is the default; dark follows the device's setting (`prefers-color-scheme`).

| Role | Light | Dark |
| --- | --- | --- |
| Text `--ink` | `#1b1a17` | `#f3ede1` |
| Secondary text `--muted` | `#5a564b` | `#bab19f` |
| Gold (brand, selected, focus) `--gold-deep` | `#7a5718` | `#e3bd78` |
| Page | cream `#f6f0e4` with the aurora | near black `#14110d` with a dimmer aurora |

Meaning colours come in three parts each (text, tinted background, outline): `--ok` (green), `--warn` (amber), `--bad` (red), `--info` (blue), `--violet`, `--teal`. Status pills use them: waiting is amber, confirmed blue, packed violet, shipped teal, delivered green, cancelled red. Colour is never the only signal; every pill also has words.

**Contrast.** Body and pill text is at least 4.5:1 against its background in both themes, and the gold used for links and focus is about 7:1 on cream. Check again if you change a token.

## Type, space and shape

- Headings use a serif (`--serif`), everything else the system sans (`--sans`). No web fonts are loaded, so nothing is requested from other sites.
- Spacing steps: `--space-1` to `--space-6` (0.25rem to 2.25rem). Use them instead of fixed numbers.
- Corners: `--r-sm` 10px, `--r-md` 16px, `--r-lg` 22px. Pills are fully round.
- Page width: `--maxw` 1200px with a flexible `--gutter`.

## Layout and breakpoints

| Width | What changes |
| --- | --- |
| below 640px | The "Store admin" / "My account" chip leaves the top bar to make room for the Menu button |
| below 700px | Statistic tiles are two per row and a little more compact; two-column grids become one column |
| below 720px | Tables turn into labelled cards, one per row |
| below 900px | Side navigation and the top-bar Sign out are replaced by the **Menu** button and sheet |
| 900px and wider | Sticky side navigation on the left, Sign out in the top bar |
| 1040px and wider | The request form sits beside its sticky order summary |

The rule for narrow screens: **each action appears once.** The Menu holds navigation and Sign out; cards and rows are tappable instead of carrying their own small buttons; page headers drop buttons that duplicate a Menu entry (`hide-in-menu`).

## Motion

- Content **rises** into place one item after another (`.reveal`, with the delay set from the item's position), the page fades in, numbers count up, the order pipeline bar grows, status dots pulse softly for waiting requests, and cards lift slightly on hover (only on devices that hover).
- Menu sheet, dialogs and toasts slide and fade in and out.
- **Reduced motion.** When the device asks for reduced motion, every animation and transition collapses to almost nothing and content shows immediately. The browser test checks this.

## Accessibility

- All controls reachable and usable by keyboard, with a clear gold focus ring.
- A *Skip to content* link is the first thing keyboard users reach.
- Moving to a new page moves focus to its heading, and messages that appear (errors, toasts) are announced politely.
- Dialogs and the Menu sheet use the native `<dialog>`: focus stays inside, Esc closes, the page behind is inert.
- Tap targets: main buttons and fields are 46px tall, Menu entries 56px, quantity buttons 44px, small buttons 38px. Text is readable without zooming.
- Tables keep their column labels when they turn into cards, so nothing is lost for screen readers.
- Forced-colours mode and reduced transparency are supported.

## Changing the look

1. Change a token in `tokens.css` (both the light block and the dark block).
2. Run the browser test (`node --no-warnings tests/e2e/dashboards.e2e.mjs`) and refresh the screenshots (`node --no-warnings scripts/screenshots.mjs`).
3. Look at the new pictures in light and dark, on desktop and phone, before you commit.
