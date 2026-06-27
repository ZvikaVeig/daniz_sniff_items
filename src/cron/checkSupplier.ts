import { getScraperForSupplier } from "../scrapers";
import {
  isProductSeen,
  listActiveWatchItems,
  markProductSeen,
} from "../services/db";
import { findMatches } from "../services/matcher";
import { sendTelegramAlert } from "../services/notifier";

let isRunning = false;

export async function runSupplierCheck(): Promise<{
  productsFound: number;
  matchesFound: number;
  alertsSent: number;
}> {
  if (isRunning) {
    console.log("[cron] Previous check still running, skipping");
    return { productsFound: 0, matchesFound: 0, alertsSent: 0 };
  }

  isRunning = true;
  const startedAt = new Date().toISOString();

  try {
    const watchItems = listActiveWatchItems();
    if (watchItems.length === 0) {
      console.log(`[cron] ${startedAt} — no active watch items`);
      return { productsFound: 0, matchesFound: 0, alertsSent: 0 };
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

    return {
      productsFound: products.length,
      matchesFound: matches.length,
      alertsSent,
    };
  } catch (error) {
    console.error("[cron] Check failed:", error);
    throw error;
  } finally {
    isRunning = false;
  }
}
