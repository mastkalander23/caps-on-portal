CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','investor')),
  ratio REAL NOT NULL DEFAULT 0,       -- manager's cut of this investor's profit, e.g. 0.30 = 30%
  tax_rate REAL NOT NULL DEFAULT 0,    -- applied on the investor's net share at settlement, e.g. 0.10 = 10%
  joined_on TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Maps a script/scrip name (as you refer to it) to the symbol the price feed understands.
-- For NSE India stocks via Yahoo Finance, the symbol is usually TICKER.NS (e.g. TCS.NS).
CREATE TABLE IF NOT EXISTS ticker_map (
  script TEXT PRIMARY KEY,
  yahoo_symbol TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  script TEXT NOT NULL,
  buy_date TEXT,
  qty REAL NOT NULL,
  buy_price REAL NOT NULL,
  sell_date TEXT,          -- NULL = still open
  sell_price REAL,         -- NULL = still open
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS price_cache (
  symbol TEXT PRIMARY KEY,
  price REAL NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trades_user ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_script ON trades(script);
