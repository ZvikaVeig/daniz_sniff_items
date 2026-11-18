import { config } from "../config";
import { STORES, storeName } from "../stores";
import { ItemRow, itemsSince } from "../services/db";
import { ils, scoreText } from "../services/format";
import { sendMessage } from "../services/telegram";
import { getRandomComplimentGreeting } from "../services/telegramGreeting";

const dayIn = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));

// The morning message: yesterday's new items per store, how many were good, and the best ones.
export function buildDailyDigestMessage(): string {
  const tz = config.dailyDigestTimezone;
  const yesterday = dayIn(new Date(Date.now() - 24 * 3600 * 1000).toISOString(), tz);
  const rows = itemsSince(new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()).filter((r) => dayIn(r.first_seen, tz) === yesterday);
  const kept = rows.filter((r) => r.crm_status === "created" || r.crm_status === "existed");
  const isGood = (r: ItemRow) => r.score != null && r.score >= config.goodScore;
  const good = kept.filter(isGood);
  const watch = kept.filter((r) => r.watch_hits);

  const lines = [
    `${getRandomComplimentGreeting()}`,
    "",
    "כאן הקניין שלך 🛍️ אני עובד בשבילך מסביב לשעון, בודק לך את כל הספקים כל 10 דקות, כדי שאת לא תצטרכי לעבור על הכול לבד.",
    "",
  ];

  if (!rows.length) {
    lines.push("אתמול לא עלו אצל הספקים פריטים חדשים. אני ממשיך לבדוק בשבילך 👀");
  } else {
    lines.push("📊 הסיכום של אתמול:");
    lines.push(`סך הכול עלו ${rows.length} פריטים חדשים. ${kept.length} מהם מדגמים שכבר מכרת, ו-${good.length} מוצלחים (ציון ${config.goodScore} ומעלה).`);
    for (const s of STORES) {
      const n = rows.filter((r) => r.store === s.code).length;
      if (!n) continue;
      const k = kept.filter((r) => r.store === s.code).length;
      const g = good.filter((r) => r.store === s.code).length;
      lines.push(`• ${s.name}: ${n} פריטים (${k} מדגמים שלך, ${g} מוצלחים)`);
    }
    if (watch.length) lines.push("", `🔔 ${watch.length} פריטים התאימו לשמות שאת מחפשת.`);

    const top = kept
      .filter((r) => r.score != null)
      .sort((a, b) => (b.score! - a.score!) || ((b.profit ?? -1e9) - (a.profit ?? -1e9)))
      .slice(0, config.dailyDigestTop);
    if (top.length) {
      lines.push("", `🏆 ${top.length} הכי שווים מאתמול:`);
      top.forEach((r, i) => {
        lines.push(`${i + 1}. ${r.title || ""}`);
        lines.push(`ציון ${scoreText(r.score)} · רווח צפוי ${ils(r.profit)} · ${storeName(r.store)}`);
        if (r.url) lines.push(r.url);
        lines.push("");
      });
    }
  }

  lines.push("", "מוזמנת להיכנס לדף הקניין ב-CRM ולהסתכל על הכול:", config.crmBuyerPageUrl, "", "יום מקסים! 💖");
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function sendDailyDigest(): Promise<void> {
  await sendMessage(buildDailyDigestMessage());
  console.log("[daily-digest] sent");
}
