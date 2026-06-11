import { describe, expect, it } from "vitest";
import { hasAccess } from "../auth/roles";
import { NAV_ITEMS, navItemFor } from "./navConfig";

function visiblePaths(roles: Parameters<typeof hasAccess>[0]): string[] {
  return NAV_ITEMS.filter((i) => hasAccess(roles, i.allowed)).map((i) => i.path);
}

describe("role-based navigation", () => {
  it("Viewer sees read-only areas but never settlement or admin", () => {
    const paths = visiblePaths(["Viewer"]);
    expect(paths).toContain("/vendors");
    expect(paths).toContain("/items");
    expect(paths).toContain("/contracts");
    expect(paths).toContain("/receiving");
    expect(paths).toContain("/sales");
    expect(paths).toContain("/traceability");
    expect(paths).not.toContain("/settlement");
    expect(paths).not.toContain("/admin");
  });

  it("Accountant sees settlement but not admin", () => {
    const paths = visiblePaths(["Accountant"]);
    expect(paths).toContain("/settlement");
    expect(paths).not.toContain("/admin");
  });

  it("ReceivingClerk does not see settlement", () => {
    expect(visiblePaths(["ReceivingClerk"])).not.toContain("/settlement");
  });

  it("Admin sees everything", () => {
    expect(visiblePaths(["Admin"])).toHaveLength(NAV_ITEMS.length);
  });

  it("a user with no roles sees nothing", () => {
    expect(visiblePaths([])).toHaveLength(0);
  });

  it("settlement requires Accountant or Admin exactly", () => {
    const settlement = navItemFor("/settlement");
    expect(settlement?.allowed).toEqual(["Admin", "Accountant"]);
  });
});
