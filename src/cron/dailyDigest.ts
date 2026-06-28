import { config } from "../config";
import { listActiveWatchItems } from "../services/db";
import { isMonitoringPaused } from "../services/monitoring";
import { sendTelegramMessage } from "../services/notifier";

function groupWatchItemsByCatalogUrl(
  items: ReturnType<typeof listActiveWatchItems>
): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const item of items) {
    const keywords = groups.get(item.catalog_url) ?? [];
    keywords.push(item.keywords);
    groups.set(item.catalog_url, keywords);
  }

  return groups;
}

export function buildDailyDigestMessage(): string {
  const name = config.dailyDigestRecipientName;
  const activeItems = listActiveWatchItems();
  const paused = isMonitoringPaused();
  const groups = groupWatchItemsByCatalogUrl(activeItems);

  const lines = [
    `היי ${name} 💕`,
    "",
    "אל תדאגי, אני עובד בשבילך 24/7 ומחפש לך את התיקים שאת רוצה... 🤗✨💖",
    "",
  ];

  if (paused) {
    lines.push("⏸️ כרגע המעקב האוטומטי מושהה (אבל אני עדיין כאן!).");
  } else {
    lines.push("✅ המעקב פעיל ורץ כל דקה.");
  }

  lines.push("", "📋 התיקים שאני מחפש:", "");

  if (activeItems.length === 0) {
    lines.push("(עדיין אין מילות חיפוש פעילות — הוסיפי בדשבורד)");
  } else {
    for (const [catalogUrl, keywords] of groups) {
      lines.push(`🔗 ${catalogUrl}`);
      for (const keyword of keywords) {
        lines.push(`   • ${keyword}`);
      }
      lines.push("");
    }
  }

  lines.push("יום נפלא! 🌸👜💫");

  return lines.join("\n").trim();
}

export async function sendDailyDigest(): Promise<void> {
  const text = buildDailyDigestMessage();
  await sendTelegramMessage(text);
  console.log("[daily-digest] Morning status message sent");
}
