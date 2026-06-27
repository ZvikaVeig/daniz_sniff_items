import { Router } from "express";
import { config } from "../../config";
import {
  getMonitoringStatus,
  setMonitoringPaused,
} from "../../services/monitoring";

const router = Router();

router.get("/status", (_req, res) => {
  res.json(getMonitoringStatus(config.cronEnabled, config.cronSchedule));
});

router.post("/pause", (_req, res) => {
  setMonitoringPaused(true);
  res.json({ paused: true, message: "Automatic monitoring paused" });
});

router.post("/resume", (_req, res) => {
  setMonitoringPaused(false);
  res.json({ paused: false, message: "Automatic monitoring resumed" });
});

export default router;
