import axios from "axios";
import { config } from "../config";
import { ScrapedProduct } from "../scrapers/types";
import { WatchItem } from "./db";
import { withComplimentGreeting } from "./telegramGreeting";

export async function sendTelegramMessage(
  text: string,
  options?: { disableWebPagePreview?: boolean; skipGreeting?: boolean }
): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping message");
    return;
  }

  const messageText = options?.skipGreeting ? text : withComplimentGreeting(text);

  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  await axios.post(url, {
    chat_id: config.telegramChatId,
    text: messageText,
    disable_web_page_preview: options?.disableWebPagePreview ?? true,
  });
}

export async function sendTelegramAlert(
  watchItem: WatchItem,
  product: ScrapedProduct
): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping alert");
    return;
  }

  const priceLine = product.price ? `\nPrice: ${product.price}` : "";
  const text = [
    "New bag detected!",
    "",
    `Watch: ${watchItem.keywords}`,
    `Title: ${product.title}${priceLine}`,
    product.url,
  ].join("\n");

  await sendTelegramMessage(text, { disableWebPagePreview: false });
}
