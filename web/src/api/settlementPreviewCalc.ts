/**
 * Pure settlement-preview calculation (demo — the real engine with batches,
 * deductions, pools and D365 posting arrives in Phase 6, Docs/PLAN.md §7).
 *
 * - Flat-rate (TradeAgreement, receipt-based): payable = Σ quantity × rate
 *   per matching contract line. Only Posted receipts count toward totals.
 * - Commission (SalesCommission, sales-invoice based), per PLAN §7.2:
 *   company keeps `revenue × commission%`, grower receives the remainder.
 *   Only Invoiced sales orders count. Until the Phase 5 trace ledger exists
 *   there is no production linkage, so revenue is attributed by contract-line
 *   scope (item/commodity match) — a deliberate demo simplification
 *   (Docs/DECISIONS.md 0.15). Net-revenue deductions are not modeled yet.
 *
 * KEEP IN SYNC: api/src/settlement/previewCalc.ts ↔
 * web/src/api/settlementPreviewCalc.ts (the web copy powers
 * VITE_DATA_MODE=static; the API is the real implementation).
 */

export type PreviewBasis = "receipt" | "sales" | "both";

// Input shapes — structural subsets of the demo seed / D365 types.

export interface CalcContractLine {
  lineNumber: number;
  scope: "Item" | "Commodity" | "AllItems";
  itemNumber?: string;
  commodityCode?: string;
  commodityName?: string;
  uom: string;
  ratePerUnit?: number;
  commissionPercent?: number;
}

export interface CalcContract {
  contractNumber: string;
  vendorAccount: string;
  vendorName: string;
  settlementType: "TradeAgreement" | "SalesCommission";
  status: string;
  lines: CalcContractLine[];
}

export interface CalcReceipt {
  receiptNumber: string;
  receiptDate: string; // yyyy-mm-dd
  contractNumber: string;
  status: string; // Open | Posted
  d365PoNumber: string;
  lines: { itemNumber: string; itemName: string; quantity: number; uom: string }[];
}

export interface CalcSalesOrder {
  salesOrderNumber: string;
  orderDate: string; // yyyy-mm-dd
  customerName: string;
  status: string; // Open | Confirmed | Invoiced
  lines: {
    itemNumber: string;
    itemName: string;
    quantity: number;
    uom: string;
    lineAmount: number;
  }[];
}

// Output shapes.

export interface PreviewItemLine {
  itemNumber: string;
  itemName: string;
  uom: string;
  quantity: number;
  ratePerUnit?: number; // receipt-based lines
  commissionPercent?: number; // sales-based lines
  grossAmount: number; // qty × rate (receipts) or revenue (sales)
  commissionAmount: number; // 0 for receipt-based
  estimatedPayable: number;
}

export interface PreviewTransaction {
  documentNumber: string;
  date: string;
  reference: string; // D365 PO (receipts) or customer (sales)
  status: string;
  /** Posted / Invoiced — only eligible documents count toward totals. */
  eligible: boolean;
  lineCount: number;
  quantity: number;
  grossAmount: number;
  estimatedPayable: number;
}

export interface PreviewSection {
  contractNumber: string;
  contractStatus: string;
  settlementType: "TradeAgreement" | "SalesCommission";
  basis: "Receipts" | "SalesInvoices";
  eligibleCount: number;
  excludedCount: number; // linked but not yet Posted/Invoiced
  grossAmount: number;
  commissionAmount: number;
  estimatedPayable: number;
  items: PreviewItemLine[];
  transactions: PreviewTransaction[];
}

export interface SettlementPreview {
  vendorAccount: string;
  vendorName: string;
  fromDate: string;
  toDate: string;
  basis: PreviewBasis;
  sections: PreviewSection[];
  totalEstimatedPayable: number;
  notes: string[];
}

export interface PreviewInput {
  contracts: CalcContract[];
  receipts: CalcReceipt[];
  salesOrders: CalcSalesOrder[];
  /** itemNumber → commodityCode (null when unassigned). */
  commodityByItem: Map<string, string | null>;
  vendorAccount: string;
  fromDate: string;
  toDate: string;
  basis: PreviewBasis;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function addItemLine(
  agg: Map<string, PreviewItemLine>,
  key: string,
  seed: Omit<PreviewItemLine, "quantity" | "grossAmount" | "commissionAmount" | "estimatedPayable">,
  quantity: number,
  grossAmount: number,
  commissionAmount: number
): void {
  const line = agg.get(key) ?? {
    ...seed,
    quantity: 0,
    grossAmount: 0,
    commissionAmount: 0,
    estimatedPayable: 0,
  };
  line.quantity += quantity;
  line.grossAmount = round2(line.grossAmount + grossAmount);
  line.commissionAmount = round2(line.commissionAmount + commissionAmount);
  line.estimatedPayable = round2(line.grossAmount - line.commissionAmount);
  agg.set(key, line);
}

function finishSection(
  contract: CalcContract,
  basis: PreviewSection["basis"],
  itemAgg: Map<string, PreviewItemLine>,
  transactions: PreviewTransaction[]
): PreviewSection {
  const eligible = transactions.filter((t) => t.eligible);
  const grossAmount = round2(eligible.reduce((s, t) => s + t.grossAmount, 0));
  const estimatedPayable = round2(eligible.reduce((s, t) => s + t.estimatedPayable, 0));
  return {
    contractNumber: contract.contractNumber,
    contractStatus: contract.status,
    settlementType: contract.settlementType,
    basis,
    eligibleCount: eligible.length,
    excludedCount: transactions.length - eligible.length,
    grossAmount,
    commissionAmount: round2(grossAmount - estimatedPayable),
    estimatedPayable,
    items: [...itemAgg.values()].sort((a, b) => a.itemNumber.localeCompare(b.itemNumber)),
    transactions,
  };
}

/** Find the contract line covering a sold item (Item > Commodity > AllItems order). */
function matchCommissionLine(
  contract: CalcContract,
  itemNumber: string,
  commodityByItem: Map<string, string | null>
): CalcContractLine | undefined {
  return (
    contract.lines.find((l) => l.scope === "Item" && l.itemNumber === itemNumber) ??
    contract.lines.find(
      (l) =>
        l.scope === "Commodity" &&
        l.commodityCode != null &&
        l.commodityCode === commodityByItem.get(itemNumber)
    ) ??
    contract.lines.find((l) => l.scope === "AllItems")
  );
}

/** Returns null when the vendor has no contracts at all (callers 404). */
export function buildSettlementPreview(input: PreviewInput): SettlementPreview | null {
  const { vendorAccount, fromDate, toDate, basis, commodityByItem } = input;
  const vendorContracts = input.contracts.filter((c) => c.vendorAccount === vendorAccount);
  if (vendorContracts.length === 0) return null;

  const inRange = (date: string): boolean => date >= fromDate && date <= toDate;
  const sections: PreviewSection[] = [];

  if (basis !== "sales") {
    for (const contract of vendorContracts.filter((c) => c.settlementType === "TradeAgreement")) {
      const lineByItem = new Map(
        contract.lines.filter((l) => l.itemNumber).map((l) => [l.itemNumber!, l])
      );
      const linked = input.receipts
        .filter((r) => r.contractNumber === contract.contractNumber && inRange(r.receiptDate))
        .sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));

      const itemAgg = new Map<string, PreviewItemLine>();
      const transactions: PreviewTransaction[] = [];
      for (const receipt of linked) {
        const eligible = receipt.status === "Posted";
        let quantity = 0;
        let gross = 0;
        for (const line of receipt.lines) {
          const rate = lineByItem.get(line.itemNumber)?.ratePerUnit ?? 0;
          const amount = round2(line.quantity * rate);
          quantity += line.quantity;
          gross = round2(gross + amount);
          if (eligible) {
            addItemLine(
              itemAgg,
              line.itemNumber,
              {
                itemNumber: line.itemNumber,
                itemName: line.itemName,
                uom: line.uom,
                ratePerUnit: rate,
              },
              line.quantity,
              amount,
              0
            );
          }
        }
        transactions.push({
          documentNumber: receipt.receiptNumber,
          date: receipt.receiptDate,
          reference: receipt.d365PoNumber,
          status: receipt.status,
          eligible,
          lineCount: receipt.lines.length,
          quantity,
          grossAmount: gross,
          estimatedPayable: eligible ? gross : 0,
        });
      }
      sections.push(finishSection(contract, "Receipts", itemAgg, transactions));
    }
  }

  if (basis !== "receipt") {
    for (const contract of vendorContracts.filter(
      (c) => c.settlementType === "SalesCommission"
    )) {
      const itemAgg = new Map<string, PreviewItemLine>();
      const transactions: PreviewTransaction[] = [];
      const ordersInRange = input.salesOrders
        .filter((so) => inRange(so.orderDate))
        .sort((a, b) => b.orderDate.localeCompare(a.orderDate));

      for (const order of ordersInRange) {
        const eligible = order.status === "Invoiced";
        let quantity = 0;
        let gross = 0;
        let commission = 0;
        let matchedLines = 0;
        for (const line of order.lines) {
          const contractLine = matchCommissionLine(contract, line.itemNumber, commodityByItem);
          if (!contractLine) continue;
          const pct = contractLine.commissionPercent ?? 0;
          const lineCommission = round2((line.lineAmount * pct) / 100);
          matchedLines++;
          quantity += line.quantity;
          gross = round2(gross + line.lineAmount);
          commission = round2(commission + lineCommission);
          if (eligible) {
            addItemLine(
              itemAgg,
              line.itemNumber,
              {
                itemNumber: line.itemNumber,
                itemName: line.itemName,
                uom: line.uom,
                commissionPercent: pct,
              },
              line.quantity,
              line.lineAmount,
              lineCommission
            );
          }
        }
        if (matchedLines === 0) continue; // order sells nothing this contract covers
        transactions.push({
          documentNumber: order.salesOrderNumber,
          date: order.orderDate,
          reference: order.customerName,
          status: order.status,
          eligible,
          lineCount: matchedLines,
          quantity,
          grossAmount: gross,
          estimatedPayable: eligible ? round2(gross - commission) : 0,
        });
      }
      sections.push(finishSection(contract, "SalesInvoices", itemAgg, transactions));
    }
  }

  const first = vendorContracts[0]!;
  const notes = [
    "Preview only — calculated in-app from demo data. Nothing is posted to or pulled from D365 (settlement engine arrives in Phase 6).",
  ];
  if (sections.some((s) => s.basis === "SalesInvoices")) {
    notes.push(
      "Commission revenue is attributed by contract scope (commodity/item match) — per-lot receipt→production→sales linkage arrives with the Phase 5 trace ledger, and net-revenue deductions (freight, packing, cooling) are not yet modeled."
    );
  }

  return {
    vendorAccount,
    vendorName: first.vendorName,
    fromDate,
    toDate,
    basis,
    sections,
    totalEstimatedPayable: round2(sections.reduce((s, x) => s + x.estimatedPayable, 0)),
    notes,
  };
}
