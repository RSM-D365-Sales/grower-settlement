/**
 * Fiscal calendar for reporting: Sunday–Saturday weeks ("periods").
 *
 * Definition (Docs/DECISIONS.md 0.17): a week belongs to the fiscal year of its
 * week-ending Saturday, and its period number is that Saturday's index within
 * the year (first Saturday = period 1). Every calendar date therefore belongs
 * to exactly one (fiscalYear, period) — years have 52 or 53 periods, and the
 * fiscal year matches the calendar year of the grower contracts/season.
 */

const DAY_MS = 86_400_000;

export interface FiscalPeriod {
  fiscalYear: number;
  /** 1-based week number within the fiscal year (52 or 53 per year). */
  period: number;
  /** Sunday, yyyy-mm-dd (may fall in the prior calendar year for period 1). */
  start: string;
  /** Saturday, yyyy-mm-dd. */
  end: string;
}

function toUtcMs(dateStr: string): number {
  const [y = 0, m = 1, d = 1] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fmt(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function fromSaturday(satMs: number): FiscalPeriod {
  const sat = new Date(satMs);
  const fiscalYear = sat.getUTCFullYear();
  const dayOfYear = Math.floor((satMs - Date.UTC(fiscalYear, 0, 1)) / DAY_MS) + 1;
  return {
    fiscalYear,
    period: Math.ceil(dayOfYear / 7),
    start: fmt(satMs - 6 * DAY_MS),
    end: fmt(satMs),
  };
}

/** The fiscal period containing the given date. */
export function periodForDate(dateStr: string): FiscalPeriod {
  const ms = toUtcMs(dateStr);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  return fromSaturday(ms + (6 - dow) * DAY_MS);
}

/** All periods of a fiscal year, in order (length 52 or 53). */
export function periodsInYear(fiscalYear: number): FiscalPeriod[] {
  const jan1 = Date.UTC(fiscalYear, 0, 1);
  const firstSat = jan1 + ((6 - new Date(jan1).getUTCDay() + 7) % 7) * DAY_MS;
  const periods: FiscalPeriod[] = [];
  for (
    let satMs = firstSat;
    new Date(satMs).getUTCFullYear() === fiscalYear;
    satMs += 7 * DAY_MS
  ) {
    periods.push(fromSaturday(satMs));
  }
  return periods;
}

/** The period delta places forward/back, crossing fiscal-year boundaries. */
export function shiftPeriod(p: FiscalPeriod, delta: -1 | 1): FiscalPeriod {
  const list = periodsInYear(p.fiscalYear);
  const idx = p.period - 1 + delta;
  if (idx < 0) {
    const prev = periodsInYear(p.fiscalYear - 1);
    return prev[prev.length - 1]!;
  }
  if (idx >= list.length) return periodsInYear(p.fiscalYear + 1)[0]!;
  return list[idx]!;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jun 21" (UTC-safe — no locale/timezone drift). */
export function shortDate(dateStr: string): string {
  const d = new Date(toUtcMs(dateStr));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Jun 21 – Jun 27, 2026" */
export function periodRangeLabel(p: FiscalPeriod): string {
  return `${shortDate(p.start)} – ${shortDate(p.end)}, ${p.fiscalYear}`;
}

/** "FY2026 · P33" */
export function periodShortLabel(p: FiscalPeriod): string {
  return `FY${p.fiscalYear} · P${p.period}`;
}
