# Jels Kitchenwares Online Store

A clean, modern, and responsive e-commerce web interface for **Jels Kitchenwares**, specializing in high-clarity Borosilicate 3.3 glass cookware.

## Features

* **Product Showcase & Science:** Highlights the unique properties of Borosilicate 3.3 glass, including its thermal shock resistance ($−20^\circ\text{C}$ to $300^\circ\text{C}$), non-porous surface, and ease of cleaning.
* **Comparative Breakdown:** Side-by-side comparison table evaluating Jels Glass against traditional non-stick and stainless steel alternatives.
* **Customer Assurances:** Highlights free carbon-neutral delivery over $75$, a 2-year warranty, and a 60-day home trial.
* **Responsive Design:** Built with a clean aesthetic layout tailored for seamless viewing across desktop and mobile browsers.
* **Scrolling highlights:** The feature strip loops slowly to the left. When reduced motion is requested, the highlights remain visible without animation.

## Tech Stack

* **HTML5 / CSS3**
* **React / Modern Component Structure** (Artifact layout)

## Project Structure

```text
├── index.html           # Main application entry point
└── README.md            # Project documentation

```

## Quick Start

1. Clone the repository:
```bash
git clone https://github.com/your-username/jels-kitchenwares.git

```


2. Navigate to the project directory:
```bash
cd jels-kitchenwares

```


3. Open `index.html` in your browser or run it via a local development server (such as Live Server in VS Code) to view the interface.

## License

© 2026 Jels Kitchenwares. All rights reserved.

## Implementation and verification notes

The entry point is the supplied self-contained React export: CSS, application JavaScript, and media are bundled inside `index.html`. The editable React project and a dependency lockfile are not included in this repository. Preserve the original export when updating it; meaningful component refactors and dependency audits require its source project.

To run the local checks, install Python 3 and Node.js, then run from the repository root:

```bash
python3 -m unittest discover -s tests -v
python3 scripts/verify_app.py
```

These checks verify basic document structure and embedded JavaScript syntax. They are not a substitute for browser interaction tests, dependency vulnerability scanning, or a security review. The Storefront checks workflow runs them on pushes and pull requests with read-only repository access. The existing Jekyll and SLSA workflows remain unchanged; the latter currently generates placeholder artifacts, not storefront release provenance, and requires review before relying on its output.

## Planned dashboards and backend

See the [store platform architecture and implementation plan](docs/store-platform-plan.md). It is a proposal; dashboards, sign-in, orders, and media management are not implemented yet.
