import { getAppSetting, setAppSetting } from "./db";

const KEY_PAUSED = "monitoring_paused";
const KEY_LAST = "last_scan";

export function isMonitoringPaused(): boolean {
  return getAppSetting(KEY_PAUSED) === "1";
}

export function setMonitoringPaused(paused: boolean): void {
  setAppSetting(KEY_PAUSED, paused ? "1" : "0");
}

export function saveLastScan(result: unknown): void {
  setAppSetting(KEY_LAST, JSON.stringify({ at: new Date().toISOString(), result }));
}

export function getLastScan(): unknown {
  const raw = getAppSetting(KEY_LAST);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
