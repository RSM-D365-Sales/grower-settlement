import { app } from "@azure/functions";
import { withAuth } from "../auth/withAuth";
import { SETTLEMENT_ROLES } from "../auth/roles";

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
