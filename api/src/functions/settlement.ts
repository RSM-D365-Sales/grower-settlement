import { app } from "@azure/functions";
import { z } from "zod";
import { withAuth } from "../auth/withAuth";
import { SETTLEMENT_ROLES } from "../auth/roles";
import { getDemoData } from "../demo/seed";
import { buildSettlementPreview } from "../settlement/previewCalc";
import products from "../d365/fixtures/products.json";
import settlementRegister from "../demo/settlements.json";

/**
 * Settlement endpoints are hard-gated to Accountant/Admin on every request
 * (Docs/PLAN.md §4). Phase 0 stub — the engine arrives in Phase 6, but the
 * gate exists (and is tested) from day one.
 */
app.http("settlementBatches", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "settlement/batches",
  handler: withAuth(
    async () => ({
      jsonBody: { value: [], note: "Settlement engine arrives in Phase 6" },
    }),
    { roles: SETTLEMENT_ROLES }
  ),
});

/**
 * Settlement register from the D365 grower-accounting workbook export
 * (Settlement-data.xlsx → api/src/demo/settlements.json via
 * scripts/convertSettlementWorkbook.ts). Read-only real-ID data for the demo;
 * same Accountant/Admin hard gate as every settlement endpoint.
 */
app.http("settlementList", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "settlements",
  handler: withAuth(
    async () => ({ jsonBody: { value: settlementRegister.settlements } }),
    { roles: SETTLEMENT_ROLES }
  ),
});

const settlementIdSchema = z.string().regex(/^[A-Za-z0-9-]{1,30}$/);

/** Settlement drill-in: header, per-grower lines, receipts, sales invoices,
 *  premiums/deductions and advances for one settlement. */
app.http("settlementDetail", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "settlements/{settlementId}",
  handler: withAuth(
    async (req) => {
      const parsed = settlementIdSchema.safeParse(req.params.settlementId ?? "");
      if (!parsed.success) {
        return { status: 400, jsonBody: { error: "Invalid settlement id" } };
      }
      const found = settlementRegister.settlements.find(
        (s) => s.settlementId === parsed.data
      );
      if (!found) {
        return { status: 404, jsonBody: { error: `Settlement ${parsed.data} not found` } };
      }
      return { jsonBody: found };
    },
    { roles: SETTLEMENT_ROLES }
  ),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd");

const previewQuerySchema = z
  .object({
    vendor: z.string().trim().min(1).max(20),
    from: isoDate,
    to: isoDate,
    basis: z.enum(["receipt", "sales", "both"]).default("both"),
  })
  .refine((q) => q.from <= q.to, { message: "from must be on or before to", path: ["from"] });

const commodityByItem = new Map(products.map((p) => [p.itemNumber, p.commodityCode]));

/**
 * Mock settlement preview (Docs/DECISIONS.md 0.15): computes estimated grower
 * payable from the demo seed for one vendor / date range / contract basis.
 * Read-only — no batch is created and nothing touches D365.
 */
app.http("settlementPreview", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "settlement/preview",
  handler: withAuth(
    async (req) => {
      const parsed = previewQuerySchema.safeParse(Object.fromEntries(req.query));
      if (!parsed.success) {
        return {
          status: 400,
          jsonBody: { error: "Invalid query", details: parsed.error.flatten() },
        };
      }
      const { vendor, from, to, basis } = parsed.data;
      const demo = getDemoData();
      const preview = buildSettlementPreview({
        contracts: demo.contracts,
        receipts: demo.receipts,
        salesOrders: demo.salesOrders,
        commodityByItem,
        vendorAccount: vendor,
        fromDate: from,
        toDate: to,
        basis,
      });
      if (!preview) {
        return { status: 404, jsonBody: { error: `No contracts for vendor ${vendor}` } };
      }
      return { jsonBody: preview };
    },
    { roles: SETTLEMENT_ROLES }
  ),
});
