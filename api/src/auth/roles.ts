/**
 * Entra app roles. Exact strings must match the app registration manifest
 * and web/src/auth/roles.ts. See Docs/PLAN.md §4.
 */
export const ROLES = [
  "Admin",
  "Accountant",
  "ContractManager",
  "ContractApprover",
  "ReceivingClerk",
  "Viewer",
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Roles allowed to touch settlement — hard-gated per Docs/PLAN.md §4. */
export const SETTLEMENT_ROLES: Role[] = ["Accountant", "Admin"];
