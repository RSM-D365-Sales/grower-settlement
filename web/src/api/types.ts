/** Shared API response shapes (mirror api/src/demo/seed.ts + d365/types.ts). */

export interface ContractLine {
  lineNumber: number;
  scope: "Item" | "Commodity" | "AllItems";
  itemNumber?: string;
  itemName?: string;
  commodityCode?: string;
  commodityName?: string;
  uom: string;
  ratePerUnit?: number;
  commissionPercent?: number;
}

export interface Contract {
  contractNumber: string;
  vendorAccount: string;
  vendorName: string;
  seasonCode: string;
  validFrom: string;
  validTo: string;
  settlementType: "TradeAgreement" | "SalesCommission";
  status: string;
  lines: ContractLine[];
}

export interface ReceiptLine {
  lineNumber: number;
  itemNumber: string;
  itemName: string;
  quantity: number;
  uom: string;
  lotNumber: string;
}

export interface Receipt {
  receiptNumber: string;
  receiptDate: string;
  vendorAccount: string;
  vendorName: string;
  contractNumber: string;
  status: "Open" | "Posted";
  d365PoNumber: string;
  lines: ReceiptLine[];
}
