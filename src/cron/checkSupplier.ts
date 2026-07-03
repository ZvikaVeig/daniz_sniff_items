import { config } from "../config";
import { getScraperForCatalogUrl } from "../scrapers";
import { normalizeCatalogBaseUrl } from "../scrapers/catalogs";
import {
  isProductSeen,
  listActiveWatchItems,
  markProductSeen,
  recordCatalogProducts,
  upsertFoundProduct,
} from "../services/db";
import { findMatches } from "../services/matcher";
import {
  isMonitoringPaused,
  saveLastCheckResult,
} from "../services/monitoring";
import { registerNewItems } from "../services/newItems";
import { fetchProductImageUrl } from "../services/productImage";
import { sendTelegramAlert } from "../services/notifier";

let isRunning = false;

export interface SupplierCheckResult {
  productsFound: number;
  matchesFound: number;
  alertsSent: number;
  newItems: number;
  catalogsChecked: number;
  skipped?: boolean;
  reason?: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runSupplierCheck(options?: {
  force?: boolean;
}): Promise<SupplierCheckResult> {
  if (isRunning) {
    console.log("[cron] Previous check still running, skipping");
    return emptyResult({ skipped: true, reason: "busy" });
  }

  if (!options?.force && isMonitoringPaused()) {
    console.log("[cron] Monitoring is paused, skipping");
    return emptyResult({ skipped: true, reason: "paused" });
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  try {
    const watchItems = listActiveWatchItems();
    const catalogUrls = config.catalogUrls;

    let productsFound = 0;
    let matchesFound = 0;
    let alertsSent = 0;
    let newItemsTotal = 0;

    for (let i = 0; i < catalogUrls.length; i++) {
      const catalogUrl = normalizeCatalogBaseUrl(catalogUrls[i]);
      const scraper = getScraperForCatalogUrl(catalogUrl);
      const products = await scraper.fetchProducts();
      productsFound += products.length;

      // Track all products for the "new items on site" notifier.
      const { newCount, wasEmpty } = recordCatalogProducts(
        catalogUrl,
        products.map((p) => p.externalId)
      );
      if (!wasEmpty && newCount > 0) {
        newItemsTotal += newCount;
        await registerNewItems(catalogUrl, newCount);
      } else if (wasEmpty) {
        console.log(`[cron] Seeded ${products.length} products for new catalog ${catalogUrl}`);
      }

      // Keyword matching: every active watch item is checked against every site.
      if (watchItems.length > 0) {
        const matches = findMatches(products, watchItems);
        matchesFound += matches.length;
        alertsSent += await processMatches(matches, catalogUrl);
      }

      if (i < catalogUrls.length - 1 && config.scrapePageDelayMs > 0) {
        await delay(config.scrapePageDelayMs);
      }
    }

    console.log(
      `[cron] ${startedAt} — catalogs=${catalogUrls.length} products=${productsFound} matches=${matchesFound} alerts=${alertsSent} newItems=${newItemsTotal}`
    );

    const result: SupplierCheckResult = {
      productsFound,
      matchesFound,
      alertsSent,
      newItems: newItemsTotal,
      catalogsChecked: catalogUrls.length,
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
      newItems: 0,
      catalogsChecked: 0,
      error: message,
    });
    throw error;
  } finally {
    isRunning = false;
  }
}

async function processMatches(
  matches: ReturnType<typeof findMatches>,
  catalogUrl: string
): Promise<number> {
  let alertsSent = 0;

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
      catalogUrl,
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
    console.log(`[cron] Alert sent: "${product.title}" for watch "${watchItem.keywords}"`);
  }

  return alertsSent;
}

function emptyResult(extra: Partial<SupplierCheckResult>): SupplierCheckResult {
  return {
    productsFound: 0,
    matchesFound: 0,
    alertsSent: 0,
    newItems: 0,
    catalogsChecked: 0,
    ...extra,
  };
}
