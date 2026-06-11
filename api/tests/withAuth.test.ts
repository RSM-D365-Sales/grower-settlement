import { beforeEach, describe, expect, it } from "vitest";
import { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { withAuth } from "../src/auth/withAuth";

function makeRequest(headers: Record<string, string> = {}): HttpRequest {
  return {
    headers: new Headers(headers),
    query: new URLSearchParams(),
  } as unknown as HttpRequest;
}

const ctx = { warn: () => undefined } as unknown as InvocationContext;

const okHandler = withAuth(async (_req, _ctx, user) => ({ status: 200, jsonBody: { user } }));
const settlementHandler = withAuth(async () => ({ status: 200, jsonBody: { ok: true } }), {
  roles: ["Accountant", "Admin"],
});

beforeEach(() => {
  delete process.env.MOCK_ROLES;
  delete process.env.ENTRA_TENANT_ID;
  delete process.env.API_CLIENT_ID;
});

describe("withAuth — entra mode", () => {
  beforeEach(() => {
    process.env.AUTH_MODE = "entra";
  });

  it("rejects a request with no bearer token (401)", async () => {
    const res = await okHandler(makeRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("rejects a garbage bearer token (401)", async () => {
    const res = await okHandler(makeRequest({ authorization: "Bearer not-a-jwt" }), ctx);
    expect(res.status).toBe(401);
  });

  it("rejects a non-bearer authorization header (401)", async () => {
    const res = await okHandler(makeRequest({ authorization: "Basic abc" }), ctx);
    expect(res.status).toBe(401);
  });
});

describe("withAuth — mock mode", () => {
  beforeEach(() => {
    process.env.AUTH_MODE = "mock";
  });

  it("rejects when no mock identity is supplied (401)", async () => {
    const res = await okHandler(makeRequest(), ctx);
    expect(res.status).toBe(401);
  });

  it("authenticates from the x-mock-roles header", async () => {
    const res = (await okHandler(
      makeRequest({ "x-mock-roles": "Viewer", "x-mock-user": "Pat" }),
      ctx
    )) as HttpResponseInit;
    expect(res.status).toBe(200);
    const body = res.jsonBody as { user: { name: string; roles: string[] } };
    expect(body.user.name).toBe("Pat");
    expect(body.user.roles).toEqual(["Viewer"]);
  });

  it("filters unknown role strings out of the claim", async () => {
    const res = (await okHandler(
      makeRequest({ "x-mock-roles": "Viewer, SuperUser, Admin" }),
      ctx
    )) as HttpResponseInit;
    const body = res.jsonBody as { user: { roles: string[] } };
    expect(body.user.roles).toEqual(["Viewer", "Admin"]);
  });

  it("enforces role gates server-side: Viewer cannot reach settlement (403)", async () => {
    const res = await settlementHandler(makeRequest({ "x-mock-roles": "Viewer" }), ctx);
    expect(res.status).toBe(403);
  });

  it("ReceivingClerk cannot reach settlement (403)", async () => {
    const res = await settlementHandler(makeRequest({ "x-mock-roles": "ReceivingClerk,ContractManager" }), ctx);
    expect(res.status).toBe(403);
  });

  it("Accountant can reach settlement (200)", async () => {
    const res = await settlementHandler(makeRequest({ "x-mock-roles": "Accountant" }), ctx);
    expect(res.status).toBe(200);
  });

  it("Admin can reach settlement (200)", async () => {
    const res = await settlementHandler(makeRequest({ "x-mock-roles": "Admin" }), ctx);
    expect(res.status).toBe(200);
  });

  it("falls back to MOCK_ROLES env when no header is sent", async () => {
    process.env.MOCK_ROLES = "Accountant";
    const res = await settlementHandler(makeRequest(), ctx);
    expect(res.status).toBe(200);
  });
});
