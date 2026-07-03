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
  catalog_url: string;
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

export interface FoundProduct {
  id: number;
  supplier_id: number;
  watch_item_id: number | null;
  external_id: string;
  title: string;
  price: string | null;
  image_url: string | null;
  product_url: string;
  watch_keywords: string | null;
  catalog_url: string | null;
  first_found_at: string;
  last_matched_at: string;
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
    catalog_url TEXT NOT NULL DEFAULT '',
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

  CREATE TABLE IF NOT EXISTS found_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    watch_item_id INTEGER,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    price TEXT,
    image_url TEXT,
    product_url TEXT NOT NULL,
    watch_keywords TEXT,
    catalog_url TEXT,
    first_found_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_matched_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(supplier_id, external_id)
  );

  CREATE TABLE IF NOT EXISTS catalog_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    catalog_url TEXT NOT NULL,
    external_id TEXT NOT NULL,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(catalog_url, external_id)
  );
`);

migrateWatchItemsCatalogUrl();
migrateFoundProductsCatalogUrl();

function migrateWatchItemsCatalogUrl(): void {
  const columns = db.prepare("PRAGMA table_info(watch_items)").all() as { name: string }[];
  if (!columns.some((col) => col.name === "catalog_url")) {
    db.exec(`ALTER TABLE watch_items ADD COLUMN catalog_url TEXT NOT NULL DEFAULT ''`);
  }
  // catalog_url is now optional: keywords are matched against all monitored sites.
}

function migrateFoundProductsCatalogUrl(): void {
  const columns = db.prepare("PRAGMA table_info(found_products)").all() as { name: string }[];
  if (!columns.some((col) => col.name === "catalog_url")) {
    db.exec(`ALTER TABLE found_products ADD COLUMN catalog_url TEXT`);
  }
}

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

export function createWatchItem(
  keywords: string,
  catalogUrl: string,
  supplierId = 1
): WatchItem {
  const result = db
    .prepare("INSERT INTO watch_items (supplier_id, keywords, catalog_url) VALUES (?, ?, ?)")
    .run(supplierId, keywords.trim(), catalogUrl);
  return getWatchItem(Number(result.lastInsertRowid))!;
}

export function updateWatchItem(
  id: number,
  updates: { keywords?: string; catalogUrl?: string; is_active?: boolean }
): WatchItem | undefined {
  const existing = getWatchItem(id);
  if (!existing) return undefined;

  const keywords = updates.keywords?.trim() ?? existing.keywords;
  const catalogUrl = updates.catalogUrl ?? existing.catalog_url;
  const isActive = updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : existing.is_active;

  db.prepare(
    "UPDATE watch_items SET keywords = ?, catalog_url = ?, is_active = ? WHERE id = ?"
  ).run(keywords, catalogUrl, isActive, id);
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

export function upsertFoundProduct(params: {
  supplierId: number;
  watchItemId: number;
  externalId: string;
  title: string;
  price?: string;
  imageUrl?: string;
  productUrl: string;
  watchKeywords: string;
  catalogUrl?: string;
}): FoundProduct {
  const existing = db
    .prepare("SELECT * FROM found_products WHERE supplier_id = ? AND external_id = ?")
    .get(params.supplierId, params.externalId) as FoundProduct | undefined;

  if (existing) {
    const imageUrl = params.imageUrl ?? existing.image_url ?? null;
    db.prepare(
      `UPDATE found_products
       SET watch_item_id = ?, title = ?, price = ?, image_url = ?, product_url = ?,
           watch_keywords = ?, catalog_url = ?, last_matched_at = datetime('now')
       WHERE id = ?`
    ).run(
      params.watchItemId,
      params.title,
      params.price ?? null,
      imageUrl,
      params.productUrl,
      params.watchKeywords,
      params.catalogUrl ?? existing.catalog_url ?? null,
      existing.id
    );
    return getFoundProduct(existing.id)!;
  }

  const result = db
    .prepare(
      `INSERT INTO found_products
       (supplier_id, watch_item_id, external_id, title, price, image_url, product_url, watch_keywords, catalog_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      params.supplierId,
      params.watchItemId,
      params.externalId,
      params.title,
      params.price ?? null,
      params.imageUrl ?? null,
      params.productUrl,
      params.watchKeywords,
      params.catalogUrl ?? null
    );

  return getFoundProduct(Number(result.lastInsertRowid))!;
}

export function getFoundProduct(id: number): FoundProduct | undefined {
  return db.prepare("SELECT * FROM found_products WHERE id = ?").get(id) as FoundProduct | undefined;
}

export function listRecentFoundProducts(limit = 10): FoundProduct[] {
  return db
    .prepare("SELECT * FROM found_products ORDER BY last_matched_at DESC LIMIT ?")
    .all(limit) as FoundProduct[];
}

/**
 * Record every product currently seen on a catalog page.
 * Returns how many were brand-new, and whether the catalog had no prior records
 * (first run) so the caller can seed silently instead of alerting.
 */
export function recordCatalogProducts(
  catalogUrl: string,
  externalIds: string[]
): { newCount: number; wasEmpty: boolean } {
  const existing = db
    .prepare("SELECT COUNT(*) as count FROM catalog_products WHERE catalog_url = ?")
    .get(catalogUrl) as { count: number };
  const wasEmpty = existing.count === 0;

  const insert = db.prepare(
    "INSERT OR IGNORE INTO catalog_products (catalog_url, external_id) VALUES (?, ?)"
  );

  const insertMany = db.transaction((ids: string[]) => {
    let inserted = 0;
    for (const id of ids) {
      const result = insert.run(catalogUrl, id);
      inserted += result.changes;
    }
    return inserted;
  });

  const newCount = insertMany(externalIds);
  return { newCount, wasEmpty };
}
