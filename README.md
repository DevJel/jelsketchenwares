# Jels Kitchenwares Online Store

A clean, modern, responsive storefront for **Jels Kitchenwares**, specializing in high-clarity Borosilicate 3.3 glass cookware.

## Storefront features

- Product and material showcase, including Borosilicate 3.3 properties.
- Product comparison table.
- Customer assurance and delivery information.
- Responsive desktop and mobile layout.
- Accessible scrolling highlights with reduced-motion support.

## Customer and admin dashboards

Two sign-in areas sit beside the storefront, built from one shared set of components and one glass design system:

- **Customers** at `/account/`: a private place to send order requests and follow them.
- **Store admin** at `/admin/`: the store owner's desk for orders, customers, products and a change log.

No payment is taken. A customer sends an *order request*; the store contacts them to confirm price, payment and delivery.

> **Status:** the code is in the repository, but the dashboards only work once the database, its connection and the four admin secrets exist in Cloudflare. Until then `/account/` and `/admin/` show a "not set up yet" message. The step-by-step guide is [docs/deployment.md](docs/deployment.md). The storefront's built-in product list is separate and does not change when products are edited in the admin.

### What you can do (in plain words)

**If you are a customer**

- **Make an account** with your name, email and a password (at least 10 characters; a few words together work well).
- **Ask for an order.** Pick products, choose how many, check the delivery details (they are filled in from your account) and send the request. Nothing is charged. The store gets in touch to agree the price, payment and delivery.
- **See all your requests in one place**, newest first. Each one has a clear label: *Waiting for the store*, *Confirmed*, *Packed*, *Shipped*, *Delivered* or *Cancelled*. Tap a request to see what is in it, where it is going and how far along it is.
- **Change your mind.** While a request is still *Waiting for the store* you can cancel it. You are asked to confirm first, so a stray tap does nothing.
- **Keep your details up to date:** name, phone number and delivery address.
- **Change your password.** Doing so signs you out of your other devices.

**If you run the store**

- **Sign in safely** with your password *and* a 6-digit code from an authenticator app on your phone, like a second lock. Each code works only once.
- **See what needs attention** on the Overview: how many requests are waiting, confirmed, packed, shipped and delivered, how much money is in open orders, how many customers and products there are, and the latest requests.
- **Work through orders.** Filter by status, open an order to see what to pack and where to send it, then move it forward with one button each time (*Mark as Confirmed*, *Mark as Packed*, *Mark as Shipped*, *Mark as Delivered*). You can cancel any order that has not shipped yet (you are asked first). Leave a private note that customers never see.
- **Look after customers.** See everyone with an account, when they joined and last signed in, and their orders. Switch an account off or on. If someone is locked out, create a temporary password: it is shown once, and they must choose a new one when they sign in.
- **Manage products.** Add products, change prices, mark them *In stock*, *Low stock* or *Out of stock*, and untick *Customers can choose this product* to hide one.
- **Review the activity log:** a list of who changed what, and when.

**For everyone**

- **Looks good everywhere.** A soft frosted-glass style that follows the light or dark setting of your device, with gentle movement. If your device is set to reduce motion, the movement is switched off.
- **Easy on a phone or tablet.** One **Menu** button opens a sheet with every section, who is signed in, and *Sign out*. Buttons are not repeated: tap an order card or a table row to open it, instead of hunting for a small button on each one.
- **Easy for everyone to use.** Large tap targets, clear text contrast, full keyboard use, and labels for screen readers.
- **Built to be careful with data.** Passwords are never kept, only a scrambled form of them. Customers are signed out automatically after 7 days and the store owner after 8 hours. Too many wrong tries pause sign-in for 15 minutes. Every change the owner makes is written to the activity log.

### How it works

**A customer's journey**

```mermaid
flowchart TD
    A([Open the account page]) --> B{Already have an account?}
    B -- No --> C[Create an account]
    B -- Yes --> D[Sign in]
    C --> E[My orders]
    D --> E
    E --> F[Request an order]
    F --> G[Choose products and check delivery details]
    G --> H[Send the order request]
    H --> I[The store gets in touch about price, payment and delivery]
    I --> J[Follow progress in My orders]
    J --> K{Still waiting for the store?}
    K -- Yes --> L[Cancel the request, after confirming]
    K -- No --> M([Order arrives])
    E --> N[My details]
    E --> O[Password]
```

**The life of an order**

```mermaid
stateDiagram-v2
    direction LR
    [*] --> Waiting: Customer sends a request
    Waiting --> Confirmed: Store confirms
    Waiting --> Cancelled: Customer or store cancels
    Confirmed --> Packed: Store packs it
    Confirmed --> Cancelled: Store cancels
    Packed --> Shipped: Store ships it
    Packed --> Cancelled: Store cancels
    Shipped --> Delivered: Arrives
    Delivered --> [*]
    Cancelled --> [*]
    Waiting: Waiting for the store
```

**The store owner's day**

```mermaid
flowchart LR
    S[Sign in with password and code] --> O[Overview: what needs attention]
    O --> Q[Orders: open a waiting request]
    Q --> C1[Confirm] --> P1[Pack] --> H1[Ship] --> D1[Mark delivered]
    Q --> N[Add a private note]
    O --> CU[Customers: help someone who is locked out]
    O --> PR[Products: update prices and stock]
    O --> AC[Activity: review what changed]
```

**Signing in as the store owner**

```mermaid
sequenceDiagram
    participant Owner as Store owner
    participant Page as Admin page
    participant Service as Store service
    Owner->>Page: Email, password and 6-digit code
    Page->>Service: Send the sign-in
    Service->>Service: Check the password, the code (one use only) and the pause rules
    alt Everything is correct
        Service-->>Page: Signed in for 8 hours
        Page-->>Owner: Overview
    else Something is wrong
        Service-->>Page: One general message, the try is counted
        Page-->>Owner: Those sign-in details are incorrect
    end
```

**How the pieces fit together**

```mermaid
flowchart LR
    CUS([Customer]) --> ACC
    OWN([Store owner]) --> ADM
    subgraph CF [Cloudflare Pages]
        STORE[Storefront]
        ACC[Customer pages]
        ADM[Admin pages]
        API[Store service]
    end
    ACC --> API
    ADM --> API
    API --> DB[(D1 database)]
    STORE -. not connected yet .-> API
```

### Try it on your own computer

You need Node 22.5 or newer. It uses made-up demo accounts, nothing is saved and nothing reaches Cloudflare:

```bash
node --no-warnings scripts/dev-server.mjs
# Store      http://127.0.0.1:8788/
# Customers  http://127.0.0.1:8788/account/   aisha@demo.local / demo-customer-pass-2026
# Admin      http://127.0.0.1:8788/admin/     owner@demo.local / demo-admin-passphrase-2026
#            authenticator code: printed by the script, changes every 30 seconds
```

### Screenshots of every tab

<!-- screenshots:start (generated by scripts/screenshots.mjs, do not edit by hand) -->
_Captured 2026-11-08 from the local preview with demo data. Re-run `node --no-warnings scripts/screenshots.mjs` after every visual change._

| Tab | Desktop | Phone |
| --- | --- | --- |
| **Customer: Sign in**<br><sub>Email and password, with a Show button.</sub> | <img src="docs/screenshots/customer-sign-in.desktop.jpg" width="520" alt="Customer Sign in, desktop"> | <img src="docs/screenshots/customer-sign-in.phone.jpg" width="170" alt="Customer Sign in, phone"> |
| **Customer: Create account**<br><sub>Name, email and a password with a hint.</sub> | <img src="docs/screenshots/customer-create-account.desktop.jpg" width="520" alt="Customer Create account, desktop"> | <img src="docs/screenshots/customer-create-account.phone.jpg" width="170" alt="Customer Create account, phone"> |
| **Customer: My orders**<br><sub>Counts, then one card per order request.</sub> | <img src="docs/screenshots/customer-my-orders.desktop.jpg" width="520" alt="Customer My orders, desktop"> | <img src="docs/screenshots/customer-my-orders.phone.jpg" width="170" alt="Customer My orders, phone"> |
| **Customer: My orders (details open)**<br><sub>Items, delivery information and progress.</sub> | <img src="docs/screenshots/customer-order-details.desktop.jpg" width="520" alt="Customer My orders (details open), desktop"> | <img src="docs/screenshots/customer-order-details.phone.jpg" width="170" alt="Customer My orders (details open), phone"> |
| **Customer: Cancel a request**<br><sub>A glass confirmation before anything is cancelled.</sub> | <img src="docs/screenshots/customer-cancel-dialog.desktop.jpg" width="520" alt="Customer Cancel a request, desktop"> | <img src="docs/screenshots/customer-cancel-dialog.phone.jpg" width="170" alt="Customer Cancel a request, phone"> |
| **Customer: Request an order**<br><sub>Pick products, check delivery details, see the total.</sub> | <img src="docs/screenshots/customer-request-order.desktop.jpg" width="520" alt="Customer Request an order, desktop"> | <img src="docs/screenshots/customer-request-order.phone.jpg" width="170" alt="Customer Request an order, phone"> |
| **Customer: Request sent**<br><sub>Confirmation after sending. Nothing is charged.</sub> | <img src="docs/screenshots/customer-request-sent.desktop.jpg" width="520" alt="Customer Request sent, desktop"> | <img src="docs/screenshots/customer-request-sent.phone.jpg" width="170" alt="Customer Request sent, phone"> |
| **Customer: My details**<br><sub>Name, phone and the saved delivery address.</sub> | <img src="docs/screenshots/customer-my-details.desktop.jpg" width="520" alt="Customer My details, desktop"> | <img src="docs/screenshots/customer-my-details.phone.jpg" width="170" alt="Customer My details, phone"> |
| **Customer: Password**<br><sub>Change password, signs out other devices.</sub> | <img src="docs/screenshots/customer-password.desktop.jpg" width="520" alt="Customer Password, desktop"> | <img src="docs/screenshots/customer-password.phone.jpg" width="170" alt="Customer Password, phone"> |
| **Customer: Phone menu**<br><sub>Phones and tablets get one Menu button that opens this sheet.</sub> | <sub>Phone and tablet only</sub> | <img src="docs/screenshots/customer-mobile-menu.phone.jpg" width="170" alt="Customer Phone menu, phone"> |
| **Admin: Sign in**<br><sub>Password plus a one-time authenticator code.</sub> | <img src="docs/screenshots/admin-sign-in.desktop.jpg" width="520" alt="Admin Sign in, desktop"> | <img src="docs/screenshots/admin-sign-in.phone.jpg" width="170" alt="Admin Sign in, phone"> |
| **Admin: Overview**<br><sub>Key numbers, the order pipeline, latest requests.</sub> | <img src="docs/screenshots/admin-overview.desktop.jpg" width="520" alt="Admin Overview, desktop"> | <img src="docs/screenshots/admin-overview.phone.jpg" width="170" alt="Admin Overview, phone"> |
| **Admin: Orders**<br><sub>Filter by status, open any order.</sub> | <img src="docs/screenshots/admin-orders.desktop.jpg" width="520" alt="Admin Orders, desktop"> | <img src="docs/screenshots/admin-orders.phone.jpg" width="170" alt="Admin Orders, phone"> |
| **Admin: Orders (one order open)**<br><sub>Progress, items, delivery, status buttons, internal note.</sub> | <img src="docs/screenshots/admin-order-detail.desktop.jpg" width="520" alt="Admin Orders (one order open), desktop"> | <img src="docs/screenshots/admin-order-detail.phone.jpg" width="170" alt="Admin Orders (one order open), phone"> |
| **Admin: Customers**<br><sub>Everyone with an account.</sub> | <img src="docs/screenshots/admin-customers.desktop.jpg" width="520" alt="Admin Customers, desktop"> | <img src="docs/screenshots/admin-customers.phone.jpg" width="170" alt="Admin Customers, phone"> |
| **Admin: Customers (one open)**<br><sub>Details, disable or reset password, their orders.</sub> | <img src="docs/screenshots/admin-customer-detail.desktop.jpg" width="520" alt="Admin Customers (one open), desktop"> | <img src="docs/screenshots/admin-customer-detail.phone.jpg" width="170" alt="Admin Customers (one open), phone"> |
| **Admin: Products**<br><sub>What customers can choose, and the prices.</sub> | <img src="docs/screenshots/admin-products.desktop.jpg" width="520" alt="Admin Products, desktop"> | <img src="docs/screenshots/admin-products.phone.jpg" width="170" alt="Admin Products, phone"> |
| **Admin: Products (editing)**<br><sub>Edit a product or add a new one.</sub> | <img src="docs/screenshots/admin-product-form.desktop.jpg" width="520" alt="Admin Products (editing), desktop"> | <img src="docs/screenshots/admin-product-form.phone.jpg" width="170" alt="Admin Products (editing), phone"> |
| **Admin: Activity**<br><sub>Latest sign-ins and changes.</sub> | <img src="docs/screenshots/admin-activity.desktop.jpg" width="520" alt="Admin Activity, desktop"> | <img src="docs/screenshots/admin-activity.phone.jpg" width="170" alt="Admin Activity, phone"> |
| **Admin: Phone menu**<br><sub>The same Menu sheet, with the admin sections.</sub> | <sub>Phone and tablet only</sub> | <img src="docs/screenshots/admin-mobile-menu.phone.jpg" width="170" alt="Admin Phone menu, phone"> |

**Dark mode** follows the device setting:

<img src="docs/screenshots/customer-my-orders-dark.desktop.jpg" width="380" alt="Customer My orders (dark mode)"> <img src="docs/screenshots/admin-overview-dark.desktop.jpg" width="380" alt="Admin Overview (dark mode)">
<!-- screenshots:end -->

### Design and components

- [docs/deployment.md](docs/deployment.md): putting the dashboards live on Cloudflare, step by step, in plain words, with a checklist and what to do if something goes wrong.
- [docs/design-system.md](docs/design-system.md): the glass look, colours (light and dark), spacing, layout breakpoints, motion and accessibility rules.
- [docs/components.md](docs/components.md): every component with its options and a short example, plus how to add a new tab.
- [docs/dashboards.md](docs/dashboards.md): how the dashboards are built, the security model, the list of requests the service answers, day-to-day use and troubleshooting.

### Update log

Screenshots above are refreshed with every visual update (`node --no-warnings scripts/screenshots.mjs`). Add a line here for each update.

| Date | Update |
| --- | --- |
| 2026-11-08 | **Phone menu and fewer repeated buttons.** On phones and tablets the bottom bar is replaced by one Menu button that opens a glass sheet (sections, who is signed in, Sign out). Order cards and table rows open when tapped, so there is no "Details", "Open" or "Edit" button repeated on every one. Added plain-language feature list, flow diagrams, deployment guide and screenshots of the new menu. |
| 2026-11-08 | Customer and admin dashboards: shared component library, glass design system with aligned layouts, side navigation on desktop, entrance and hover animations (off for reduced motion), light and dark themes, confirmation dialogs, screenshots of every tab. |

## Product video behavior

- The hero frame uses its original responsive 4:3 proportions without an oversized minimum height; the hosted video is enlarged horizontally and centered inside the clipped frame so it fills the frame without side gaps.
- The separate four-video strip below the hero has been removed.
- All six product cards use distinct video sources. No product card reuses another card's clip.
- Product card frames retain their original 4:3 aspect ratio on desktop and mobile, with full-bleed centered video cropping.
- Clips are native muted, looping, inline (`playsinline`) videos delivered from Cloudinary. They play only while on screen, show a still frame first, and start on the first tap if the phone blocks autoplay (for example iPhone Low Power Mode). If a clip cannot load, it falls back to the Cloudinary player. See [video media notes](docs/video-media.md).

## Product video media

See [video media implementation notes](docs/video-media.md) for the unique source-to-product assignments and playback behavior.

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
node --no-warnings --test "tests/*.test.mjs"   # dashboard API and setup script (Node 22.5+)
```

Optional, needs [Playwright](https://playwright.dev): a browser test of both dashboards on desktop and phone (`node --no-warnings tests/e2e/dashboards.e2e.mjs`) and the screenshot refresh (`node --no-warnings scripts/screenshots.mjs`).

These checks validate basic document structure and embedded JavaScript syntax. They do not replace browser interaction testing, dependency vulnerability scanning or a security review.

The `Storefront checks` GitHub Actions workflow runs on pushes and pull requests with read-only repository permissions. Cloudflare Pages is connected directly to this repository and is configured to deploy production from `main`; preview deployments are disabled.

## Current platform scope

The repository contains a static storefront with a local demo cart, plus the customer and admin dashboards described above (API in `functions/`, database schema in `migrations/`). The dashboards are **not live** until the Cloudflare D1 database, binding and admin secrets are set up, and the public storefront is not yet connected to them (no "Account" link, and its cart does not create order requests). Checkout, payment processing, shipping integration, email notifications, persistent inventory counts and media management are **not** implemented. Do not describe these as live features.

Cloudflare Pages hosts the static site. Any future server-side functionality should use explicitly approved Cloudflare services (for example, Workers, D1 and R2) with separate environments, least-privilege bindings, server-side authorization, secrets management, audit logging and tested backups. No Aiven service or database connection is part of this project.

See [the platform architecture and implementation plan](docs/store-platform-plan.md) before extending the application.

## License

© 2026 Jels Kitchenwares. All rights reserved.
