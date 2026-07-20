export interface Transaction {
  _id: string;
  order: { _id: string; orderId: string; customer?: { name: string; phone: string } };
  type: 'payment' | 'refund';
  amount: number;
  method: 'cash' | 'card' | 'upi' | 'cod' | 'razorpay';
  performedBy?: { name: string };
  note?: string;
  createdAt: string;
}

export interface PnlSummary {
  revenue: number;
  refunds: number;
  payments: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  itemsMissingCost: number;
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  pages: number;
}
