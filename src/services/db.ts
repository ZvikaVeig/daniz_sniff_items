import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { BRANDOFF_CHANEL_BAGS_URL } from "../scrapers/brandoffScraper";

export interface Supplier {
  id: number;
  name: string;
  base_url: string;
  scraper_type: string;
  config_json: string | null;
}

export interface WatchItem {
  id: number;
  supplier_id: number;
  keywords: string;
  is_active: number;
  created_at: string;
}

export interface SeenProduct {
  id: number;
  supplier_id: number;
  external_id: string;
  product_url: string;
  title: string;
  first_seen_at: string;
}

const dbDir = path.dirname(config.databasePath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.databasePath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    scraper_type TEXT NOT NULL DEFAULT 'html',
    config_json TEXT
  );

  CREATE TABLE IF NOT EXISTS watch_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL DEFAULT 1,
    keywords TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
  );

  CREATE TABLE IF NOT EXISTS seen_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    external_id TEXT NOT NULL,
    product_url TEXT NOT NULL,
    title TEXT NOT NULL,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(supplier_id, external_id)
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

export function getAppSetting(key: string): string | undefined {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setAppSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

const supplierCount = db.prepare("SELECT COUNT(*) as count FROM suppliers").get() as { count: number };
if (supplierCount.count === 0) {
  db.prepare(
    "INSERT INTO suppliers (name, base_url, scraper_type) VALUES (?, ?, ?)"
  ).run("brandoff", BRANDOFF_CHANEL_BAGS_URL, "brandoff");
} else {
  // Upgrade legacy placeholder supplier from initial scaffold
  db.prepare(
    `UPDATE suppliers SET name = 'brandoff', base_url = ?, scraper_type = 'brandoff'
     WHERE id = 1 AND (scraper_type = 'html' OR base_url LIKE '%example.com%')`
  ).run(BRANDOFF_CHANEL_BAGS_URL);
}

export function getDefaultSupplier(): Supplier {
  const row = db.prepare("SELECT * FROM suppliers WHERE id = 1").get() as Supplier | undefined;
  if (!row) {
    throw new Error("Default supplier not found");
  }
  return row;
}

export function listWatchItems(): WatchItem[] {
  return db.prepare("SELECT * FROM watch_items ORDER BY created_at DESC").all() as WatchItem[];
}

export function getWatchItem(id: number): WatchItem | undefined {
  return db.prepare("SELECT * FROM watch_items WHERE id = ?").get(id) as WatchItem | undefined;
}

export function createWatchItem(keywords: string, supplierId = 1): WatchItem {
  const result = db
    .prepare("INSERT INTO watch_items (supplier_id, keywords) VALUES (?, ?)")
    .run(supplierId, keywords.trim());
  return getWatchItem(Number(result.lastInsertRowid))!;
}

export function updateWatchItem(
  id: number,
  updates: { keywords?: string; is_active?: boolean }
): WatchItem | undefined {
  const existing = getWatchItem(id);
  if (!existing) return undefined;

  const keywords = updates.keywords?.trim() ?? existing.keywords;
  const isActive = updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : existing.is_active;

  db.prepare("UPDATE watch_items SET keywords = ?, is_active = ? WHERE id = ?").run(
    keywords,
    isActive,
    id
  );
  return getWatchItem(id);
}

export function deleteWatchItem(id: number): boolean {
  const result = db.prepare("DELETE FROM watch_items WHERE id = ?").run(id);
  return result.changes > 0;
}

export function listActiveWatchItems(): WatchItem[] {
  return db
    .prepare("SELECT * FROM watch_items WHERE is_active = 1 ORDER BY created_at DESC")
    .all() as WatchItem[];
}

export function isProductSeen(supplierId: number, externalId: string): boolean {
  const row = db
    .prepare("SELECT id FROM seen_products WHERE supplier_id = ? AND external_id = ?")
    .get(supplierId, externalId);
  return !!row;
}

export function markProductSeen(
  supplierId: number,
  externalId: string,
  productUrl: string,
  title: string
): void {
  db.prepare(
    "INSERT OR IGNORE INTO seen_products (supplier_id, external_id, product_url, title) VALUES (?, ?, ?, ?)"
  ).run(supplierId, externalId, productUrl, title);
}

export function listSeenProducts(limit = 50): SeenProduct[] {
  return db
    .prepare("SELECT * FROM seen_products ORDER BY first_seen_at DESC LIMIT ?")
    .all(limit) as SeenProduct[];
}
