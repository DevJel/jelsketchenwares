# Jels Kitchenwares Online Store

A clean, modern, responsive storefront for **Jels Kitchenwares**, specializing in high-clarity Borosilicate 3.3 glass cookware.

## Storefront features

- Product and material showcase, including Borosilicate 3.3 properties.
- Product comparison table.
- Customer assurance and delivery information.
- Responsive desktop and mobile layout.
- Accessible scrolling highlights with reduced-motion support.

## Product video behavior

The four Cloudinary product clips remain mapped to the glass pan hero, glass pot, mixing-bowl/storage range, and bake-and-serve/teapot products. Cloudinary player embeds are muted, autoplaying, looping, hidden-control and non-interactive. The iframe fills its card and is enlarged slightly (1.06×) inside the clipped frame.

The three recipe cards intentionally reuse the Glass Pot 3.5L clip, starting at 5%, 38%, and 70% of its duration via Cloudinary's start-offset transformation. Each embed loops its own trimmed segment.

## Technology and hosting

- HTML5, CSS3 and a self-contained React export.
- **Production hosting: Cloudflare Pages**
- **Cloudflare Pages project:** `jels-kitchenwares`
- **Production URL:** https://jels-kitchenwares.pages.dev
- **Source:** this GitHub repository, `main` branch.
- **Build configuration:** no build command; publish repository root (`.`).
- GitHub is the source repository and CI provider; GitHub Pages/Jekyll is not the hosting target.

The current storefront is a bundled export in `index.html`. The original editable React source and dependency lockfile are not included. Preserve the current storefront until a replacement has passed visual and interaction parity checks.

## Local verification

Install Python 3 and Node.js, then run:

```bash
python3 -m unittest discover -s tests -v
python3 scripts/verify_app.py
```

These checks validate basic document structure and embedded JavaScript syntax. They do not replace browser interaction testing, dependency vulnerability scanning or a security review.

The `Storefront checks` GitHub Actions workflow runs on pushes and pull requests with read-only repository permissions. Cloudflare Pages is connected directly to this repository and is configured to deploy production from `main`; preview deployments are disabled.

## Current platform scope

The repository currently contains a static storefront and a local demo cart. It does **not** implement buyer/admin authentication, product administration, a backend API, persistent inventory, order storage, checkout, payment processing, shipping integration or media management. Do not describe these as live features.

Cloudflare Pages hosts the static site. Any future server-side functionality should use explicitly approved Cloudflare services (for example, Workers, D1 and R2) with separate environments, least-privilege bindings, server-side authorization, secrets management, audit logging and tested backups. No Aiven service or database connection is part of this project.

See [the platform architecture and implementation plan](docs/store-platform-plan.md) before extending the application.

## License

© 2026 Jels Kitchenwares. All rights reserved.
