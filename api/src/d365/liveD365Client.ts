import { D365Client } from "./D365Client";
import { D365ProductCategory, D365ReleasedProduct, D365SalesOrder, D365Uom, D365Vendor } from "./types";

/**
 * Live OData client — implemented in Phase 1 (client-credentials auth, typed
 * entity clients, retry + 429/Retry-After backoff, request logging, and a
 * $metadata verification script). Until then it fails loudly so a
 * misconfigured D365_MODE is obvious.
 */
export class LiveD365Client implements D365Client {
  readonly mode = "live" as const;

  constructor() {
    const required = ["D365_BASE_URL", "ENTRA_TENANT_ID", "D365_CLIENT_ID", "D365_CLIENT_SECRET"];
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      throw new Error(`D365_MODE=live requires settings: ${missing.join(", ")}`);
    }
  }

  private notImplemented(): never {
    throw new Error("LiveD365Client is implemented in Phase 1 — run with D365_MODE=mock until then");
  }

  async getVendors(_search?: string): Promise<D365Vendor[]> {
    this.notImplemented();
  }
  async getVendor(_vendorAccount: string): Promise<D365Vendor | null> {
    this.notImplemented();
  }
  async getReleasedProducts(_search?: string): Promise<D365ReleasedProduct[]> {
    this.notImplemented();
  }
  async getProductCategories(): Promise<D365ProductCategory[]> {
    this.notImplemented();
  }
  async getUnits(): Promise<D365Uom[]> {
    this.notImplemented();
  }
  async getSalesOrders(_sinceDays: number): Promise<D365SalesOrder[]> {
    this.notImplemented();
  }
}
