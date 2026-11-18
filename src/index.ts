import cors from "cors";
import express from "express";
import cron from "node-cron";
import monitoringRouter from "./api/routes/monitoring";
import { authMiddleware } from "./api/middleware/auth";
import { config } from "./config";
import { buildDailyDigestMessage, sendDailyDigest } from "./cron/dailyDigest";
import { runScan } from "./cron/scan";
import { getAppSetting, legacyWatchWords, setAppSetting } from "./services/db";
import { crm } from "./services/crm";
import { STORES } from "./stores";

// Daniz buyer scanner: every 10 minutes reads the suppliers' new items, sends them to the CRM (the Buyer page),
// and sends Danni Telegram messages (items matching her names, every 20 new items of a store, a 9:00 summary).

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/monitoring", authMiddleware, monitoringRouter);

app.post("/api/run-check", authMiddleware, async (req, res) => {
  try {
    res.json(await runScan({ force: true, deep: !!req.body?.deep }));
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

// can the server read the suppliers? (one page each, nothing is saved)
app.get("/api/probe", authMiddleware, async (_req, res) => {
  const out: any[] = [];
  for (const s of STORES) {
    try {
      const r = await fetch(`${s.origin}/products.json?limit=5&page=1`, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
      const j: any = r.ok ? await r.json() : null;
      out.push({ store: s.code, status: r.status, count: j?.products?.length ?? 0, first: j?.products?.[0]?.title, published: j?.products?.[0]?.published_at });
    } catch (e) {
      out.push({ store: s.code, error: (e as Error).message });
    }
  }
  res.json(out);
});

app.get("/api/digest-preview", authMiddleware, (_req, res) => {
  res.type("text/plain").send(buildDailyDigestMessage());
});

app.post("/api/digest-send", authMiddleware, async (_req, res) => {
  try {
    await sendDailyDigest();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.listen(config.port, () => console.log(`[server] Listening on port ${config.port}`));

// one time: the watch words of the old sniff version move to the CRM (BuyerWatch, managed on the Buyer page)
async function moveLegacyWatchWords() {
  if (getAppSetting("watch_moved_to_crm")) return;
  const names = legacyWatchWords();
  try {
    if (names.length) {
      const r = await crm("import_watch", { names });
      console.log(`[migrate] ${names.length} watch words sent to the CRM, ${r.added} added`);
    }
    setAppSetting("watch_moved_to_crm", "1");
  } catch (e) {
    console.error("[migrate]", (e as Error).message);
  }
}

async function start() {
  await moveLegacyWatchWords();
  if (config.cronEnabled) {
    if (!cron.validate(config.cronSchedule)) throw new Error(`Invalid CRON_SCHEDULE: ${config.cronSchedule}`);
    cron.schedule(config.cronSchedule, () => {
      runScan().catch((err) => console.error("[scan] Unhandled error:", err));
    });
    console.log(`[scan] Scheduled: ${config.cronSchedule}`);
    // first scan shortly after start (a deploy) instead of waiting for the next 10 minutes
    setTimeout(() => runScan().catch((err) => console.error("[scan]", err)), 20_000);
  }
  if (config.dailyDigestEnabled) {
    if (!cron.validate(config.dailyDigestCron)) throw new Error(`Invalid DAILY_DIGEST_CRON: ${config.dailyDigestCron}`);
    cron.schedule(config.dailyDigestCron, () => {
      sendDailyDigest().catch((err) => console.error("[daily-digest]", err));
    }, { timezone: config.dailyDigestTimezone });
    console.log(`[daily-digest] Scheduled: ${config.dailyDigestCron} (${config.dailyDigestTimezone})`);
  }
}

start().catch((e) => console.error("[start]", e));
