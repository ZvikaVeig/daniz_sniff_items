import dotenv from "dotenv";
import path from "path";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const DEFAULT_CATALOG_URLS = [
  "https://brandoffbuyingclub.com/collections/international-stock-from-hong-kong",
  "https://brandoffbuyingclub.com/collections/new-in",
];

function parseCatalogUrls(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return DEFAULT_CATALOG_URLS;
  }
  const urls = raw
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  return urls.length > 0 ? urls : DEFAULT_CATALOG_URLS;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = parseInt(raw ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  apiKey: requireEnv("API_KEY"),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  databasePath: process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "sniff.db"),
  cronSchedule: process.env.CRON_SCHEDULE ?? "*/3 * * * *",
  cronEnabled: process.env.CRON_ENABLED !== "false",
  catalogUrls: parseCatalogUrls(process.env.CATALOG_URLS),
  scrapeMaxPages: parsePositiveInt(process.env.SCRAPE_MAX_PAGES, 2),
  scrapePageDelayMs: parsePositiveInt(process.env.SCRAPE_PAGE_DELAY_MS, 4000),
  newItemsThreshold: parsePositiveInt(process.env.NEW_ITEMS_THRESHOLD, 10),
  dailyDigestEnabled: process.env.DAILY_DIGEST_ENABLED !== "false",
  dailyDigestCron: process.env.DAILY_DIGEST_CRON ?? "0 9 * * *",
  dailyDigestTimezone: process.env.DAILY_DIGEST_TIMEZONE ?? "Asia/Jerusalem",
  dailyDigestRecipientName: process.env.DAILY_DIGEST_RECIPIENT_NAME ?? "Dani",
};
