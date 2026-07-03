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
  cronSchedule: process.env.CRON_SCHEDULE ?? "*/3 * * * *",
  cronEnabled: process.env.CRON_ENABLED !== "false",
  dailyDigestEnabled: process.env.DAILY_DIGEST_ENABLED !== "false",
  dailyDigestCron: process.env.DAILY_DIGEST_CRON ?? "0 9 * * *",
  dailyDigestTimezone: process.env.DAILY_DIGEST_TIMEZONE ?? "Asia/Jerusalem",
  dailyDigestRecipientName: process.env.DAILY_DIGEST_RECIPIENT_NAME ?? "Dani",
};
