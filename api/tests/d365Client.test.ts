import { beforeEach, describe, expect, it } from "vitest";
import { MockD365Client } from "../src/d365/mockD365Client";
import { getD365Client, resetD365Client } from "../src/d365";

describe("MockD365Client", () => {
  const client = new MockD365Client();

  it("returns all 20 fixture vendors with no search", async () => {
    const vendors = await client.getVendors();
    expect(vendors).toHaveLength(20);
  });

  it("filters vendors by name, case-insensitively", async () => {
    const vendors = await client.getVendors("berry");
    expect(vendors.length).toBeGreaterThan(0);
    expect(vendors.every((v) => v.name.toLowerCase().includes("berry"))).toBe(true);
  });

  it("finds a vendor by account and returns null for unknown", async () => {
    expect((await client.getVendor("V-1001"))?.name).toBe("Sunrise Berry Farms LLC");
    expect(await client.getVendor("V-9999")).toBeNull();
  });

  it("filters products by item number or commodity", async () => {
    const byItem = await client.getReleasedProducts("STRAW");
    expect(byItem.map((p) => p.itemNumber)).toContain("STRAW-CONV");
    const byCommodity = await client.getReleasedProducts("VEG-TOM");
    expect(byCommodity.length).toBe(2);
  });

  it("returns the commodity hierarchy with a single root", async () => {
    const categories = await client.getProductCategories();
    expect(categories.filter((c) => c.parentCode === null)).toHaveLength(1);
  });

  it("serves demo sales orders within the requested window", async () => {
    const orders = await client.getSalesOrders(7);
    expect(orders.length).toBeGreaterThan(0);
    const wider = await client.getSalesOrders(30);
    expect(wider.length).toBeGreaterThan(orders.length);
  });
});

describe("getD365Client factory", () => {
  beforeEach(() => resetD365Client());

  it("defaults to mock mode", () => {
    delete process.env.D365_MODE;
    expect(getD365Client().mode).toBe("mock");
  });

  it("fails loudly when live mode is missing settings", () => {
    process.env.D365_MODE = "live";
    delete process.env.D365_BASE_URL;
    expect(() => getD365Client()).toThrow(/requires settings/);
    delete process.env.D365_MODE;
  });
});
