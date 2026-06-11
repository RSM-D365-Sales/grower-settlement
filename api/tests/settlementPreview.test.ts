import { describe, expect, it } from "vitest";
import { generateDemoData } from "../src/demo/seed";
import products from "../src/d365/fixtures/products.json";
import { buildSettlementPreview, PreviewBasis } from "../src/settlement/previewCalc";

const TODAY = new Date("2026-06-11T12:00:00Z");
const data = generateDemoData(TODAY);
const commodityByItem = new Map(products.map((p) => [p.itemNumber, p.commodityCode]));

const FROM = "2026-05-13"; // full 30-day seed window
const TO = "2026-06-11";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function run(vendorAccount: string, basis: PreviewBasis, fromDate = FROM, toDate = TO) {
  return buildSettlementPreview({
    contracts: data.contracts,
    receipts: data.receipts,
    salesOrders: data.salesOrders,
    commodityByItem,
    vendorAccount,
    fromDate,
    toDate,
    basis,
  });
}

describe("settlement preview — flat-rate (receipt basis)", () => {
  const contract = data.contracts.find(
    (c) => c.vendorAccount === "V-1001" && c.settlementType === "TradeAgreement"
  )!;
  const preview = run("V-1001", "receipt")!;
  const section = preview.sections.find((s) => s.contractNumber === contract.contractNumber)!;

  it("returns only receipt-based sections and resolves the vendor name", () => {
    expect(preview.vendorName).toBe(contract.vendorName);
    expect(preview.sections.every((s) => s.basis === "Receipts")).toBe(true);
    expect(section).toBeDefined();
  });

  it("payable equals Σ posted-receipt quantity × contract rate", () => {
    const rateByItem = new Map(contract.lines.map((l) => [l.itemNumber!, l.ratePerUnit!]));
    const posted = data.receipts.filter(
      (r) =>
        r.contractNumber === contract.contractNumber &&
        r.receiptDate >= FROM &&
        r.receiptDate <= TO &&
        r.status === "Posted"
    );
    const expected = round2(
      posted.reduce(
        (sum, r) =>
          sum +
          r.lines.reduce((s, l) => s + round2(l.quantity * rateByItem.get(l.itemNumber)!), 0),
        0
      )
    );
    expect(section.eligibleCount).toBe(posted.length);
    expect(section.estimatedPayable).toBeCloseTo(expected, 2);
    expect(section.grossAmount).toBeCloseTo(expected, 2); // no commission on flat rate
    expect(section.commissionAmount).toBe(0);
  });

  it("lists open (unposted) receipts as excluded with zero payable", () => {
    const excluded = section.transactions.filter((t) => !t.eligible);
    expect(excluded.length).toBe(section.excludedCount);
    for (const t of excluded) {
      expect(t.status).toBe("Open");
      expect(t.estimatedPayable).toBe(0);
    }
    expect(section.eligibleCount + section.excludedCount).toBe(section.transactions.length);
  });

  it("respects the date range", () => {
    const oneDay = run("V-1001", "receipt", TO, TO)!;
    for (const s of oneDay.sections) {
      expect(s.transactions.every((t) => t.date === TO)).toBe(true);
    }
  });
});

describe("settlement preview — commission (sales basis)", () => {
  const contract = data.contracts.find((c) => c.settlementType === "SalesCommission")!;
  const preview = run(contract.vendorAccount, "sales")!;
  const section = preview.sections.find((s) => s.contractNumber === contract.contractNumber)!;

  it("grower payable is revenue minus the company's commission (PLAN §7.2)", () => {
    expect(section.estimatedPayable).toBeCloseTo(
      section.grossAmount - section.commissionAmount,
      2
    );
    expect(section.commissionAmount).toBeGreaterThan(0);
    expect(section.estimatedPayable).toBeLessThan(section.grossAmount);
  });

  it("only attributes items covered by the contract scope", () => {
    for (const line of contract.lines) {
      expect(["Commodity", "AllItems"]).toContain(line.scope); // seed shape
    }
    const commodityScopes = contract.lines
      .filter((l) => l.scope === "Commodity")
      .map((l) => l.commodityCode);
    if (commodityScopes.length === contract.lines.length) {
      for (const item of section.items) {
        expect(commodityScopes).toContain(commodityByItem.get(item.itemNumber));
      }
    }
  });

  it("counts only invoiced orders toward totals", () => {
    for (const t of section.transactions) {
      if (t.eligible) {
        expect(t.status).toBe("Invoiced");
      } else {
        expect(["Open", "Confirmed"]).toContain(t.status);
        expect(t.estimatedPayable).toBe(0);
      }
    }
  });
});

describe("settlement preview — basis selection and totals", () => {
  it("returns null for a vendor with no contracts", () => {
    expect(run("V-9999", "both")).toBeNull();
  });

  it("'both' is the union of the two bases and totals add up", () => {
    const vendorWithBoth = data.contracts.find((c) => c.settlementType === "SalesCommission")!
      .vendorAccount; // every vendor also has a flat-rate contract
    const both = run(vendorWithBoth, "both")!;
    const receiptOnly = run(vendorWithBoth, "receipt")!;
    const salesOnly = run(vendorWithBoth, "sales")!;

    expect(both.sections.map((s) => s.contractNumber).sort()).toEqual(
      [...receiptOnly.sections, ...salesOnly.sections].map((s) => s.contractNumber).sort()
    );
    expect(both.totalEstimatedPayable).toBeCloseTo(
      both.sections.reduce((s, x) => s + x.estimatedPayable, 0),
      2
    );
    expect(both.notes.length).toBeGreaterThanOrEqual(2); // preview-only + linkage caveat
  });

  it("basis filters exclude the other contract type", () => {
    const vendor = data.contracts.find((c) => c.settlementType === "SalesCommission")!
      .vendorAccount;
    expect(run(vendor, "receipt")!.sections.every((s) => s.basis === "Receipts")).toBe(true);
    expect(run(vendor, "sales")!.sections.every((s) => s.basis === "SalesInvoices")).toBe(true);
  });
});
