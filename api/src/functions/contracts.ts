import { app } from "@azure/functions";
import { z } from "zod";
import { withAuth } from "../auth/withAuth";
import { getDemoData } from "../demo/seed";

const querySchema = z.object({
  vendor: z.string().trim().max(20).optional(),
  search: z.string().trim().max(100).optional(),
});

/** Contract list (demo seed until Phase 2 brings real CRUD + workflow). */
app.http("contracts", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "contracts",
  handler: withAuth(async (req) => {
    const parsed = querySchema.safeParse(Object.fromEntries(req.query));
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: "Invalid query", details: parsed.error.flatten() } };
    }
    const { vendor, search } = parsed.data;
    let contracts = getDemoData().contracts;
    if (vendor) {
      contracts = contracts.filter((c) => c.vendorAccount === vendor);
    }
    if (search) {
      const needle = search.toLowerCase();
      contracts = contracts.filter(
        (c) =>
          c.contractNumber.toLowerCase().includes(needle) ||
          c.vendorName.toLowerCase().includes(needle)
      );
    }
    return { jsonBody: { value: contracts } };
  }),
});

/** Contract drill-in: header + individual lines (item, UoM, rate/commission). */
app.http("contractDetail", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "contracts/{contractNumber}",
  handler: withAuth(async (req) => {
    const contractNumber = req.params.contractNumber ?? "";
    const contract = getDemoData().contracts.find((c) => c.contractNumber === contractNumber);
    if (!contract) {
      return { status: 404, jsonBody: { error: `Contract ${contractNumber} not found` } };
    }
    return { jsonBody: contract };
  }),
});
