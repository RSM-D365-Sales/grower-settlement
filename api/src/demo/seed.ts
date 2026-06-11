/**
 * Deterministic in-memory demo seed (Phase 0/demo). The Azure SQL database is
 * not provisioned yet, so contracts/receipts live here for now; when Phase 2+
 * lands, this module becomes the Prisma seed script and these endpoints move
 * to real persistence. Sales orders are D365-domain — the mock D365 client
 * serves them from this same seed (Docs/DECISIONS.md 0.11).
 *
 * Volumes: 20 growers (fixtures), 1–2 contracts each, ~15 receipts/day and
 * ~15 sales orders/day for the trailing 30 days.
 */
import vendors from "../d365/fixtures/vendors.json";
import products from "../d365/fixtures/products.json";
import commodities from "../d365/fixtures/commodities.json";
import { D365SalesOrder } from "../d365/types";

// ── Shapes ──────────────────────────────────────────────────────────────────

export interface DemoContractLine {
  lineNumber: number;
  scope: "Item" | "Commodity" | "AllItems";
  itemNumber?: string;
  itemName?: string;
  commodityCode?: string;
  commodityName?: string;
  uom: string;
  ratePerUnit?: number; // TradeAgreement lines
  commissionPercent?: number; // SalesCommission lines
}

export interface DemoContract {
  contractNumber: string;
  vendorAccount: string;
  vendorName: string;
  seasonCode: string;
  validFrom: string;
  validTo: string;
  settlementType: "TradeAgreement" | "SalesCommission";
  status: "Enabled" | "Approved";
  lines: DemoContractLine[];
}

export interface DemoReceiptLine {
  lineNumber: number;
  itemNumber: string;
  itemName: string;
  quantity: number;
  uom: string;
  lotNumber: string;
}

export interface DemoReceipt {
  receiptNumber: string;
  receiptDate: string; // yyyy-mm-dd
  vendorAccount: string;
  vendorName: string;
  contractNumber: string;
  status: "Open" | "Posted";
  d365PoNumber: string;
  lines: DemoReceiptLine[];
}

export interface DemoData {
  generatedFor: string; // yyyy-mm-dd
  contracts: DemoContract[];
  receipts: DemoReceipt[];
  salesOrders: D365SalesOrder[];
}

// ── Static demo configuration ───────────────────────────────────────────────

/** What each grower actually grows (drives contract lines + receipts). */
const VENDOR_ITEMS: Record<string, string[]> = {
  "V-1001": ["STRAW-CONV", "STRAW-ORG"],
  "V-1002": ["TOM-ROMA", "LETT-ROM"],
  "V-1003": ["STRAW-ORG", "RASP-CONV"],
  "V-1004": ["BLUE-CONV", "APP-GALA"],
  "V-1005": ["GRAPE-RED", "ORNG-NAVL"],
  "V-1006": ["PEACH-YEL", "APP-GALA"],
  "V-1007": ["ORNG-NAVL", "MAND-CLEM"],
  "V-1008": ["BLUE-CONV", "RASP-CONV"],
  "V-1009": ["PEACH-YEL", "NECT-WHT", "PLUM-BLK"],
  "V-1010": ["TOM-ROMA", "TOM-CHERRY", "ONION-YEL"],
  "V-1011": ["POT-RUSS", "POT-RED"],
  "V-1012": ["ORNG-NAVL", "LEMON-EUR", "MAND-CLEM"],
  "V-1013": ["GRAPE-RED", "GRAPE-GRN"],
  "V-1014": ["CARR-JUMBO", "ONION-YEL", "TOM-ROMA"],
  "V-1015": ["STRAW-CONV", "RASP-CONV", "AVO-HASS"],
  "V-1016": ["PEACH-YEL", "PLUM-BLK"],
  "V-1017": ["LETT-ICE", "LETT-ROM"],
  "V-1018": ["GRAPE-GRN", "GRAPE-RED"],
  "V-1019": ["POT-YUK", "CARR-JUMBO", "ONION-YEL"],
  "V-1020": ["POT-RED", "BLUE-CONV"],
};

/** Grower cost basis $/unit (lb unless the item's unit is ea). */
const BASE_PRICE: Record<string, number> = {
  "STRAW-CONV": 1.1, "STRAW-ORG": 1.65, "BLUE-CONV": 2.25, "RASP-CONV": 2.6,
  "PEACH-YEL": 0.65, "NECT-WHT": 0.68, "PLUM-BLK": 0.62,
  "GRAPE-RED": 0.95, "GRAPE-GRN": 0.92,
  "ORNG-NAVL": 0.4, "LEMON-EUR": 0.55, "MAND-CLEM": 0.85,
  "TOM-ROMA": 0.52, "TOM-CHERRY": 1.3,
  "LETT-ICE": 0.9, "LETT-ROM": 1.05,
  "CARR-JUMBO": 0.35, "ONION-YEL": 0.28,
  "POT-RUSS": 0.22, "POT-RED": 0.3, "POT-YUK": 0.32,
  "APP-GALA": 0.58, "AVO-HASS": 1.45,
};

const CUSTOMERS = [
  { account: "C-2001", name: "Golden State Distributing" },
  { account: "C-2002", name: "Pacific Fresh Markets" },
  { account: "C-2003", name: "Bay Area Produce Exchange" },
  { account: "C-2004", name: "SoCal Grocers Alliance" },
  { account: "C-2005", name: "Cascade Food Wholesale" },
  { account: "C-2006", name: "Emerald City Markets" },
  { account: "C-2007", name: "Desert Sun Foods" },
  { account: "C-2008", name: "Rocky Mountain Provisions" },
];

const DAYS_OF_HISTORY = 30;

// ── Deterministic RNG ───────────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

function intBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Generation ──────────────────────────────────────────────────────────────

const productByItem = new Map(products.map((p) => [p.itemNumber, p]));

function itemName(itemNumber: string): string {
  return productByItem.get(itemNumber)?.name ?? itemNumber;
}

function itemUom(itemNumber: string): string {
  return productByItem.get(itemNumber)?.inventoryUnit ?? "lb";
}

export function generateDemoData(today: Date = new Date()): DemoData {
  const rng = mulberry32(20260611);
  const todayStr = fmtDate(today);

  // Contracts: every grower gets a flat-rate contract; about half also get a
  // commission contract scoped to their primary commodity.
  const contracts: DemoContract[] = [];
  let contractSeq = 1;
  for (const vendor of vendors) {
    const items = VENDOR_ITEMS[vendor.vendorAccount] ?? [];
    if (items.length === 0) continue;

    contracts.push({
      contractNumber: `CT-2026-${String(contractSeq++).padStart(4, "0")}`,
      vendorAccount: vendor.vendorAccount,
      vendorName: vendor.name,
      seasonCode: "SEASON-2026",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      settlementType: "TradeAgreement",
      status: "Enabled",
      lines: items.map((item, i) => ({
        lineNumber: i + 1,
        scope: "Item" as const,
        itemNumber: item,
        itemName: itemName(item),
        uom: itemUom(item),
        ratePerUnit: round2((BASE_PRICE[item] ?? 0.5) * (0.95 + rng() * 0.1)),
      })),
    });

    if (rng() < 0.5) {
      const primaryCommodity = productByItem.get(items[0]!)?.commodityCode ?? null;
      const commodityName = commodities.find((c) => c.code === primaryCommodity)?.name;
      contracts.push({
        contractNumber: `CT-2026-${String(contractSeq++).padStart(4, "0")}`,
        vendorAccount: vendor.vendorAccount,
        vendorName: vendor.name,
        seasonCode: "SEASON-2026",
        validFrom: "2026-01-01",
        validTo: "2026-12-31",
        settlementType: "SalesCommission",
        status: rng() < 0.7 ? "Enabled" : "Approved",
        lines: [
          {
            lineNumber: 1,
            scope: primaryCommodity ? "Commodity" : "AllItems",
            ...(primaryCommodity ? { commodityCode: primaryCommodity, commodityName } : {}),
            uom: itemUom(items[0]!),
            commissionPercent: Math.round((8 + rng() * 7) * 10) / 10,
          },
        ],
      });
    }
  }

  const enabledFlatRate = contracts.filter(
    (c) => c.status === "Enabled" && c.settlementType === "TradeAgreement"
  );

  // Receipts: ~15/day for the trailing 30 days against enabled contracts.
  const receipts: DemoReceipt[] = [];
  let receiptSeq = 100001;
  let poSeq = 260001;
  for (let offset = DAYS_OF_HISTORY - 1; offset >= 0; offset--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const dateStr = fmtDate(date);
    const lotDate = dateStr.replace(/-/g, "");
    const perDay = intBetween(rng, 13, 17);
    for (let i = 0; i < perDay; i++) {
      const contract = pick(rng, enabledFlatRate);
      const available = VENDOR_ITEMS[contract.vendorAccount] ?? [];
      const lineCount = Math.min(intBetween(rng, 1, 3), available.length);
      const itemsForReceipt = [...available].sort(() => rng() - 0.5).slice(0, lineCount);
      receipts.push({
        receiptNumber: `RCT-${receiptSeq++}`,
        receiptDate: dateStr,
        vendorAccount: contract.vendorAccount,
        vendorName: contract.vendorName,
        contractNumber: contract.contractNumber,
        // Today's receipts are mostly still open; history is posted.
        status: offset === 0 && rng() < 0.6 ? "Open" : "Posted",
        d365PoNumber: `PO-${poSeq++}`,
        lines: itemsForReceipt.map((item, li) => {
          const uom = itemUom(item);
          const quantity = uom === "ea" ? intBetween(rng, 200, 800) : intBetween(rng, 800, 2400);
          return {
            lineNumber: li + 1,
            itemNumber: item,
            itemName: itemName(item),
            quantity,
            uom,
            lotNumber: `LOT-${lotDate}-${String(i + 1).padStart(3, "0")}${String(li + 1)}`,
          };
        }),
      });
    }
  }

  // Sales orders: ~15/day selling the same item catalog (production linkage
  // arrives in Phase 5 — "later" per product owner).
  const allItems = products.map((p) => p.itemNumber);
  const salesOrders: D365SalesOrder[] = [];
  let soSeq = 300001;
  for (let offset = DAYS_OF_HISTORY - 1; offset >= 0; offset--) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    const dateStr = fmtDate(date);
    const perDay = intBetween(rng, 13, 17);
    for (let i = 0; i < perDay; i++) {
      const customer = pick(rng, CUSTOMERS);
      const lineCount = intBetween(rng, 1, 4);
      const soItems = [...allItems].sort(() => rng() - 0.5).slice(0, lineCount);
      salesOrders.push({
        salesOrderNumber: `SO-${soSeq++}`,
        orderDate: dateStr,
        customerAccount: customer.account,
        customerName: customer.name,
        status: offset >= 2 ? "Invoiced" : offset === 1 ? "Confirmed" : "Open",
        lines: soItems.map((item, li) => {
          const uom = itemUom(item);
          const quantity = uom === "ea" ? intBetween(rng, 100, 600) : intBetween(rng, 300, 1200);
          const unitPrice = round2((BASE_PRICE[item] ?? 0.5) * (1.3 + rng() * 0.5));
          return {
            lineNumber: li + 1,
            itemNumber: item,
            itemName: itemName(item),
            quantity,
            uom,
            unitPrice,
            lineAmount: round2(quantity * unitPrice),
          };
        }),
      });
    }
  }

  return { generatedFor: todayStr, contracts, receipts, salesOrders };
}

// ── Singleton (regenerates when the calendar day changes) ───────────────────

let cache: DemoData | undefined;

export function getDemoData(): DemoData {
  const todayStr = fmtDate(new Date());
  if (!cache || cache.generatedFor !== todayStr) {
    cache = generateDemoData();
  }
  return cache;
}

/** Filter helper: keep records whose date is within the trailing N days. */
export function withinDays(dateStr: string, days: number, today: Date = new Date()): boolean {
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  return dateStr >= fmtDate(cutoff);
}
