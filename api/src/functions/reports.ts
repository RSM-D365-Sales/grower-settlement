import { app } from "@azure/functions";
import { z } from "zod";
import { withAuth } from "../auth/withAuth";
import { SETTLEMENT_ROLES } from "../auth/roles";
import { getDemoData } from "../demo/seed";
import { buildPeriodReport } from "../reports/periodReportCalc";
import products from "../d365/fixtures/products.json";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd");

const periodQuerySchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((q) => q.from <= q.to, { message: "from must be on or before to", path: ["from"] })
  .refine(
    (q) => {
      const days =
        (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / 86_400_000;
      return days < 62;
    },
    { message: "range too large (max 62 days)", path: ["to"] }
  );

const commodityByItem = new Map(products.map((p) => [p.itemNumber, p.commodityCode]));

/**
 * Weekly-period report for the settlement dashboard (Docs/DECISIONS.md 0.17).
 * Any authenticated role sees receiving/sales activity; the settlement
 * register is shaped OUT server-side unless the caller holds the
 * Accountant/Admin settlement gate (Docs/PLAN.md §4) — same hard gate as
 * /settlement/*, enforced here by role-based response shaping.
 */
app.http("reportsPeriod", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "reports/period",
  handler: withAuth(async (req, _ctx, user) => {
    const parsed = periodQuerySchema.safeParse(Object.fromEntries(req.query));
    if (!parsed.success) {
      return {
        status: 400,
        jsonBody: { error: "Invalid query", details: parsed.error.flatten() },
      };
    }
    const demo = getDemoData();
    const report = buildPeriodReport({
      contracts: demo.contracts,
      receipts: demo.receipts,
      salesOrders: demo.salesOrders,
      commodityByItem,
      fromDate: parsed.data.from,
      toDate: parsed.data.to,
      includeSettlements: user.roles.some((r) => SETTLEMENT_ROLES.includes(r)),
    });
    return { jsonBody: report };
  }),
});
