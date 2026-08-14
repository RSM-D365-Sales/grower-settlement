import { describe, expect, it } from "vitest";
import { periodForDate, periodsInYear, periodRangeLabel } from "./fiscalWeek";

describe("fiscal week (Sunday–Saturday, FY of the week-ending Saturday)", () => {
  it("puts Jan 1 in period 1 even when the week starts in the prior year", () => {
    // Jan 1 2026 is a Thursday → its week is Sun Dec 28 2025 – Sat Jan 3 2026.
    expect(periodForDate("2026-01-01")).toEqual({
      fiscalYear: 2026,
      period: 1,
      start: "2025-12-28",
      end: "2026-01-03",
    });
    // The Sunday of that same week already belongs to FY2026.
    expect(periodForDate("2025-12-28").fiscalYear).toBe(2026);
  });

  it("keeps the last full week of December in the old fiscal year", () => {
    // Sat Dec 27 2025 ends the week Dec 21–27 → FY2025, period 52.
    expect(periodForDate("2025-12-27")).toEqual({
      fiscalYear: 2025,
      period: 52,
      start: "2025-12-21",
      end: "2025-12-27",
    });
  });

  it("computes the current demo period correctly", () => {
    // Aug 13 2026 (Thu) → week Sun Aug 9 – Sat Aug 15 → period 33.
    expect(periodForDate("2026-08-13")).toEqual({
      fiscalYear: 2026,
      period: 33,
      start: "2026-08-09",
      end: "2026-08-15",
    });
  });

  it("enumerates 52 periods for 2026 and 53 for 2028", () => {
    const p2026 = periodsInYear(2026);
    expect(p2026).toHaveLength(52);
    expect(p2026[0]!.end).toBe("2026-01-03");
    expect(p2026.at(-1)!.end).toBe("2026-12-26");
    // 2028 starts on a Saturday → 53 Saturdays in the year.
    expect(periodsInYear(2028)).toHaveLength(53);
  });

  it("round-trips: every enumerated period contains its own start and end", () => {
    for (const p of periodsInYear(2026)) {
      expect(periodForDate(p.start)).toEqual(p);
      expect(periodForDate(p.end)).toEqual(p);
    }
  });

  it("assigns every day of the year to exactly one period", () => {
    const periods = periodsInYear(2026);
    // Dec 27–31 2026 fall past the last Saturday of FY2026 → FY2027 period 1.
    expect(periodForDate("2026-12-27").fiscalYear).toBe(2027);
    expect(periodForDate("2026-12-27").period).toBe(1);
    // Days inside the year map into the enumerated list.
    const found = periodForDate("2026-06-15");
    expect(periods[found.period - 1]).toEqual(found);
  });

  it("formats labels", () => {
    expect(periodRangeLabel(periodForDate("2026-08-13"))).toBe("Aug 9 – Aug 15, 2026");
  });
});
