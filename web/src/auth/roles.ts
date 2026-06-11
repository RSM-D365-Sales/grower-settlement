/**
 * Entra app roles — exact strings, keep in sync with api/src/auth/roles.ts.
 * UI role checks are navigation convenience only; the API re-validates the
 * roles claim on every request (Docs/PLAN.md §4).
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

export type RoleRequirement = Role[] | "any";

export function hasAccess(userRoles: Role[], required: RoleRequirement): boolean {
  if (userRoles.length === 0) return false;
  if (required === "any") return true;
  return required.some((r) => userRoles.includes(r));
}
