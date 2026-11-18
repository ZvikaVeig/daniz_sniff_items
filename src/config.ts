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

export const config = {
  port: parseInt(process.env.PORT ?? "3000", 10),
  apiKey: requireEnv("API_KEY"),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  databasePath: process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "sniff.db"),

  // The CRM (Base44) function that saves and scores the items. Same key as API_KEY (SNIFF_API_KEY in the CRM).
  crmFunctionUrl: process.env.CRM_FUNCTION_URL ?? "https://daniz-crm-8f6865dd.base44.app/functions/buyerAgent",
  crmApiKey: process.env.CRM_API_KEY ?? process.env.API_KEY ?? "",
  // Link in the Telegram messages
  crmBuyerPageUrl: process.env.CRM_BUYER_URL ?? "https://daniz-crm-8f6865dd.base44.app/buyer",

  // Every 10 minutes. The bill on Fly does not depend on this (it is the machine size) - keep the machine at 256MB.
  cronSchedule: process.env.SCAN_CRON ?? "*/10 * * * *",
  cronEnabled: process.env.CRON_ENABLED !== "false",
  // pages per store on a normal run; a deep run (all pages) every DEEP_EVERY_HOURS in case the list is not newest-first
  quickPages: parseInt(process.env.QUICK_PAGES ?? "3", 10),
  deepPages: parseInt(process.env.DEEP_PAGES ?? "40", 10),
  deepEveryHours: parseInt(process.env.DEEP_EVERY_HOURS ?? "2", 10),
  // first run of a store: send to the CRM only items published in the last N days
  firstRunDays: parseInt(process.env.FIRST_RUN_DAYS ?? "3", 10),

  batchAlertSize: parseInt(process.env.BATCH_ALERT_SIZE ?? "20", 10),
  goodScore: parseInt(process.env.GOOD_SCORE ?? "80", 10),

  dailyDigestEnabled: process.env.DAILY_DIGEST_ENABLED !== "false",
  dailyDigestCron: process.env.DAILY_DIGEST_CRON ?? "0 9 * * *",
  dailyDigestTimezone: process.env.DAILY_DIGEST_TIMEZONE ?? "Asia/Jerusalem",
  dailyDigestTop: parseInt(process.env.DAILY_DIGEST_TOP ?? "5", 10),
};
