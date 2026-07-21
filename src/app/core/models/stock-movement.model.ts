export type StockMovementType = 'sale' | 'restock_cancelled' | 'purchase_in' | 'manual_adjustment';

export interface StockMovement {
  _id: string;
  inventoryItem: string;
  articleId: string;
  sku: string;
  productName: string;
  type: StockMovementType;
  quantityChange: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  referenceType?: 'Order' | 'PurchaseRecord' | null;
  referenceId?: string | null;
  performedBy?: { name: string };
  createdAt: string;
}
