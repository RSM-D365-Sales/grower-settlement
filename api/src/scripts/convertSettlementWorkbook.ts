/**
 * Converts the D365 grower-accounting settlement workbook (Settlement-data.xlsx
 * at the repo root — a raw table export: Settlement Table / Receipts / Sales /
 * Adjustments / Advances sheets) into the settlement register JSON served by
 * GET /settlements and the static demo client.
 *
 * Run:  npm run export:settlements   (from api/)
 * Writes api/src/demo/settlements.json (imported by the Functions API and
 * re-exported to web/public/demo by exportDemoData) and the web copy directly.
 *
 * The workbook is the source of truth — never hand-edit the JSON outputs.
 * Retargeting the demo = replace the workbook (and adjust the name/label maps
 * below), then re-run. Prints a reconciliation summary and hard-fails if
 * ST000075 stops tying out to the D365 form (gross 9,892.50 / deductions 16.00
 * / advances 1,725.00 / commissions 989.25 / net 7,162.25).
 */
import { readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { inflateRawSync } from "zlib";

// ---------------------------------------------------------------------------
// Output shape — keep web/src/api/settlementData.ts in sync (same convention
// as previewCalc/periodReportCalc web↔api mirrors).
// ---------------------------------------------------------------------------

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
  /** Full invoice-line revenue attributed to the settlement (SETTLEMENTGROSSAMOUNT). */
  grossAmount: number;
  commissionAmount: number;
  /** D365's per-line net after its own allocations (SETTLEMENTAMOUNT). */
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
  /** "workbook" rows come from the D365 export; "demo" rows are the example premiums seeded below. */
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

// ---------------------------------------------------------------------------
// Demo enrichment — the retarget points when the workbook changes.
// ---------------------------------------------------------------------------

/** Grower names beyond what the workbook's GROWERNAME column carries.
 *  EU-1001/104/R1003 come from the workbook itself; fill the rest in to match
 *  the D365 environment's vendor names (unknown growers render as their ID). */
const GROWER_NAMES: Record<string, string> = {
  "EU-1001": "Albert Heijn",
  "104": "Best Supplier - Europe",
  R1003: "Oregon Farms",
  R1001: "Farley Farms",
  R1002: "Davis Growers",
};

/** The workbook's adjustment codes all carry charge code FEE — these labels
 *  give each code the deduction category shown in the dashboard. */
const ADJUSTMENT_LABELS: Record<string, { label: string; kind: "premium" | "deduction" }> = {
  ADJ000000004: { label: "Packaging costs", kind: "deduction" },
  ADJ000000006: { label: "Quality deduction", kind: "deduction" },
  ADJ000000007: { label: "Repacking", kind: "deduction" },
};

/** Example premiums so the premium section demos with data. Applied ONLY to
 *  settlements still Open in D365 (ST000074/76/78) — every Settled settlement
 *  keeps exactly the workbook figures so it ties out to the D365 form. */
const EXAMPLE_PREMIUMS: Array<{
  settlementId: string;
  growerId: string;
  receiptId: string;
  code: string;
  label: string;
  amount: number;
}> = [
  { settlementId: "ST000074", growerId: "104", receiptId: "REC000080", code: "PREM-QUALITY", label: "Quality premium – Grade A", amount: 100 },
  { settlementId: "ST000074", growerId: "R1002", receiptId: "REC000084", code: "PREM-QUALITY", label: "Quality premium – Grade A", amount: 100 },
  { settlementId: "ST000074", growerId: "R1003", receiptId: "REC000088", code: "PREM-QUALITY", label: "Quality premium – Grade A", amount: 76 },
  { settlementId: "ST000076", growerId: "R1003", receiptId: "REC000095", code: "PREM-ORGANIC", label: "Organic certification premium", amount: 800 },
  { settlementId: "ST000076", growerId: "R1003", receiptId: "REC000094", code: "PREM-QUALITY", label: "Quality premium – Grade A", amount: 150.75 },
  { settlementId: "ST000078", growerId: "104", receiptId: "REC000117", code: "PREM-EARLY", label: "Early delivery premium", amount: 500 },
  { settlementId: "ST000078", growerId: "R1002", receiptId: "REC000110", code: "PREM-EARLY", label: "Early delivery premium", amount: 400 },
  { settlementId: "ST000078", growerId: "R1004", receiptId: "REC000113", code: "PREM-EARLY", label: "Early delivery premium", amount: 600 },
];

/** Settlements beyond the workbook export, transcribed from the D365 form
 *  (screenshot-verified the same way as the ST000075 tie-out below). ST000080
 *  "Premium 1" post-dates the last workbook pull; its receipt lines (REC000121/
 *  REC000122 against CON000035, 8/20/2026) match the form, and the sales/
 *  adjustment lines are constructed so the totals tie out to the header:
 *  gross 3,770.00 / premiums 110.00 / deductions 22.00 / commissions 650.00 /
 *  net 3,208.00. Drop entries here once a fresh workbook export includes them. */
const EXTRA_SETTLEMENTS: SettlementDoc[] = [
  {
    settlementId: "ST000080",
    description: "Premium 1",
    poolId: null,
    growerId: "EU-1001",
    growerName: "Albert Heijn",
    status: "Open",
    basis: "Sales invoice based",
    pooled: false,
    fromDate: null,
    toDate: null,
    currency: "USD",
    totals: { gross: 3770, premiums: 110, deductions: 22, advances: 0, commissions: 650, net: 3208 },
    lines: [
      {
        growerId: "EU-1001",
        growerName: "Albert Heijn",
        gross: 3770,
        premiums: 110,
        deductions: 22,
        advances: 0,
        commissions: 650,
        net: 3208,
      },
    ],
    receipts: [
      {
        receiptId: "REC000121",
        contractId: "CON000035",
        receiptDate: "2026-08-20",
        growerId: "EU-1001",
        itemNumber: "F620",
        itemName: "Strawberries, Bulk",
        receiptQuantity: 1000,
        receiptUnit: "lb",
        settlementQuantity: 1000,
        settlementUnit: "lb",
        originalPrice: 1,
        averagePrice: 1,
        settlementPrice: 1,
        amount: 1000,
      },
      {
        receiptId: "REC000122",
        contractId: "CON000035",
        receiptDate: "2026-08-20",
        growerId: "EU-1001",
        itemNumber: "F620",
        itemName: "Strawberries, Bulk",
        receiptQuantity: 1200,
        receiptUnit: "lb",
        settlementQuantity: 1200,
        settlementUnit: "lb",
        originalPrice: 1,
        averagePrice: 1,
        settlementPrice: 1,
        amount: 1200,
      },
    ],
    sales: [
      {
        salesOrderId: "1970",
        salesInvoiceId: "CIV-00000803",
        invoiceDate: "2026-08-20",
        growerId: "EU-1001",
        customerAccount: "US-001",
        customerName: "Contoso Retail San Diego",
        itemNumber: "F620",
        itemName: "Strawberries, Bulk",
        invoiceQuantity: 1000,
        invoiceUnit: "lb",
        invoicePrice: 2.3,
        currency: "USD",
        settlementQuantity: 1000,
        settlementUnit: "lb",
        grossAmount: 2300,
        commissionAmount: 400,
        settlementAmount: 1878,
      },
      {
        salesOrderId: "1971",
        salesInvoiceId: "CIV-00000804",
        invoiceDate: "2026-08-20",
        growerId: "EU-1001",
        customerAccount: "US-002",
        customerName: "Contoso Retail Los Angeles",
        itemNumber: "F620",
        itemName: "Strawberries, Bulk",
        invoiceQuantity: 700,
        invoiceUnit: "lb",
        invoicePrice: 2.1,
        currency: "USD",
        settlementQuantity: 700,
        settlementUnit: "lb",
        grossAmount: 1470,
        commissionAmount: 250,
        settlementAmount: 1220,
      },
    ],
    adjustments: [
      {
        code: "ADJ000000007",
        chargeCode: "FEE",
        label: "Repacking",
        kind: "deduction",
        growerId: "EU-1001",
        receiptId: "REC000122",
        amount: 22,
        source: "demo",
      },
      {
        code: "PREM-QUALITY",
        chargeCode: "PREMIUM",
        label: "Quality premium – Grade A",
        kind: "premium",
        growerId: "EU-1001",
        receiptId: "REC000121",
        amount: 60,
        source: "demo",
      },
      {
        code: "PREM-EARLY",
        chargeCode: "PREMIUM",
        label: "Early delivery premium",
        kind: "premium",
        growerId: "EU-1001",
        receiptId: "REC000122",
        amount: 50,
        source: "demo",
      },
    ],
    advances: [],
  },
];

/** Enum mappings observed against the D365 form (ST000075 shows Settled /
 *  Sales invoice based) — recorded in Docs/DECISIONS.md 0.18. */
const STATUS_LABELS: Array<SettlementDoc["status"]> = ["Open", "In process", "Settled"];
const PAYBACK_METHODS: Record<string, string> = { "1": "Full amount", "3": "Per unit" };

// ---------------------------------------------------------------------------
// Minimal xlsx reader (zip of XML — no dependency needed for a table export).
// ---------------------------------------------------------------------------

function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a zip/xlsx file (no end-of-central-directory record)");
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(ptr) !== 0x02014b50) throw new Error("Corrupt central directory");
    const method = buf.readUInt16LE(ptr + 10);
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOff = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);
    const dataStart =
      localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    const data = buf.subarray(dataStart, dataStart + compSize);
    files.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function decodeXml(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#x?[0-9a-fA-F]+);/g, (_, e: string) => {
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    return String.fromCodePoint(parseInt(e.slice(e[1] === "x" ? 2 : 1), e[1] === "x" ? 16 : 10));
  });
}

function textRuns(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decodeXml(m[1] ?? "");
  return out;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    if (ch >= "0" && ch <= "9") break;
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** Rows of a sheet as objects keyed by the header row's column names. */
type Row = Record<string, string>;

function parseSheet(xml: string, shared: string[]): Row[] {
  const grid: string[][] = [];
  for (const rowM of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cM of rowM[1]!.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cM[1] ?? "";
      const inner = cM[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      let val = "";
      if (type === "s" && v !== undefined) val = shared[Number(v)] ?? "";
      else if (type === "inlineStr") val = textRuns(inner);
      else if (v !== undefined) val = decodeXml(v);
      if (ref) cells[colIndex(ref)] = val;
    }
    grid.push(Array.from(cells, (c) => c ?? ""));
  }
  const headers = grid[0] ?? [];
  return grid.slice(1).map((cells) => {
    const row: Row = {};
    headers.forEach((h, i) => {
      if (h) row[h] = cells[i] ?? "";
    });
    return row;
  });
}

function readWorkbook(path: string): Map<string, Row[]> {
  const files = unzip(readFileSync(path));
  const shared: string[] = [];
  const ssXml = files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "";
  for (const m of ssXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)) shared.push(textRuns(m[1] ?? ""));
  const wbXml = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const names = [...wbXml.matchAll(/<sheet\s[^>]*name="([^"]*)"/g)].map((m) => decodeXml(m[1] ?? ""));
  const sheetPaths = [...files.keys()]
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
  const sheets = new Map<string, Row[]>();
  sheetPaths.forEach((p, i) => {
    const name = names[i] ?? p;
    sheets.set(name, parseSheet(files.get(p)!.toString("utf8"), shared));
  });
  return sheets;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

function num(row: Row, key: string): number {
  const n = Number(row[key] ?? "");
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Excel 1900-system date serial → yyyy-mm-dd. The export uses serial 1 as an
 *  empty date, so anything below a plausible modern serial maps to null. */
function serialDate(serial: number): string | null {
  if (serial < 40000) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000)
    .toISOString()
    .slice(0, 10);
}

function convert(workbookPath: string): SettlementRegister {
  const sheets = readWorkbook(workbookPath);
  const need = (name: string): Row[] => {
    const rows = sheets.get(name);
    if (!rows) throw new Error(`Workbook is missing the "${name}" sheet`);
    return rows;
  };
  const headerRows = need("Settlement Table");
  const receiptRows = need("Receipts");
  const salesRows = need("Sales");
  const adjustmentRows = need("Adjustments");
  const advanceRows = need("Advances");

  const settlements = headerRows
    .filter((h) => h.SETTLEMENTID)
    .map((h): SettlementDoc => {
      const id = h.SETTLEMENTID!;
      const growerId = h.GROWERID || null;

      const receipts = receiptRows
        .filter((r) => r.SETTLEMENTID === id)
        .map((r): SettlementReceiptLine => ({
          receiptId: r.RECEIPTID ?? "",
          contractId: r.CONTRACTID ?? "",
          receiptDate: serialDate(num(r, "RECEIPTDATE")),
          growerId: r.GROWERID || r.SETTLEMENTREFERENCEID || "",
          itemNumber: r.ITEMNUMBER ?? "",
          itemName: r.ITEMNAME ?? "",
          receiptQuantity: num(r, "RECEIPTQUANTITY"),
          receiptUnit: r.RECEIPTUNIT ?? "",
          settlementQuantity: num(r, "SETTLEMENTQUANTITY"),
          settlementUnit: r.SETTLEMENTUNIT ?? "",
          originalPrice: num(r, "ORIGINALPRICE"),
          averagePrice: num(r, "AVERAGEPRICE"),
          settlementPrice: num(r, "SETTLEMENTPRICE"),
          amount: round2(num(r, "SETTLEMENTQUANTITY") * num(r, "SETTLEMENTPRICE")),
        }))
        .sort((a, b) => a.receiptId.localeCompare(b.receiptId));

      // COMMISSIONPERCENT in the export holds the commission *amount*
      // (e.g. 225.00 against a 1,500.00 gross line — 15%), not a rate.
      const sales = salesRows
        .filter((s) => s.SETTLEMENTID === id)
        .map((s): SettlementSalesLine => ({
          salesOrderId: s.SALESORDERID ?? "",
          salesInvoiceId: s.SALESINVOICEID ?? "",
          invoiceDate: serialDate(num(s, "SALESINVOICEDATE")),
          growerId: s.GROWERID || s.SETTLEMENTREFERENCEID || "",
          customerAccount: s.CUSTOMER ?? "",
          customerName: s.CUSTOMERNAME ?? "",
          itemNumber: s.ITEMID ?? "",
          itemName: s.ITEMNAME ?? "",
          invoiceQuantity: num(s, "INVOICEQTY"),
          invoiceUnit: s.INVOICEUNIT ?? "",
          invoicePrice: num(s, "INVOICEPRICE"),
          currency: s.CURRENCY || "USD",
          settlementQuantity: num(s, "SETTLEMENTQTY"),
          settlementUnit: s.SETTLEMENTUNIT ?? "",
          grossAmount: round2(num(s, "SETTLEMENTGROSSAMOUNT")),
          commissionAmount: round2(num(s, "COMMISSIONPERCENT")),
          settlementAmount: round2(num(s, "SETTLEMENTAMOUNT")),
        }))
        .sort((a, b) => a.salesInvoiceId.localeCompare(b.salesInvoiceId));

      const adjustments: SettlementAdjustmentLine[] = adjustmentRows
        .filter((a) => a.SETTLEMENTID === id)
        .map((a) => {
          const code = a.ADJUSTMENTCODE ?? "";
          const mapped = ADJUSTMENT_LABELS[code];
          return {
            code,
            chargeCode: a.CHARGECODE ?? "",
            label: mapped?.label ?? a.CHARGECODE ?? code,
            kind: mapped?.kind ?? "deduction",
            growerId: a.GROWERID || a.SETTLEMENTREFERENCEID || "",
            receiptId: a.RECEIPTID ?? "",
            amount: round2(num(a, "ADJUSTMENTAMOUNT")),
            source: "workbook" as const,
          };
        });
      for (const p of EXAMPLE_PREMIUMS) {
        if (p.settlementId !== id) continue;
        adjustments.push({
          code: p.code,
          chargeCode: "PREMIUM",
          label: p.label,
          kind: "premium",
          growerId: p.growerId,
          receiptId: p.receiptId,
          amount: p.amount,
          source: "demo",
        });
      }
      adjustments.sort(
        (a, b) => a.kind.localeCompare(b.kind) || a.receiptId.localeCompare(b.receiptId)
      );

      const advances = advanceRows
        .filter((a) => a.SETTLEMENTID === id)
        .map((a): SettlementAdvanceLine => ({
          advanceId: a.ADVANCEID ?? "",
          advanceType: a.ADVANCETYPE ?? "",
          description: a.DESCRIPTION ?? "",
          paybackMethod: PAYBACK_METHODS[a.PAYBACKMETHOD ?? ""] ?? `Method ${a.PAYBACKMETHOD}`,
          growerId: a.GROWERID || a.SETTLEMENTREFERENCEID || "",
          receiptId: a.RECEIPTID ?? "",
          amountSettled: round2(num(a, "ADVANCESETTLEMENTAMOUNT")),
          outstandingAmount: round2(num(a, "OUTSTANDINGAMOUNT")),
          journalPaid: num(a, "ADVANCEJOURNALPAID") === 1,
        }))
        .sort((a, b) => a.advanceId.localeCompare(b.advanceId));

      const basis: SettlementDoc["basis"] =
        sales.length > 0 ? "Sales invoice based" : "Receipt based";

      const growerIds = [
        ...new Set(
          [
            ...(growerId ? [growerId] : []),
            ...receipts.map((r) => r.growerId),
            ...sales.map((s) => s.growerId),
            ...adjustments.map((a) => a.growerId),
            ...advances.map((a) => a.growerId),
          ].filter(Boolean)
        ),
      ].sort();

      const lines = growerIds.map((g): SettlementGrowerLine => {
        const gross =
          basis === "Sales invoice based"
            ? sales.filter((s) => s.growerId === g).reduce((t, s) => t + s.grossAmount, 0)
            : receipts.filter((r) => r.growerId === g).reduce((t, r) => t + r.amount, 0);
        const commissions = sales
          .filter((s) => s.growerId === g)
          .reduce((t, s) => t + s.commissionAmount, 0);
        const premiums = adjustments
          .filter((a) => a.growerId === g && a.kind === "premium")
          .reduce((t, a) => t + a.amount, 0);
        const deductions = adjustments
          .filter((a) => a.growerId === g && a.kind === "deduction")
          .reduce((t, a) => t + a.amount, 0);
        const advanced = advances
          .filter((a) => a.growerId === g && a.journalPaid)
          .reduce((t, a) => t + a.amountSettled, 0);
        return {
          growerId: g,
          growerName: (g === growerId && h.GROWERNAME) || GROWER_NAMES[g] || null,
          gross: round2(gross),
          premiums: round2(premiums),
          deductions: round2(deductions),
          advances: round2(advanced),
          commissions: round2(commissions),
          net: round2(gross + premiums - deductions - commissions - advanced),
        };
      });

      const totals = lines.reduce<SettlementTotals>(
        (t, l) => ({
          gross: round2(t.gross + l.gross),
          premiums: round2(t.premiums + l.premiums),
          deductions: round2(t.deductions + l.deductions),
          advances: round2(t.advances + l.advances),
          commissions: round2(t.commissions + l.commissions),
          net: round2(t.net + l.net),
        }),
        { gross: 0, premiums: 0, deductions: 0, advances: 0, commissions: 0, net: 0 }
      );

      const poolId = h.POOLID || null;
      return {
        settlementId: id,
        description: h.DESCRIPTION || id,
        poolId,
        growerId,
        growerName: growerId ? h.GROWERNAME || GROWER_NAMES[growerId] || null : null,
        status: STATUS_LABELS[num(h, "STATUS")] ?? "Open",
        basis,
        pooled: poolId !== null || (!growerId && growerIds.length > 1),
        fromDate: serialDate(num(h, "FROMDATE")),
        toDate: serialDate(num(h, "TODATE")),
        currency: sales[0]?.currency ?? "USD",
        totals,
        lines,
        receipts,
        sales,
        adjustments,
        advances,
      };
    });

  settlements.push(...EXTRA_SETTLEMENTS);
  settlements.sort((a, b) => a.settlementId.localeCompare(b.settlementId));

  return { generatedFrom: "Settlement-data.xlsx", settlements };
}

// ---------------------------------------------------------------------------
// Main: convert, reconcile, write
// ---------------------------------------------------------------------------

const repoRoot = resolve(join(__dirname, "../../../.."));
const workbookPath = resolve(process.argv[2] ?? join(repoRoot, "Settlement-data.xlsx"));
const register = convert(workbookPath);

// Tie-out against the D365 settlement form (screenshot-verified figures).
const anchor = register.settlements.find((s) => s.settlementId === "ST000075");
const expected: SettlementTotals = {
  gross: 9892.5,
  premiums: 0,
  deductions: 16,
  advances: 1725,
  commissions: 989.25,
  net: 7162.25,
};
if (!anchor) throw new Error("Reconciliation failed: ST000075 not found in workbook");
for (const key of Object.keys(expected) as Array<keyof SettlementTotals>) {
  if (anchor.totals[key] !== expected[key]) {
    throw new Error(
      `Reconciliation failed: ST000075 ${key} = ${anchor.totals[key]}, expected ${expected[key]}`
    );
  }
}

const money = (n: number): string =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(12);
console.log("Settlement       Status      Basis    Gross     Premiums   Deductions   Advances   Commission          Net");
for (const s of register.settlements) {
  const t = s.totals;
  console.log(
    `${s.settlementId}  ${s.status.padEnd(10)}  ${s.basis === "Sales invoice based" ? "Sales  " : "Receipt"}` +
      `${money(t.gross)}${money(t.premiums)}${money(t.deductions)}${money(t.advances)}${money(t.commissions)}${money(t.net)}`
  );
}
const g = register.settlements.reduce(
  (t, s) => ({
    n: t.n + 1,
    receipts: t.receipts + s.receipts.length,
    sales: t.sales + s.sales.length,
    adjustments: t.adjustments + s.adjustments.length,
    advances: t.advances + s.advances.length,
  }),
  { n: 0, receipts: 0, sales: 0, adjustments: 0, advances: 0 }
);
console.log(
  `\n${g.n} settlements · ${g.receipts} receipt lines · ${g.sales} sales invoice lines · ` +
    `${g.adjustments} adjustment lines · ${g.advances} advances — ST000075 ties out to the D365 form.`
);

const outputs = [
  join(repoRoot, "api/src/demo/settlements.json"),
  join(repoRoot, "web/public/demo/settlements.json"),
];
for (const out of outputs) {
  writeFileSync(out, JSON.stringify(register));
  console.log(`Wrote ${out}`);
}
