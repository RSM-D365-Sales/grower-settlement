import { app } from "@azure/functions";

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async () => ({
    jsonBody: {
      status: "ok",
      authMode: process.env.AUTH_MODE ?? "entra",
      d365Mode: process.env.D365_MODE ?? "mock",
      timestamp: new Date().toISOString(),
    },
  }),
});
