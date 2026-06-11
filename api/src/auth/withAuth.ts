import { HttpHandler, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AuthenticatedUser, verifyEntraToken } from "./verifyEntraToken";
import { isRole, Role } from "./roles";

export type AuthedHandler = (
  request: HttpRequest,
  context: InvocationContext,
  user: AuthenticatedUser
) => Promise<HttpResponseInit>;

export interface AuthOptions {
  /** If set, the caller must hold at least one of these roles (403 otherwise). */
  roles?: Role[];
}

type AuthResult = { ok: true; user: AuthenticatedUser } | { ok: false; status: number; error: string };

async function authenticate(request: HttpRequest): Promise<AuthResult> {
  const mode = process.env.AUTH_MODE ?? "entra";

  if (mode === "mock") {
    // Local-dev identity: roles come from the x-mock-roles header (sent by the
    // SPA's mock sign-in) or MOCK_ROLES. Role enforcement below still applies,
    // so 403 paths are fully exercisable without a tenant.
    const headerRoles = request.headers.get("x-mock-roles");
    const envRoles = process.env.MOCK_ROLES;
    if (!headerRoles && !envRoles && !request.headers.get("authorization")) {
      return { ok: false, status: 401, error: "Unauthenticated (mock mode: send x-mock-roles header)" };
    }
    const roles = (headerRoles ?? envRoles ?? "")
      .split(",")
      .map((r) => r.trim())
      .filter(isRole);
    const name = request.headers.get("x-mock-user") ?? "Mock User";
    return { ok: true, user: { id: `mock:${name}`, name, roles } };
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing bearer token" };
  }
  try {
    const user = await verifyEntraToken(authHeader.slice("Bearer ".length));
    return { ok: true, user };
  } catch {
    return { ok: false, status: 401, error: "Invalid token" };
  }
}

/**
 * Wraps an HTTP handler with server-side authentication + role authorization.
 * Every non-anonymous endpoint MUST use this — UI checks are convenience only.
 */
export function withAuth(handler: AuthedHandler, options: AuthOptions = {}): HttpHandler {
  return async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    const result = await authenticate(request);
    if (!result.ok) {
      return { status: result.status, jsonBody: { error: result.error } };
    }
    const { user } = result;
    if (options.roles && options.roles.length > 0 && !options.roles.some((r) => user.roles.includes(r))) {
      context.warn(`403: user ${user.id} (roles: ${user.roles.join(",") || "none"}) lacks ${options.roles.join("|")}`);
      return { status: 403, jsonBody: { error: "Insufficient role" } };
    }
    return handler(request, context, user);
  };
}
