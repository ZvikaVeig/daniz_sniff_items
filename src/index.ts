import cors from "cors";
import express from "express";
import cron from "node-cron";
import foundProductsRouter from "./api/routes/foundProducts";
import monitoringRouter from "./api/routes/monitoring";
import watchItemsRouter from "./api/routes/watchItems";
import { authMiddleware } from "./api/middleware/auth";
import { config } from "./config";
import { sendDailyDigest } from "./cron/dailyDigest";
import { runSupplierCheck } from "./cron/checkSupplier";
import { getScraperForCatalogUrl } from "./scrapers";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/watch-items", authMiddleware, watchItemsRouter);
app.use("/api/monitoring", authMiddleware, monitoringRouter);
app.use("/api/found-products", authMiddleware, foundProductsRouter);

app.post("/api/test-scrape", authMiddleware, async (req, res) => {
  try {
    const { catalogUrl } = req.body as { catalogUrl?: string };
    if (!catalogUrl?.trim()) {
      res.status(400).json({ error: "catalogUrl is required" });
      return;
    }

    const scraper = getScraperForCatalogUrl(catalogUrl.trim());
    const products = await scraper.fetchProducts();
    res.json({ count: products.length, catalogUrl, products: products.slice(0, 20) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scrape failed";
    res.status(500).json({ error: message });
  }
});

app.post("/api/run-check", authMiddleware, async (_req, res) => {
  try {
    const result = await runSupplierCheck({ force: true });
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check failed";
    res.status(500).json({ error: message });
  }
});

app.listen(config.port, () => {
  console.log(`[server] Listening on port ${config.port}`);
});

if (config.cronEnabled) {
  if (!cron.validate(config.cronSchedule)) {
    throw new Error(`Invalid CRON_SCHEDULE: ${config.cronSchedule}`);
  }

  cron.schedule(config.cronSchedule, () => {
    runSupplierCheck().catch((err) => {
      console.error("[cron] Unhandled error:", err);
    });
  });

  console.log(`[cron] Scheduled: ${config.cronSchedule}`);
} else {
  console.log("[cron] Disabled (CRON_ENABLED=false)");
}

if (config.dailyDigestEnabled) {
  if (!cron.validate(config.dailyDigestCron)) {
    throw new Error(`Invalid DAILY_DIGEST_CRON: ${config.dailyDigestCron}`);
  }

  cron.schedule(
    config.dailyDigestCron,
    () => {
      sendDailyDigest().catch((err) => {
        console.error("[daily-digest] Unhandled error:", err);
      });
    },
    { timezone: config.dailyDigestTimezone }
  );

  console.log(
    `[daily-digest] Scheduled: ${config.dailyDigestCron} (${config.dailyDigestTimezone})`
  );
} else {
  console.log("[daily-digest] Disabled (DAILY_DIGEST_ENABLED=false)");
}
