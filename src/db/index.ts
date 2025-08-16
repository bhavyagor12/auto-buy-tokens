import Database from "better-sqlite3";

const db = new Database("state.sqlite");
db.exec(`
  CREATE TABLE IF NOT EXISTS seen_tokens (
    token TEXT PRIMARY KEY,
    first_seen_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS positions (
    token TEXT PRIMARY KEY,
    symbol TEXT,
    decimals INTEGER,
    qty TEXT,              -- token units (string)
    entry_price_usd REAL,  -- from GeckoTerminal at buy time
    tp_pct REAL,
    sl_pct REAL,
    bought_at_ms INTEGER
  );
`);

// helpers
const upsertSeen = db.prepare(
  `INSERT OR IGNORE INTO seen_tokens(token, first_seen_ms) VALUES(?, ?)`,
);
const getSeen = db.prepare(
  `SELECT first_seen_ms FROM seen_tokens WHERE token = ?`,
);
const insertPos = db.prepare(
  `INSERT OR REPLACE INTO positions(token, symbol, decimals, qty, entry_price_usd, tp_pct, sl_pct, bought_at_ms) VALUES(?,?,?,?,?,?,?,?)`,
);
const getPositions = db.prepare(`SELECT * FROM positions`);
const removePosition = db.prepare(`DELETE FROM positions WHERE token = ?`);
