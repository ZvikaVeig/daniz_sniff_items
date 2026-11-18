import { Router } from "express";
import { config } from "../../config";
import { getLastScan, isMonitoringPaused, setMonitoringPaused } from "../../services/monitoring";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({ paused: isMonitoringPaused(), cronEnabled: config.cronEnabled, cronSchedule: config.cronSchedule, lastScan: getLastScan() });
});

router.post("/pause", (_req, res) => {
  setMonitoringPaused(true);
  res.json({ paused: true });
});

router.post("/resume", (_req, res) => {
  setMonitoringPaused(false);
  res.json({ paused: false });
});

export default router;
