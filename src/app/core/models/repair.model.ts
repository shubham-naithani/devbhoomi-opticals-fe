export type RepairStatus = 'received' | 'in_progress' | 'ready_for_pickup' | 'collected' | 'cancelled';

export interface RepairCandidate {
  orderId: string;
  orderNumber: string;
  purchaseDate: string;
  warrantyMonths: number;
}

export interface RepairLookupResult {
  item: { _id: string; name: string; brand?: string };
  article: { _id: string; sku?: string; barcode?: string; color?: string; lensTint?: string; size?: string };
  itemName: string;
  candidates: RepairCandidate[];
}

export interface RepairTicket {
  _id: string;
  repairId: string;
  customer: string | { _id: string; name: string; phone?: string; email?: string };
  inventoryItem?: string;
  articleId?: string;
  itemName: string;
  linkedOrderId?: string | { _id: string; orderId: string; createdAt: string };
  purchaseDate?: string;
  warrantyMonths: number;
  isUnderWarranty: boolean;
  isUnverified: boolean;
  feeAmount: number;
  feeCollected: boolean;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'cod';
  issueDescription: string;
  staffNotes?: string;
  status: RepairStatus;
  createdBy?: string | { _id: string; name: string };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateRepairPayload {
  customerId: string;
  inventoryItem?: string;
  articleId?: string;
  itemName: string;
  linkedOrderId?: string;
  purchaseDate?: string;
  warrantyMonths?: number;
  issueDescription: string;
  staffNotes?: string;
  feeAmount?: number;
  feeCollected?: boolean;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'cod';
}
