/**
 * App-facing D365 reference data shapes. These are deliberately narrower than
 * the raw OData entities — the live client (Phase 1) maps entity fields to
 * these after verifying names against $metadata.
 */

export interface D365Vendor {
  vendorAccount: string;
  name: string;
  city: string;
  state: string;
  currency: string;
  paymentTerms: string;
  dataAreaId: string;
}

export interface D365ReleasedProduct {
  itemNumber: string;
  name: string;
  inventoryUnit: string;
  salesUnit: string;
  /** Commodity (product category) this item belongs to, if assigned. */
  commodityCode: string | null;
  /** Batch/lot tracking dimension active — drives traceability. */
  lotControlled: boolean;
  shelfLifeDays: number | null;
  storageTemp: string | null;
  dataAreaId: string;
}

export interface D365ProductCategory {
  code: string;
  name: string;
  parentCode: string | null;
  hierarchyName: string;
}

export interface D365Uom {
  symbol: string;
  name: string;
}

/** Sales orders sync D365 → app in Phase 5; mocked from the demo seed until then. */
export interface D365SalesOrderLine {
  lineNumber: number;
  itemNumber: string;
  itemName: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  lineAmount: number;
}

export interface D365SalesOrder {
  salesOrderNumber: string;
  orderDate: string; // yyyy-mm-dd
  customerAccount: string;
  customerName: string;
  status: string; // Open | Confirmed | Invoiced
  lines: D365SalesOrderLine[];
}
