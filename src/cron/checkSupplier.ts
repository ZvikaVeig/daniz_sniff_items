import { getScraperForSupplier } from "../scrapers";
import {
  isProductSeen,
  listActiveWatchItems,
  markProductSeen,
} from "../services/db";
import { findMatches } from "../services/matcher";
import {
  isMonitoringPaused,
  saveLastCheckResult,
} from "../services/monitoring";
import { sendTelegramAlert } from "../services/notifier";

let isRunning = false;

export interface SupplierCheckResult {
  productsFound: number;
  matchesFound: number;
  alertsSent: number;
  skipped?: boolean;
  reason?: string;
}

export async function runSupplierCheck(options?: {
  force?: boolean;
}): Promise<SupplierCheckResult> {
  if (isRunning) {
    console.log("[cron] Previous check still running, skipping");
    return { productsFound: 0, matchesFound: 0, alertsSent: 0, skipped: true, reason: "busy" };
  }

  if (!options?.force && isMonitoringPaused()) {
    console.log("[cron] Monitoring is paused, skipping");
    return { productsFound: 0, matchesFound: 0, alertsSent: 0, skipped: true, reason: "paused" };
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  try {
    const watchItems = listActiveWatchItems();
    if (watchItems.length === 0) {
      console.log(`[cron] ${startedAt} — no active watch items`);
      const result = { productsFound: 0, matchesFound: 0, alertsSent: 0 };
      saveLastCheckResult(result);
      return result;
    }

    const scraper = getScraperForSupplier();
    const products = await scraper.fetchProducts();
    const matches = findMatches(products, watchItems);

    let alertsSent = 0;
    for (const { watchItem, product } of matches) {
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

    console.log(
      `[cron] ${startedAt} — products=${products.length} matches=${matches.length} alerts=${alertsSent}`
    );

    const result = {
      productsFound: products.length,
      matchesFound: matches.length,
      alertsSent,
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
      error: message,
    });
    throw error;
  } finally {
    isRunning = false;
  }
}
