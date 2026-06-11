import { D365ProductCategory, D365ReleasedProduct, D365SalesOrder, D365Uom, D365Vendor } from "./types";

/**
 * The single gateway for all D365 F&SC access. Handlers and jobs depend on
 * this interface only; D365_MODE=mock|live picks the implementation (see
 * index.ts). Phase 1 expands this with delta sync + write operations — every
 * write must go through the IntegrationOutbox.
 */
export interface D365Client {
  readonly mode: "mock" | "live";
  getVendors(search?: string): Promise<D365Vendor[]>;
  getVendor(vendorAccount: string): Promise<D365Vendor | null>;
  getReleasedProducts(search?: string): Promise<D365ReleasedProduct[]>;
  getProductCategories(): Promise<D365ProductCategory[]>;
  getUnits(): Promise<D365Uom[]>;
  /** Posted/open sales orders for the last N days (live sync arrives Phase 5). */
  getSalesOrders(sinceDays: number): Promise<D365SalesOrder[]>;
}
