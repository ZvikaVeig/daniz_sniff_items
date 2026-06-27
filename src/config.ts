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
  cronSchedule: process.env.CRON_SCHEDULE ?? "*/1 * * * *",
  cronEnabled: process.env.CRON_ENABLED !== "false",
};
