import { app } from "@azure/functions";
import { z } from "zod";
import { withAuth } from "../auth/withAuth";
import { SETTLEMENT_ROLES } from "../auth/roles";
import { getDemoData } from "../demo/seed";
import { buildSettlementPreview } from "../settlement/previewCalc";
import products from "../d365/fixtures/products.json";

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
