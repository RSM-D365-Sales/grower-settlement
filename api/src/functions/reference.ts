import { app } from "@azure/functions";
import { z } from "zod";
import { withAuth } from "../auth/withAuth";
import { getD365Client } from "../d365";

const searchSchema = z.object({
  search: z.string().trim().max(100).optional(),
});

/** D365 reference data lookups (mock-backed until Phase 1 live sync).
 *  Any authenticated app role may read reference data. */

app.http("vendors", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "vendors",
  handler: withAuth(async (req) => {
    const parsed = searchSchema.safeParse(Object.fromEntries(req.query));
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: "Invalid query", details: parsed.error.flatten() } };
    }
    const vendors = await getD365Client().getVendors(parsed.data.search);
    return { jsonBody: { value: vendors } };
  }),
});

app.http("items", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "items",
  handler: withAuth(async (req) => {
    const parsed = searchSchema.safeParse(Object.fromEntries(req.query));
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: "Invalid query", details: parsed.error.flatten() } };
    }
    const items = await getD365Client().getReleasedProducts(parsed.data.search);
    return { jsonBody: { value: items } };
  }),
});

app.http("commodities", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "commodities",
  handler: withAuth(async () => {
    const categories = await getD365Client().getProductCategories();
    return { jsonBody: { value: categories } };
  }),
});

app.http("units", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "units",
  handler: withAuth(async () => {
    const units = await getD365Client().getUnits();
    return { jsonBody: { value: units } };
  }),
});
