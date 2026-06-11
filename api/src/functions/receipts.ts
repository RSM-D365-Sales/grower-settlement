import { app } from "@azure/functions";
import { z } from "zod";
import { withAuth } from "../auth/withAuth";
import { getDemoData, withinDays } from "../demo/seed";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(31).default(7),
  vendor: z.string().trim().max(20).optional(),
  contract: z.string().trim().max(30).optional(),
});

/** Receipts for the trailing N days (demo seed until Phase 3 brings real
 *  receiving + PO push + message-processor posting). */
app.http("receipts", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "receipts",
  handler: withAuth(async (req) => {
    const parsed = querySchema.safeParse(Object.fromEntries(req.query));
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: "Invalid query", details: parsed.error.flatten() } };
    }
    const { days, vendor, contract } = parsed.data;
    let receipts = getDemoData().receipts.filter((r) => withinDays(r.receiptDate, days));
    if (vendor) {
      receipts = receipts.filter((r) => r.vendorAccount === vendor);
    }
    if (contract) {
      receipts = receipts.filter((r) => r.contractNumber === contract);
    }
    // Newest first for the receiving board.
    receipts = [...receipts].sort((a, b) => b.receiptDate.localeCompare(a.receiptDate));
    return { jsonBody: { value: receipts } };
  }),
});
