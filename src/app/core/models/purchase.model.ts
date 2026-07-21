export interface PurchaseItem {
  inventoryItem: string;
  articleId: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseRecord {
  _id: string;
  purchaseId: string;
  supplierName: string;
  invoiceNumber?: string;
  invoiceDate: string;
  items: PurchaseItem[];
  totalAmount: number;
  notes?: string;
  createdBy?: { name: string };
  createdAt: string;
}
