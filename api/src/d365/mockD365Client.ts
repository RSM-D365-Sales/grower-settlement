import { D365Client } from "./D365Client";
import { D365ProductCategory, D365ReleasedProduct, D365SalesOrder, D365Uom, D365Vendor } from "./types";
import vendors from "./fixtures/vendors.json";
import products from "./fixtures/products.json";
import commodities from "./fixtures/commodities.json";
import units from "./fixtures/units.json";
import { getDemoData, withinDays } from "../demo/seed";

function matches(search: string | undefined, ...fields: (string | null)[]): boolean {
  if (!search) return true;
  const needle = search.toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(needle));
}

/**
 * Fixture-backed D365 client so every phase is buildable and testable without
 * environment access (Docs/PLAN.md §8 Phase 0). Keep fixtures realistic —
 * they double as seed data for later phases' tests.
 */
export class MockD365Client implements D365Client {
  readonly mode = "mock" as const;

  async getVendors(search?: string): Promise<D365Vendor[]> {
    return (vendors as D365Vendor[]).filter((v) => matches(search, v.vendorAccount, v.name));
  }

  async getVendor(vendorAccount: string): Promise<D365Vendor | null> {
    return (vendors as D365Vendor[]).find((v) => v.vendorAccount === vendorAccount) ?? null;
  }

  async getReleasedProducts(search?: string): Promise<D365ReleasedProduct[]> {
    return (products as D365ReleasedProduct[]).filter((p) =>
      matches(search, p.itemNumber, p.name, p.commodityCode)
    );
  }

  async getProductCategories(): Promise<D365ProductCategory[]> {
    return commodities as D365ProductCategory[];
  }

  async getUnits(): Promise<D365Uom[]> {
    return units as D365Uom[];
  }

  async getSalesOrders(sinceDays: number): Promise<D365SalesOrder[]> {
    return getDemoData().salesOrders.filter((so) => withinDays(so.orderDate, sinceDays));
  }
}
