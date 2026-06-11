import { app } from "@azure/functions";
import { z } from "zod";
import { withAuth } from "../auth/withAuth";
import { getD365Client } from "../d365";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(31).default(7),
});

/** Sales orders for the trailing N days, via the D365 client (mock until the
 *  Phase 5 sales/invoice sync). */
app.http("salesOrders", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "salesorders",
  handler: withAuth(async (req) => {
    const parsed = querySchema.safeParse(Object.fromEntries(req.query));
    if (!parsed.success) {
      return { status: 400, jsonBody: { error: "Invalid query", details: parsed.error.flatten() } };
    }
    const orders = await getD365Client().getSalesOrders(parsed.data.days);
    const sorted = [...orders].sort((a, b) => b.orderDate.localeCompare(a.orderDate));
    return { jsonBody: { value: sorted } };
  }),
});
