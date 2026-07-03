import { listActiveWatchItems } from "../services/db";
import { getMonitoredSites, isMonitoringPaused } from "../services/monitoring";
import { sendTelegramMessage } from "../services/notifier";

export function buildDailyDigestMessage(): string {
  const activeItems = listActiveWatchItems();
  const paused = isMonitoringPaused();
  const sites = getMonitoredSites();

  const lines = [
    "אל תדאגי, אני עובד בשבילך 24/7 ומחפש לך את התיקים שאת רוצה... 🤗✨💖",
    "",
  ];

  if (paused) {
    lines.push("⏸️ כרגע המעקב האוטומטי מושהה (אבל אני עדיין כאן!).");
  } else {
    lines.push("✅ המעקב פעיל ורץ כל הזמן.");
  }

  lines.push("", "🛒 האתרים שאני סורק:", "");
  if (sites.length === 0) {
    lines.push("(אין אתרים מוגדרים)");
  } else {
    for (const site of sites) {
      lines.push(`   • ${site.name}`);
    }
  }

  lines.push("", "📋 התיקים שאני מחפש:", "");
  if (activeItems.length === 0) {
    lines.push("(עדיין אין מילות חיפוש פעילות — הוסיפי בדשבורד)");
  } else {
    for (const item of activeItems) {
      lines.push(`   • ${item.keywords}`);
    }
  }

  lines.push("", "יום נפלא! 🌸👜💫");

  return lines.join("\n").trim();
}

export async function sendDailyDigest(): Promise<void> {
  const text = buildDailyDigestMessage();
  await sendTelegramMessage(text);
  console.log("[daily-digest] Morning status message sent");
}
