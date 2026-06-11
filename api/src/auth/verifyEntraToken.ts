import jwt, { JwtHeader, JwtPayload, SigningKeyCallback } from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";
import { isRole, Role } from "./roles";

export interface AuthenticatedUser {
  /** Entra object id (oid claim). */
  id: string;
  name: string;
  roles: Role[];
}

let cachedClient: JwksClient | undefined;
let cachedTenant: string | undefined;

function getJwks(tenantId: string): JwksClient {
  if (!cachedClient || cachedTenant !== tenantId) {
    cachedClient = jwksClient({
      jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      cache: true,
      rateLimit: true,
    });
    cachedTenant = tenantId;
  }
  return cachedClient;
}

/**
 * Validates an Entra-issued access token (signature, issuer, audience, expiry)
 * and extracts the app-role claims. Throws on any validation failure.
 */
export async function verifyEntraToken(token: string): Promise<AuthenticatedUser> {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const apiClientId = process.env.API_CLIENT_ID;
  if (!tenantId || !apiClientId) {
    throw new Error("ENTRA_TENANT_ID and API_CLIENT_ID must be configured when AUTH_MODE=entra");
  }

  const getKey = (header: JwtHeader, callback: SigningKeyCallback) => {
    getJwks(tenantId).getSigningKey(header.kid, (err, key) => {
      if (err || !key) return callback(err ?? new Error("Signing key not found"));
      callback(null, key.getPublicKey());
    });
  };

  const payload = await new Promise<JwtPayload>((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        algorithms: ["RS256"],
        audience: [apiClientId, `api://${apiClientId}`],
        issuer: [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://sts.windows.net/${tenantId}/`,
        ],
      },
      (err, decoded) => {
        if (err || !decoded || typeof decoded === "string") {
          return reject(err ?? new Error("Invalid token payload"));
        }
        resolve(decoded);
      }
    );
  });

  const rawRoles: unknown = payload.roles;
  const roles = Array.isArray(rawRoles) ? rawRoles.filter((r): r is Role => typeof r === "string" && isRole(r)) : [];

  return {
    id: typeof payload.oid === "string" ? payload.oid : payload.sub ?? "unknown",
    name: typeof payload.name === "string" ? payload.name : "Unknown user",
    roles,
  };
}
