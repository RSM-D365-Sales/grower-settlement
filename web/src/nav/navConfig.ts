import type { RoleRequirement } from "../auth/roles";

export interface NavItem {
  path: string;
  label: string;
  /** Roles that may see/enter this area. The API enforces its own gates. */
  allowed: RoleRequirement;
}

/**
 * Single source of truth for navigation AND route guards (Docs/PLAN.md §4).
 * Viewer is read-only everywhere except settlement, which is hard-gated to
 * Accountant/Admin.
 */
export const NAV_ITEMS: NavItem[] = [
  { path: "/", label: "Dashboard", allowed: "any" },
  { path: "/vendors", label: "Vendors", allowed: "any" },
  { path: "/items", label: "Items", allowed: "any" },
  {
    path: "/contracts",
    label: "Contracts",
    allowed: ["Admin", "Accountant", "ContractManager", "ContractApprover", "Viewer"],
  },
  {
    path: "/receiving",
    label: "Receiving",
    allowed: ["Admin", "ReceivingClerk", "Viewer"],
  },
  {
    path: "/sales",
    label: "Sales",
    allowed: "any",
  },
  {
    path: "/traceability",
    label: "Traceability",
    allowed: ["Admin", "Accountant", "ContractManager", "ContractApprover", "ReceivingClerk", "Viewer"],
  },
  {
    path: "/settlement",
    label: "Settlement",
    allowed: ["Admin", "Accountant"],
  },
  {
    path: "/admin",
    label: "Administration",
    allowed: ["Admin"],
  },
];

export function navItemFor(path: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.path === path);
}
