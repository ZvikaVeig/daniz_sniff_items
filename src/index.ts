import cors from "cors";
import express from "express";
import cron from "node-cron";
import monitoringRouter from "./api/routes/monitoring";
import watchItemsRouter from "./api/routes/watchItems";
import { authMiddleware } from "./api/middleware/auth";
import { config } from "./config";
import { runSupplierCheck } from "./cron/checkSupplier";
import { getScraperForSupplier } from "./scrapers";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/watch-items", authMiddleware, watchItemsRouter);
app.use("/api/monitoring", authMiddleware, monitoringRouter);

app.post("/api/test-scrape", authMiddleware, async (_req, res) => {
  try {
    const scraper = getScraperForSupplier();
    const products = await scraper.fetchProducts();
    res.json({ count: products.length, products: products.slice(0, 20) });
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
