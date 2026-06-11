import { describe, expect, it } from "vitest";
import { generateDemoData } from "../src/demo/seed";
import vendors from "../src/d365/fixtures/vendors.json";
import products from "../src/d365/fixtures/products.json";

const TODAY = new Date("2026-06-11T12:00:00Z");
const data = generateDemoData(TODAY);

function countByDate(dates: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of dates) map.set(d, (map.get(d) ?? 0) + 1);
  return map;
}

describe("demo seed — vendors & contracts", () => {
  it("has 20 grower fixtures, all on the West Coast", () => {
    expect(vendors).toHaveLength(20);
    expect(vendors.every((v) => ["CA", "OR", "WA"].includes(v.state))).toBe(true);
  });

  it("creates 1–2 contracts for every vendor", () => {
    for (const vendor of vendors) {
      const own = data.contracts.filter((c) => c.vendorAccount === vendor.vendorAccount);
      expect(own.length, vendor.vendorAccount).toBeGreaterThanOrEqual(1);
      expect(own.length, vendor.vendorAccount).toBeLessThanOrEqual(2);
    }
  });

  it("every vendor has an enabled flat-rate contract with valid item lines", () => {
    const itemNumbers = new Set(products.map((p) => p.itemNumber));
    for (const vendor of vendors) {
      const flat = data.contracts.find(
        (c) =>
          c.vendorAccount === vendor.vendorAccount &&
          c.settlementType === "TradeAgreement" &&
          c.status === "Enabled"
      );
      expect(flat, vendor.vendorAccount).toBeDefined();
      for (const line of flat!.lines) {
        expect(line.scope).toBe("Item");
        expect(itemNumbers.has(line.itemNumber!)).toBe(true);
        expect(line.ratePerUnit).toBeGreaterThan(0);
        expect(line.commissionPercent).toBeUndefined();
      }
    }
  });

  it("commission contracts carry a commission % and commodity/all-items scope", () => {
    const commission = data.contracts.filter((c) => c.settlementType === "SalesCommission");
    expect(commission.length).toBeGreaterThan(0);
    for (const c of commission) {
      for (const line of c.lines) {
        expect(["Commodity", "AllItems"]).toContain(line.scope);
        expect(line.commissionPercent).toBeGreaterThanOrEqual(8);
        expect(line.commissionPercent).toBeLessThanOrEqual(15);
        expect(line.ratePerUnit).toBeUndefined();
      }
    }
  });
});

describe("demo seed — receipts", () => {
  it("creates ~15 receipts (13–17) per day for 30 days", () => {
    const perDay = countByDate(data.receipts.map((r) => r.receiptDate));
    expect(perDay.size).toBe(30);
    for (const [date, count] of perDay) {
      expect(count, date).toBeGreaterThanOrEqual(13);
      expect(count, date).toBeLessThanOrEqual(17);
    }
  });

  it("every receipt references an enabled contract of its own vendor and has lots + a PO", () => {
    const byNumber = new Map(data.contracts.map((c) => [c.contractNumber, c]));
    for (const r of data.receipts) {
      const contract = byNumber.get(r.contractNumber);
      expect(contract, r.receiptNumber).toBeDefined();
      expect(contract!.vendorAccount).toBe(r.vendorAccount);
      expect(contract!.status).toBe("Enabled");
      expect(r.d365PoNumber).toMatch(/^PO-\d+$/);
      expect(r.lines.length).toBeGreaterThanOrEqual(1);
      for (const line of r.lines) {
        expect(line.lotNumber).toMatch(/^LOT-\d{8}-\d+$/);
        expect(line.quantity).toBeGreaterThan(0);
      }
    }
  });

  it("only today's receipts can still be Open", () => {
    const open = data.receipts.filter((r) => r.status === "Open");
    expect(open.every((r) => r.receiptDate === "2026-06-11")).toBe(true);
  });
});

describe("demo seed — sales orders", () => {
  it("creates ~15 sales orders (13–17) per day for 30 days", () => {
    const perDay = countByDate(data.salesOrders.map((s) => s.orderDate));
    expect(perDay.size).toBe(30);
    for (const [date, count] of perDay) {
      expect(count, date).toBeGreaterThanOrEqual(13);
      expect(count, date).toBeLessThanOrEqual(17);
    }
  });

  it("line amounts are quantity × unit price, selling catalog items", () => {
    const itemNumbers = new Set(products.map((p) => p.itemNumber));
    for (const so of data.salesOrders) {
      for (const line of so.lines) {
        expect(itemNumbers.has(line.itemNumber)).toBe(true);
        expect(line.lineAmount).toBeCloseTo(line.quantity * line.unitPrice, 2);
      }
    }
  });

  it("is deterministic for a given date", () => {
    const again = generateDemoData(TODAY);
    expect(again.receipts[0]).toEqual(data.receipts[0]);
    expect(again.salesOrders.at(-1)).toEqual(data.salesOrders.at(-1));
    expect(again.contracts.length).toBe(data.contracts.length);
  });
});
