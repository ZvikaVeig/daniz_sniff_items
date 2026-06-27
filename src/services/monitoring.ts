import { getAppSetting, listActiveWatchItems, setAppSetting } from "./db";

const SETTINGS_KEY_PAUSED = "monitoring_paused";
const SETTINGS_KEY_LAST_CHECK = "last_check";

export interface LastCheckResult {
  at: string;
  productsFound: number;
  matchesFound: number;
  alertsSent: number;
  error?: string;
}

export function isMonitoringPaused(): boolean {
  return getAppSetting(SETTINGS_KEY_PAUSED) === "1";
}

export function setMonitoringPaused(paused: boolean): void {
  setAppSetting(SETTINGS_KEY_PAUSED, paused ? "1" : "0");
}

export function saveLastCheckResult(
  result: Omit<LastCheckResult, "at"> & { at?: string }
): void {
  const payload: LastCheckResult = {
    at: result.at ?? new Date().toISOString(),
    productsFound: result.productsFound,
    matchesFound: result.matchesFound,
    alertsSent: result.alertsSent,
    ...(result.error ? { error: result.error } : {}),
  };
  setAppSetting(SETTINGS_KEY_LAST_CHECK, JSON.stringify(payload));
}

export function getLastCheckResult(): LastCheckResult | null {
  const raw = getAppSetting(SETTINGS_KEY_LAST_CHECK);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as LastCheckResult;
  } catch {
    return null;
  }
}

export function getMonitoringStatus(cronEnabled: boolean, cronSchedule: string) {
  return {
    paused: isMonitoringPaused(),
    cronEnabled,
    cronSchedule,
    activeWatchItems: listActiveWatchItems().length,
    lastCheck: getLastCheckResult(),
  };
}
