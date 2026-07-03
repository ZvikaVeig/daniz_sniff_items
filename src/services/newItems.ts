import { config } from "../config";
import { getCatalogDisplayName, normalizeCatalogBaseUrl } from "../scrapers/catalogs";
import { getAppSetting, setAppSetting } from "./db";
import { sendTelegramMessage } from "./notifier";

function counterKey(catalogUrl: string): string {
  return `new_items_counter:${normalizeCatalogBaseUrl(catalogUrl)}`;
}

function getCounter(catalogUrl: string): number {
  const raw = getAppSetting(counterKey(catalogUrl));
  const value = parseInt(raw ?? "0", 10);
  return Number.isFinite(value) ? value : 0;
}

function setCounter(catalogUrl: string, value: number): void {
  setAppSetting(counterKey(catalogUrl), String(value));
}

/**
 * Accumulate newly-listed products for a catalog. When the running total reaches
 * the threshold, send a short Telegram nudge and reset the counter.
 */
export async function registerNewItems(
  catalogUrl: string,
  newCount: number
): Promise<{ notified: boolean; total: number }> {
  if (newCount <= 0) {
    return { notified: false, total: getCounter(catalogUrl) };
  }

  const total = getCounter(catalogUrl) + newCount;

  if (total < config.newItemsThreshold) {
    setCounter(catalogUrl, total);
    return { notified: false, total };
  }

  const siteName = getCatalogDisplayName(catalogUrl);
  const link = normalizeCatalogBaseUrl(catalogUrl);
  const message = [
    `🆕 עלו ${total} פריטים חדשים ל-${siteName}!`,
    "שווה להיכנס לבדוק אם יש משהו בשבילך 👀🛍️",
    link,
  ].join("\n");

  await sendTelegramMessage(message);
  setCounter(catalogUrl, 0);
  console.log(`[new-items] Notified: ${total} new items on ${siteName}`);

  return { notified: true, total };
}
