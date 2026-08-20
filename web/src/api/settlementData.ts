/**
 * Settlement register types — mirror of the output of
 * api/src/scripts/convertSettlementWorkbook.ts (same web↔api keep-in-sync
 * convention as settlementPreviewCalc/periodReportCalc). The data is generated
 * from the D365 grower-accounting workbook export (Settlement-data.xlsx) and
 * served by GET /settlements and GET /settlements/:id.
 */

export interface SettlementTotals {
  gross: number;
  premiums: number;
  deductions: number;
  advances: number;
  commissions: number;
  net: number;
}

export interface SettlementGrowerLine extends SettlementTotals {
  growerId: string;
  growerName: string | null;
}

export interface SettlementReceiptLine {
  receiptId: string;
  contractId: string;
  receiptDate: string | null;
  growerId: string;
  itemNumber: string;
  itemName: string;
  receiptQuantity: number;
  receiptUnit: string;
  settlementQuantity: number;
  settlementUnit: string;
  originalPrice: number;
  averagePrice: number;
  settlementPrice: number;
  /** settlementQuantity × settlementPrice — the gross basis on receipt-based settlements. */
  amount: number;
}

export interface SettlementSalesLine {
  salesOrderId: string;
  salesInvoiceId: string;
  invoiceDate: string | null;
  growerId: string;
  customerAccount: string;
  customerName: string;
  itemNumber: string;
  itemName: string;
  invoiceQuantity: number;
  invoiceUnit: string;
  invoicePrice: number;
  currency: string;
  settlementQuantity: number;
  settlementUnit: string;
  /** Full invoice-line revenue attributed to the settlement. */
  grossAmount: number;
  commissionAmount: number;
  /** D365's per-line net after its own allocations. */
  settlementAmount: number;
}

export interface SettlementAdjustmentLine {
  code: string;
  chargeCode: string;
  label: string;
  kind: "premium" | "deduction";
  growerId: string;
  receiptId: string;
  amount: number;
  /** "workbook" rows come from the D365 export; "demo" rows are seeded example premiums. */
  source: "workbook" | "demo";
}

export interface SettlementAdvanceLine {
  advanceId: string;
  advanceType: string;
  description: string;
  paybackMethod: string;
  growerId: string;
  receiptId: string;
  amountSettled: number;
  outstandingAmount: number;
  /** Only journal-paid advances are recovered in the settlement totals. */
  journalPaid: boolean;
}

export interface SettlementDoc {
  settlementId: string;
  description: string;
  poolId: string | null;
  growerId: string | null;
  growerName: string | null;
  status: "Open" | "In process" | "Settled";
  basis: "Receipt based" | "Sales invoice based";
  pooled: boolean;
  fromDate: string | null;
  toDate: string | null;
  currency: string;
  totals: SettlementTotals;
  lines: SettlementGrowerLine[];
  receipts: SettlementReceiptLine[];
  sales: SettlementSalesLine[];
  adjustments: SettlementAdjustmentLine[];
  advances: SettlementAdvanceLine[];
}

export interface SettlementRegister {
  generatedFrom: string;
  settlements: SettlementDoc[];
}

/** Grower cell text: name where known, account otherwise, pool for pooled headers. */
export function growerLabel(s: SettlementDoc): string {
  if (s.growerId) return s.growerName ? `${s.growerName} (${s.growerId})` : s.growerId;
  if (s.poolId) return `Pool ${s.poolId}`;
  // Headerless single-grower settlements (early workbook rows): label by the line.
  const only = s.lines.length === 1 ? s.lines[0] : undefined;
  if (only) return only.growerName ? `${only.growerName} (${only.growerId})` : only.growerId;
  return `${s.lines.length} growers`;
}

export function formatMoney(n: number, currency: string): string {
  return n.toLocaleString("en-US", { style: "currency", currency });
}
