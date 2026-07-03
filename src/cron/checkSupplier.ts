import { getScraperForCatalogUrl } from "../scrapers";
import {
  isProductSeen,
  listActiveWatchItems,
  markProductSeen,
  upsertFoundProduct,
  WatchItem,
} from "../services/db";
import { findMatches } from "../services/matcher";
import {
  isMonitoringPaused,
  saveLastCheckResult,
} from "../services/monitoring";
import { fetchProductImageUrl } from "../services/productImage";
import { sendBulkNewItemsAlert, sendTelegramAlert } from "../services/notifier";

let isRunning = false;

/** Alert threshold for new items found in a single catalog link (more than this fires the alert). */
const NEW_ITEMS_ALERT_THRESHOLD = 10;

export interface SupplierCheckResult {
  productsFound: number;
  matchesFound: number;
  alertsSent: number;
  catalogsChecked: number;
  skipped?: boolean;
  reason?: string;
}

function groupWatchItemsByCatalogUrl(watchItems: WatchItem[]): Map<string, WatchItem[]> {
  const groups = new Map<string, WatchItem[]>();

  for (const item of watchItems) {
    const existing = groups.get(item.catalog_url) ?? [];
    existing.push(item);
    groups.set(item.catalog_url, existing);
  }

  return groups;
}

export async function runSupplierCheck(options?: {
  force?: boolean;
}): Promise<SupplierCheckResult> {
  if (isRunning) {
    console.log("[cron] Previous check still running, skipping");
    return {
      productsFound: 0,
      matchesFound: 0,
      alertsSent: 0,
      catalogsChecked: 0,
      skipped: true,
      reason: "busy",
    };
  }

  if (!options?.force && isMonitoringPaused()) {
    console.log("[cron] Monitoring is paused, skipping");
    return {
      productsFound: 0,
      matchesFound: 0,
      alertsSent: 0,
      catalogsChecked: 0,
      skipped: true,
      reason: "paused",
    };
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  try {
    const watchItems = listActiveWatchItems();
    if (watchItems.length === 0) {
      console.log(`[cron] ${startedAt} — no active watch items`);
      const result = { productsFound: 0, matchesFound: 0, alertsSent: 0, catalogsChecked: 0 };
      saveLastCheckResult(result);
      return result;
    }

    const groups = groupWatchItemsByCatalogUrl(watchItems);
    let productsFound = 0;
    let matchesFound = 0;
    let alertsSent = 0;

    for (const [catalogUrl, itemsForCatalog] of groups) {
      const scraper = getScraperForCatalogUrl(catalogUrl);
      const products = await scraper.fetchProducts();
      productsFound += products.length;

      const catalogSupplierId = itemsForCatalog[0]?.supplier_id ?? 1;
      const newProducts = products.filter(
        (product) => !isProductSeen(catalogSupplierId, product.externalId)
      );

      if (newProducts.length > NEW_ITEMS_ALERT_THRESHOLD) {
        await sendBulkNewItemsAlert(catalogUrl, newProducts.length);
        alertsSent++;
        console.log(
          `[cron] Bulk alert: ${newProducts.length} new items in ${catalogUrl}`
        );
      }

      const matches = findMatches(products, itemsForCatalog);
      matchesFound += matches.length;

      for (const { watchItem, product } of matches) {
        let imageUrl = product.imageUrl;
        if (!imageUrl) {
          imageUrl = await fetchProductImageUrl(product.url);
        }

        upsertFoundProduct({
          supplierId: watchItem.supplier_id,
          watchItemId: watchItem.id,
          externalId: product.externalId,
          title: product.title,
          price: product.price,
          imageUrl,
          productUrl: product.url,
          watchKeywords: watchItem.keywords,
          catalogUrl: watchItem.catalog_url,
        });

        if (isProductSeen(watchItem.supplier_id, product.externalId)) {
          continue;
        }

        await sendTelegramAlert(watchItem, product);
        markProductSeen(
          watchItem.supplier_id,
          product.externalId,
          product.url,
          product.title
        );
        alertsSent++;
        console.log(
          `[cron] Alert sent: "${product.title}" for watch "${watchItem.keywords}" (${catalogUrl})`
        );
      }

      // Mark every scraped product as seen so bulk "new items" alerts fire only once per batch.
      for (const product of newProducts) {
        markProductSeen(
          catalogSupplierId,
          product.externalId,
          product.url,
          product.title
        );
      }
    }

    console.log(
      `[cron] ${startedAt} — catalogs=${groups.size} products=${productsFound} matches=${matchesFound} alerts=${alertsSent}`
    );

    const result = {
      productsFound,
      matchesFound,
      alertsSent,
      catalogsChecked: groups.size,
    };
    saveLastCheckResult(result);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check failed";
    console.error("[cron] Check failed:", error);
    saveLastCheckResult({
      productsFound: 0,
      matchesFound: 0,
      alertsSent: 0,
      catalogsChecked: 0,
      error: message,
    });
    throw error;
  } finally {
    isRunning = false;
  }
}
