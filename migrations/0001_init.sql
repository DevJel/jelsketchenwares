-- Jels Kitchenwares: customer and admin dashboards (Cloudflare D1 / SQLite).
-- Additive and idempotent. Apply with:
--   npx wrangler d1 migrations apply jels-kitchenwares-db --remote

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address_json TEXT NOT NULL DEFAULT '{}',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

-- Only a SHA-256 hash of the session token is stored, never the token itself.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin')),
  customer_id INTEGER REFERENCES customers (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON sessions (customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);

-- Failed sign-in counters and temporary lockouts.
CREATE TABLE IF NOT EXISTS auth_attempts (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL,
  locked_until INTEGER
);

-- Authenticator codes that were already accepted (a code works once).
CREATE TABLE IF NOT EXISTS used_totp (
  counter INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'low_stock', 'out_of_stock')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Order requests. Items and prices are copied into items_json when the order is
-- placed, so later price changes never alter an existing order.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers (id),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
  items_json TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  contact_json TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log (at);

-- The six products on the storefront today (prices in USD cents).
-- The storefront page still shows its own built-in copy of this list.
INSERT INTO products (id, name, description, category, price_cents, stock_status, active, created_at, updated_at)
SELECT * FROM (
  SELECT 1 AS id, 'Jels Clear Glass Pan 24cm' AS name, 'Borosilicate glass pan, wooden handle. See your food cook.' AS description, 'Pans' AS category, 4900 AS price_cents, 'in_stock' AS stock_status, 1 AS active, '2026-11-08T00:00:00.000Z' AS created_at, '2026-11-08T00:00:00.000Z' AS updated_at
  UNION ALL SELECT 2, 'Jels Glass Pot 3.5L with Lid', 'Even heat, see-through lid, stovetop to table.', 'Pots', 6800, 'in_stock', 1, '2026-11-08T00:00:00.000Z', '2026-11-08T00:00:00.000Z'
  UNION ALL SELECT 3, 'Jels Glass Mixing Bowl Trio', '3 nesting borosilicate bowls.', 'Bowls', 3600, 'in_stock', 1, '2026-11-08T00:00:00.000Z', '2026-11-08T00:00:00.000Z'
  UNION ALL SELECT 4, 'Jels Glass Bake & Serve Set', 'Baking dish, teapot, measuring jug, prep bowls.', 'Bake', 5400, 'low_stock', 1, '2026-11-08T00:00:00.000Z', '2026-11-08T00:00:00.000Z'
  UNION ALL SELECT 5, 'Jels Glass Storage Jars Set of 3', 'Airtight glass lids, pantry clear.', 'Storage', 3200, 'in_stock', 1, '2026-11-08T00:00:00.000Z', '2026-11-08T00:00:00.000Z'
  UNION ALL SELECT 6, 'Jels Glass Teapot 1.2L', 'Blooming tea, visible brew.', 'Bake', 3900, 'in_stock', 1, '2026-11-08T00:00:00.000Z', '2026-11-08T00:00:00.000Z'
) WHERE NOT EXISTS (SELECT 1 FROM products);
