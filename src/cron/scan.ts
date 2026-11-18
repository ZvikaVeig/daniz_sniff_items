import { config } from "../config";
import { STORES, Store, storeName } from "../stores";
import {
  addToCounter, getAppSetting, isSeen, markSeen, prune, resetCounter, saveItem, setAppSetting,
} from "../services/db";
import { crm } from "../services/crm";
import { isMonitoringPaused, saveLastScan } from "../services/monitoring";
import { sendMessage, sendPhoto } from "../services/telegram";
import { itemLines } from "../services/format";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const DAY = 24 * 3600 * 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let running = false;

async function fetchPage(store: Store, page: number): Promise<any[]> {
  const url = `${store.origin}/products.json?limit=250&page=${page}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json,*/*" } });
    if (res.status === 429) { await sleep(5000 * (attempt + 1)); continue; }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j: any = await res.json();
    return j.products || [];
  }
  throw new Error("HTTP 429 (חסום זמנית)");
}

// only what the CRM needs (smaller and lighter on memory)
function slim(p: any) {
  return {
    id: p.id, handle: p.handle, title: p.title, vendor: p.vendor, product_type: p.product_type, tags: p.tags,
    published_at: p.published_at, created_at: p.created_at, body_html: String(p.body_html || "").slice(0, 3000),
    variants: [(p.variants || [])[0] || {}].map((v: any) => ({ price: v.price, available: v.available })),
    images: (p.images || []).slice(0, 8).map((i: any) => ({ src: i.src })),
  };
}

const available = (p: any) => (p.variants || [])[0]?.available !== false;

export interface StoreResult {
  store: string;
  ok: boolean;
  error?: string;
  first_run?: boolean;
  deep?: boolean;
  pages: number;
  new_items: number;
  sent: number;
  created: number;
  good: number;
  unknown: number;
  watch_alerts: number;
}

async function scanStore(store: Store, deep: boolean): Promise<StoreResult> {
  // first run = until everything reached the CRM once (no alerts on it, only the last days are sent)
  const firstRun = !getAppSetting(`initialized_${store.code}`);
  const maxPages = firstRun || deep ? config.deepPages : config.quickPages;
  const r: StoreResult = { store: store.code, ok: true, first_run: firstRun, deep, pages: 0, new_items: 0, sent: 0, created: 0, good: 0, unknown: 0, watch_alerts: 0 };
  const firstRunFrom = new Date(Date.now() - config.firstRunDays * DAY).toISOString();

  const toSend: any[] = [];
  const seenOnly: string[] = []; // sold / too old on the first run - remember without sending
  try {
    for (let page = 1; page <= maxPages; page++) {
      const products = await fetchPage(store, page);
      r.pages++;
      if (!products.length) break;
      const unseen = products.filter((p) => !isSeen(store.code, String(p.id)));
      for (const p of unseen) {
        const pub = String(p.published_at || p.created_at || "");
        if (!available(p) || (firstRun && pub < firstRunFrom)) seenOnly.push(String(p.id));
        else toSend.push(slim(p));
      }
      // the list is (mostly) newest first: on a normal run stop at the first page with nothing new
      if (!firstRun && !deep && unseen.length === 0) break;
      await sleep(1500);
    }
  } catch (e) {
    r.ok = false;
    r.error = (e as Error).message;
  }
  markSeen(store.code, seenOnly);
  r.new_items = firstRun ? 0 : toSend.length;

  // to the CRM in small parts; an item is marked as seen only after the CRM saved it (else it is sent again next time)
  const now = new Date().toISOString();
  const alerts: any[] = [];
  for (let i = 0; i < toSend.length; i += 20) {
    const part = toSend.slice(i, i + 20);
    let data: any;
    try {
      data = await crm("ingest", { store: store.code, products: part });
    } catch (e) {
      r.ok = false;
      r.error = (e as Error).message;
      break;
    }
    for (const x of data.results || []) {
      const hits: string[] = x.watch_hits || [];
      saveItem({
        store: store.code, pid: String(x.pid), title: x.title ?? null, url: x.url ?? null, image_url: x.image_url ?? null,
        price: x.price ?? null, currency: x.currency ?? store.currency, cost_ils: x.cost_ils ?? null, profit: x.expected_profit ?? null,
        score: x.score ?? null, category: x.category ?? null, brand: x.brand ?? null, watch_hits: hits.length ? JSON.stringify(hits) : null,
        crm_status: x.status ?? null, published_at: x.published_at ?? null, first_seen: now,
      });
      const kept = x.status === "created" || x.status === "existed";
      if (x.status === "created") r.created++;
      if (kept && x.score != null && x.score >= config.goodScore) r.good++;
      if (kept && x.score == null) r.unknown++;
      if (kept && hits.length && !firstRun) alerts.push(x);
    }
    markSeen(store.code, part.map((p) => String(p.id)));
    r.sent += part.length;
  }
  if (firstRun && r.ok) setAppSetting(`initialized_${store.code}`, new Date().toISOString());

  // 🔔 one message per item that matched one of Danni's names
  for (const x of alerts) {
    const caption = [`🔔 מצאתי פריט שחיפשת: ${(x.watch_hits || []).join(", ")}`, "", ...itemLines({ ...x, profit: x.expected_profit }), "", x.url].join("\n");
    await sendPhoto(x.image_url || null, caption).catch((e) => console.error("[alert]", e));
    r.watch_alerts++;
  }

  // 📦 every 20 new items of a store (counted across runs)
  if (!firstRun && r.new_items > 0) {
    const c = addToCounter(store.code, r.new_items, r.good, r.unknown);
    if (c.count >= config.batchAlertSize) {
      await sendMessage([
        `📦 עלו ${c.count} פריטים חדשים ב${storeName(store.code)}`,
        `⭐ מוצלחים (ציון ${config.goodScore} ומעלה): ${c.good}`,
        `❔ דגמים שעוד לא נמכרו אצלך: ${c.unknown}`,
        "",
        "כל הפריטים מחכים לך בדף הקניין:",
        config.crmBuyerPageUrl,
      ].join("\n")).catch((e) => console.error("[batch]", e));
      resetCounter(store.code);
    }
  }
  return r;
}

export async function runScan(options?: { force?: boolean; deep?: boolean }) {
  if (running) return { skipped: "busy" };
  if (!options?.force && isMonitoringPaused()) return { skipped: "paused" };
  running = true;
  try {
    const results: StoreResult[] = [];
    for (const store of STORES) {
      const lastDeep = Number(getAppSetting(`last_deep_${store.code}`) || 0);
      const deep = !!options?.deep || Date.now() - lastDeep > config.deepEveryHours * 3600 * 1000;
      const r = await scanStore(store, deep);
      if (deep && r.ok) setAppSetting(`last_deep_${store.code}`, String(Date.now()));
      results.push(r);
      console.log(`[scan] ${store.code}`, JSON.stringify(r));
      await crm("report", { store: store.code, result: r }).catch((e) => console.error("[report]", (e as Error).message));
    }
    saveLastScan(results);
    if (!getAppSetting("started_message") && results.some((x) => x.first_run && x.ok)) {
      setAppSetting("started_message", "1");
      await sendMessage([
        "היי דני 💖 הקניין שלך התחיל לעבוד!",
        "מעכשיו אני בודק את קלאב, פרפוס ודי-סי-טי כל 10 דקות, ומכניס לך הכול לדף הקניין ב-CRM.",
        "כשיעלה פריט שמתאים לשמות שאת מחפשת, אשלח לך אותו מיד עם תמונה, מחיר ורווח צפוי.",
        "כל בוקר בתשע תקבלי ממני סיכום של היום הקודם.",
        "",
        config.crmBuyerPageUrl,
      ].join("\n")).catch(() => null);
    }
    if (Date.now() - Number(getAppSetting("last_prune") || 0) > DAY) {
      prune();
      setAppSetting("last_prune", String(Date.now()));
    }
    return { results };
  } finally {
    running = false;
  }
}
