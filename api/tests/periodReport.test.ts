import { describe, expect, it } from "vitest";
import { generateDemoData } from "../src/demo/seed";
import { buildPeriodReport } from "../src/reports/periodReportCalc";
import { buildSettlementPreview } from "../src/settlement/previewCalc";
import products from "../src/d365/fixtures/products.json";

const TODAY = new Date("2026-06-11T12:00:00Z");
const demo = generateDemoData(TODAY);
const commodityByItem = new Map(products.map((p) => [p.itemNumber, p.commodityCode]));

// A complete Sunday–Saturday week fully in the past (fiscal period 23 of 2026).
const FROM = "2026-05-31";
const TO = "2026-06-06";

function report(includeSettlements: boolean) {
  return buildPeriodReport({
    contracts: demo.contracts,
    receipts: demo.receipts,
    salesOrders: demo.salesOrders,
    commodityByItem,
    fromDate: FROM,
    toDate: TO,
    includeSettlements,
  });
}

describe("period report — activity aggregates", () => {
  const r = report(true);

  it("covers every day of the range, in order", () => {
    expect(r.byDay.map((d) => d.date)).toEqual([
      "2026-05-31",
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
    ]);
  });

  it("ties out: totals equal the by-day and by-item sums", () => {
    const dayReceived = r.byDay.reduce((s, d) => s + d.receivedQty, 0);
    const itemReceived = r.byItem.reduce((s, i) => s + i.receivedQty, 0);
    expect(dayReceived).toBe(r.receivedQty);
    expect(itemReceived).toBe(r.receivedQty);

    const daySold = r.byDay.reduce((s, d) => s + d.soldQty, 0);
    const itemSold = r.byItem.reduce((s, i) => s + i.soldQty, 0);
    expect(daySold).toBe(r.soldQty);
    expect(itemSold).toBe(r.soldQty);

    const itemRevenue = r.byItem.reduce((s, i) => s + i.soldRevenue, 0);
    expect(itemRevenue).toBeCloseTo(r.collectedAmount, 1);
  });

  it("has real activity in the window and an as-of anchor at the data edge", () => {
    expect(r.receiptCount).toBeGreaterThan(0);
    expect(r.invoicedOrderCount).toBeGreaterThan(0);
    expect(r.asOfDate).toBe("2026-06-11");
    expect(r.dataStartDate).toBe("2026-01-01");
  });
});

describe("period report — settlement register", () => {
  it("is shaped out entirely for callers without the settlement gate", () => {
    expect(report(false).settlements).toBeNull();
  });

  it("marks a fully-past week Posted and nets gross − commission per row", () => {
    const s = report(true).settlements!;
    expect(s.status).toBe("Posted");
    expect(s.count).toBe(s.rows.length);
    expect(s.rows.length).toBeGreaterThan(0);
    for (const row of s.rows) {
      expect(row.status).toBe("Posted");
      expect(row.netPayable).toBeCloseTo(row.grossAmount - row.commissionAmount, 1);
      expect(row.settlementNumber).toBe(`SET-20260606-${row.vendorAccount}`);
      expect(row.eligibleDocuments).toBeGreaterThan(0);
    }
    expect(s.netPayable).toBeCloseTo(
      s.rows.reduce((sum, row) => sum + row.netPayable, 0),
      1
    );
  });

  it("marks the week containing the as-of date In progress", () => {
    const current = buildPeriodReport({
      contracts: demo.contracts,
      receipts: demo.receipts,
      salesOrders: demo.salesOrders,
      commodityByItem,
      fromDate: "2026-06-07",
      toDate: "2026-06-13",
      includeSettlements: true,
    });
    expect(current.settlements!.status).toBe("In progress");
  });

  it("agrees with the settlement preview engine per grower", () => {
    const s = report(true).settlements!;
    const row = s.rows[0]!;
    const preview = buildSettlementPreview({
      contracts: demo.contracts,
      receipts: demo.receipts,
      salesOrders: demo.salesOrders,
      commodityByItem,
      vendorAccount: row.vendorAccount,
      fromDate: FROM,
      toDate: TO,
      basis: "both",
    });
    expect(preview).not.toBeNull();
    expect(row.netPayable).toBeCloseTo(preview!.totalEstimatedPayable, 1);
  });
});
