/**
 * Pure weekly-period report calculation (demo — Docs/DECISIONS.md 0.17).
 * Aggregates one fiscal week (any date range) across ALL growers:
 *
 * - Receiving activity: quantity received per day and per item (Open and
 *   Posted receipts both count as "received"; only Posted settle).
 * - Sales activity: quantity sold and revenue collected per item — only
 *   Invoiced sales orders count, mirroring settlement eligibility.
 * - Settlement register: one row per grower with settleable activity in the
 *   range, computed with the same engine as the settlement preview
 *   (buildSettlementPreview), so the dashboard, the preview pane and the
 *   grower statement always agree.
 *
 * Sell-through inherits the 0.15 demo simplification: sales are matched to
 * receipts by item within the same period, not by lot (Phase 5 trace ledger).
 *
 * KEEP IN SYNC: web/src/api/periodReportCalc.ts ↔
 * api/src/reports/periodReportCalc.ts (the web copy powers VITE_DATA_MODE=static;
 * the API is the real implementation).
 */

import {
  buildSettlementPreview,
  type CalcContract,
  type CalcReceipt,
  type CalcSalesOrder,
} from "./settlementPreviewCalc";

export interface PeriodDayActivity {
  date: string; // yyyy-mm-dd
  receivedQty: number;
  soldQty: number;
}

export interface PeriodItemActivity {
  itemNumber: string;
  itemName: string;
  uom: string;
  commodityCode: string | null;
  receivedQty: number;
  soldQty: number;
  soldRevenue: number;
  /** soldQty / receivedQty × 100, null when nothing was received. */
  sellThroughPct: number | null;
}

export type PeriodSettlementStatus = "Posted" | "In progress" | "Scheduled";

export interface PeriodSettlementRow {
  /** Deterministic weekly run id: SET-<week-ending yyyymmdd>-<vendor>. */
  settlementNumber: string;
  vendorAccount: string;
  vendorName: string;
  settlementTypes: ("TradeAgreement" | "SalesCommission")[];
  contractCount: number;
  eligibleDocuments: number;
  grossAmount: number;
  commissionAmount: number;
  netPayable: number;
  status: PeriodSettlementStatus;
}

export interface PeriodSettlements {
  count: number;
  grossAmount: number;
  commissionAmount: number;
  netPayable: number;
  status: PeriodSettlementStatus;
  rows: PeriodSettlementRow[];
}

export interface PeriodReport {
  fromDate: string;
  toDate: string;
  /** Newest activity date in the dataset — the demo's "as of" anchor. */
  asOfDate: string;
  /** Oldest activity date in the dataset (bounds the period picker). */
  dataStartDate: string;
  receiptCount: number;
  receivedQty: number;
  invoicedOrderCount: number;
  soldQty: number;
  collectedAmount: number;
  byDay: PeriodDayActivity[];
  byItem: PeriodItemActivity[];
  /** Null when the caller lacks the Accountant/Admin settlement gate. */
  settlements: PeriodSettlements | null;
  notes: string[];
}

export interface PeriodReportInput {
  contracts: CalcContract[];
  receipts: CalcReceipt[];
  salesOrders: CalcSalesOrder[];
  /** itemNumber → commodityCode (null when unassigned). */
  commodityByItem: Map<string, string | null>;
  fromDate: string;
  toDate: string;
  /** Server-shaped by role: settlement figures are Accountant/Admin only. */
  includeSettlements: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function eachDay(fromDate: string, toDate: string): string[] {
  const days: string[] = [];
  const [y = 0, m = 1, d = 1] = fromDate.split("-").map(Number);
  for (let ms = Date.UTC(y, m - 1, d); ; ms += 86_400_000) {
    const day = new Date(ms).toISOString().slice(0, 10);
    if (day > toDate) break;
    days.push(day);
  }
  return days;
}

export function buildPeriodReport(input: PeriodReportInput): PeriodReport {
  const { fromDate, toDate, commodityByItem } = input;
  const inRange = (date: string): boolean => date >= fromDate && date <= toDate;

  const allDates = [
    ...input.receipts.map((r) => r.receiptDate),
    ...input.salesOrders.map((s) => s.orderDate),
  ];
  const asOfDate = allDates.reduce((a, b) => (a > b ? a : b), "");
  const dataStartDate = allDates.reduce((a, b) => (a !== "" && a < b ? a : b), "");

  const dayAgg = new Map<string, PeriodDayActivity>(
    eachDay(fromDate, toDate).map((date) => [date, { date, receivedQty: 0, soldQty: 0 }])
  );
  const itemAgg = new Map<string, PeriodItemActivity>();
  const itemLine = (itemNumber: string, itemName: string, uom: string): PeriodItemActivity => {
    let line = itemAgg.get(itemNumber);
    if (!line) {
      line = {
        itemNumber,
        itemName,
        uom,
        commodityCode: commodityByItem.get(itemNumber) ?? null,
        receivedQty: 0,
        soldQty: 0,
        soldRevenue: 0,
        sellThroughPct: null,
      };
      itemAgg.set(itemNumber, line);
    }
    return line;
  };

  // Receiving — every receipt in range counts as product received.
  let receiptCount = 0;
  let receivedQty = 0;
  for (const receipt of input.receipts) {
    if (!inRange(receipt.receiptDate)) continue;
    receiptCount++;
    const day = dayAgg.get(receipt.receiptDate);
    for (const line of receipt.lines) {
      receivedQty += line.quantity;
      if (day) day.receivedQty += line.quantity;
      itemLine(line.itemNumber, line.itemName, line.uom).receivedQty += line.quantity;
    }
  }

  // Sales — only Invoiced orders count as sold/collected (settlement parity).
  let invoicedOrderCount = 0;
  let soldQty = 0;
  let collectedAmount = 0;
  for (const order of input.salesOrders) {
    if (!inRange(order.orderDate) || order.status !== "Invoiced") continue;
    invoicedOrderCount++;
    const day = dayAgg.get(order.orderDate);
    for (const line of order.lines) {
      soldQty += line.quantity;
      collectedAmount = round2(collectedAmount + line.lineAmount);
      if (day) day.soldQty += line.quantity;
      const item = itemLine(line.itemNumber, line.itemName, line.uom);
      item.soldQty += line.quantity;
      item.soldRevenue = round2(item.soldRevenue + line.lineAmount);
    }
  }

  for (const item of itemAgg.values()) {
    item.sellThroughPct =
      item.receivedQty > 0 ? round2((item.soldQty / item.receivedQty) * 100) : null;
  }
  const byItem = [...itemAgg.values()].sort(
    (a, b) => b.receivedQty - a.receivedQty || b.soldQty - a.soldQty
  );

  // Settlement register — the weekly run, one row per grower with settleable
  // activity, computed by the same engine as the settlement preview.
  let settlements: PeriodSettlements | null = null;
  if (input.includeSettlements) {
    const status: PeriodSettlementStatus =
      toDate < asOfDate ? "Posted" : fromDate <= asOfDate ? "In progress" : "Scheduled";
    const weekEnding = toDate.replace(/-/g, "");
    const vendors = new Map(input.contracts.map((c) => [c.vendorAccount, c.vendorName]));
    const rows: PeriodSettlementRow[] = [];
    for (const [vendorAccount, vendorName] of vendors) {
      const preview = buildSettlementPreview({
        contracts: input.contracts,
        receipts: input.receipts,
        salesOrders: input.salesOrders,
        commodityByItem,
        vendorAccount,
        fromDate,
        toDate,
        basis: "both",
      });
      if (!preview) continue;
      const active = preview.sections.filter((s) => s.eligibleCount > 0);
      if (active.length === 0) continue;
      rows.push({
        settlementNumber: `SET-${weekEnding}-${vendorAccount}`,
        vendorAccount,
        vendorName,
        settlementTypes: [...new Set(active.map((s) => s.settlementType))],
        contractCount: active.length,
        eligibleDocuments: active.reduce((s, x) => s + x.eligibleCount, 0),
        grossAmount: round2(active.reduce((s, x) => s + x.grossAmount, 0)),
        commissionAmount: round2(active.reduce((s, x) => s + x.commissionAmount, 0)),
        netPayable: round2(active.reduce((s, x) => s + x.estimatedPayable, 0)),
        status,
      });
    }
    rows.sort((a, b) => b.netPayable - a.netPayable);
    settlements = {
      count: rows.length,
      grossAmount: round2(rows.reduce((s, r) => s + r.grossAmount, 0)),
      commissionAmount: round2(rows.reduce((s, r) => s + r.commissionAmount, 0)),
      netPayable: round2(rows.reduce((s, r) => s + r.netPayable, 0)),
      status,
      rows,
    };
  }

  return {
    fromDate,
    toDate,
    asOfDate,
    dataStartDate,
    receiptCount,
    receivedQty,
    invoicedOrderCount,
    soldQty,
    collectedAmount,
    byDay: [...dayAgg.values()],
    byItem,
    settlements,
    notes: [
      "Demo data — every figure is synthetic. Collected = revenue on sales orders invoiced during the period; cash application arrives with the D365 payment integration (Phase 7).",
      "Sold quantities are matched to receipts by item within the period, not by lot — per-lot receipt→sale linkage arrives with the Phase 5 trace ledger.",
    ],
  };
}
