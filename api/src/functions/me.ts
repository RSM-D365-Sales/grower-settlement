import { app } from "@azure/functions";
import { withAuth } from "../auth/withAuth";

/** Returns the authenticated identity as the API sees it — proves the
 *  token → roles-claim → middleware chain end to end (Phase 0 done-when). */
app.http("me", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "me",
  handler: withAuth(async (_req, _ctx, user) => ({
    jsonBody: { id: user.id, name: user.name, roles: user.roles },
  })),
});
