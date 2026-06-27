import axios from "axios";
import { config } from "../config";
import { ScrapedProduct } from "../scrapers/types";
import { WatchItem } from "./db";

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

  const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  await axios.post(url, {
    chat_id: config.telegramChatId,
    text,
    disable_web_page_preview: false,
  });
}
