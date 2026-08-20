/**
 * Saved dashboard view (Docs/DECISIONS.md 0.17): the last fiscal year + period
 * the user looked at, persisted per browser. Reopening the dashboard tomorrow
 * lands on the same period — a "default from saved view", not a filter reset.
 */
import { FiscalPeriod, periodsInYear } from "./fiscalWeek";

const KEY = "grower-settlement.dashboard.view";

interface SavedView {
  fiscalYear: number;
  period: number;
}

export function loadSavedPeriod(): FiscalPeriod | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedView>;
    if (typeof parsed.fiscalYear !== "number" || typeof parsed.period !== "number") return null;
    return periodsInYear(parsed.fiscalYear)[parsed.period - 1] ?? null;
  } catch {
    return null;
  }
}

export function savePeriod(p: FiscalPeriod): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ fiscalYear: p.fiscalYear, period: p.period }));
  } catch {
    // Storage unavailable (private mode) — the dashboard just defaults to today.
  }
}

const NAV_KEY = "grower-settlement.nav.collapsed";

/** Sidebar collapse state, persisted per browser so a presenter can hide the
 *  navigation once and demo full-screen across reloads. */
export function loadNavCollapsed(): boolean {
  try {
    return localStorage.getItem(NAV_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveNavCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(NAV_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage unavailable — the sidebar just resets to expanded next visit.
  }
}
