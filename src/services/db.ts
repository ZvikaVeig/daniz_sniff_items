import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config";

// SQLite on the Fly volume. Old tables from the first sniff version (watch_items, seen_products, found_products,
// suppliers) stay untouched - the watch words are moved once to the CRM (BuyerWatch).

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(config.databasePath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- every supplier product we already saw (so only new ones go to the CRM)
  CREATE TABLE IF NOT EXISTS seen (
    store TEXT NOT NULL,
    pid TEXT NOT NULL,
    first_seen TEXT NOT NULL,
    PRIMARY KEY (store, pid)
  );

  -- new items with what the CRM answered (for the batch alert and the morning summary)
  CREATE TABLE IF NOT EXISTS items (
    store TEXT NOT NULL,
    pid TEXT NOT NULL,
    title TEXT,
    url TEXT,
    image_url TEXT,
    price REAL,
    currency TEXT,
    cost_ils REAL,
    profit REAL,
    score REAL,
    category TEXT,
    brand TEXT,
    watch_hits TEXT,
    crm_status TEXT,
    published_at TEXT,
    first_seen TEXT NOT NULL,
    PRIMARY KEY (store, pid)
  );

  -- new items since the last "20 new items" message, per store
  CREATE TABLE IF NOT EXISTS counters (
    store TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    good INTEGER NOT NULL DEFAULT 0,
    unknown INTEGER NOT NULL DEFAULT 0
  );
`);

// added 18.11.2026: how many of the new items are models Danni already sold (the CRM keeps only those)
if (!(db.prepare("PRAGMA table_info(counters)").all() as { name: string }[]).some((c) => c.name === "known")) {
  db.exec("ALTER TABLE counters ADD COLUMN known INTEGER NOT NULL DEFAULT 0");
}

export function getAppSetting(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value;
}

export function setAppSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function seenCount(store: string): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM seen WHERE store = ?").get(store) as { n: number }).n;
}

export function isSeen(store: string, pid: string): boolean {
  return !!db.prepare("SELECT 1 FROM seen WHERE store = ? AND pid = ?").get(store, pid);
}

export function markSeen(store: string, pids: string[]): void {
  const now = new Date().toISOString();
  const st = db.prepare("INSERT OR IGNORE INTO seen (store, pid, first_seen) VALUES (?, ?, ?)");
  db.transaction((list: string[]) => { for (const p of list) st.run(store, p, now); })(pids);
}

export interface ItemRow {
  store: string;
  pid: string;
  title: string | null;
  url: string | null;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  cost_ils: number | null;
  profit: number | null;
  score: number | null;
  category: string | null;
  brand: string | null;
  watch_hits: string | null;
  crm_status: string | null;
  published_at: string | null;
  first_seen: string;
}

export function saveItem(r: ItemRow): void {
  db.prepare(
    `INSERT OR REPLACE INTO items (store, pid, title, url, image_url, price, currency, cost_ils, profit, score, category, brand,
       watch_hits, crm_status, published_at, first_seen)
     VALUES (@store, @pid, @title, @url, @image_url, @price, @currency, @cost_ils, @profit, @score, @category, @brand,
       @watch_hits, @crm_status, @published_at, @first_seen)`
  ).run(r);
}

export function itemsSince(iso: string): ItemRow[] {
  return db.prepare("SELECT * FROM items WHERE first_seen >= ? ORDER BY first_seen").all(iso) as ItemRow[];
}

export function addToCounter(store: string, count: number, good: number, known: number) {
  db.prepare(
    `INSERT INTO counters (store, count, good, known) VALUES (?, ?, ?, ?)
     ON CONFLICT(store) DO UPDATE SET count = count + excluded.count, good = good + excluded.good, known = known + excluded.known`
  ).run(store, count, good, known);
  return db.prepare("SELECT * FROM counters WHERE store = ?").get(store) as { store: string; count: number; good: number; known: number };
}

export function resetCounter(store: string) {
  db.prepare("UPDATE counters SET count = 0, good = 0, unknown = 0, known = 0 WHERE store = ?").run(store);
}

// keep the small database small
export function prune(): void {
  const items = new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString();
  const seen = new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString();
  db.prepare("DELETE FROM items WHERE first_seen < ?").run(items);
  db.prepare("DELETE FROM seen WHERE first_seen < ?").run(seen);
}

// the watch words of the first sniff version (moved to the CRM once)
export function legacyWatchWords(): string[] {
  const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='watch_items'").get();
  if (!t) return [];
  const rows = db.prepare("SELECT keywords FROM watch_items WHERE is_active = 1").all() as { keywords: string }[];
  return [...new Set(rows.map((r) => String(r.keywords || "").trim()).filter(Boolean))];
}
