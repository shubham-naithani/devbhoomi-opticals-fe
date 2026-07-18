export type OrderStatus = 'pending' | 'confirmed' | 'in_progress' | 'ready_for_pickup' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cod' | 'cash' | 'card' | 'upi';
export type OrderSource = 'online' | 'in_store';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface OrderItem {
  inventoryItem: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  _id: string;
  orderId: string;
  customer: string | { _id: string; name: string; email?: string; phone?: string; address?: string };
  createdBy?: string | { _id: string; name: string };
  items: OrderItem[];
  totalAmount: number;
  amountPaid: number;
  changeGiven?: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  source: OrderSource;
  prescriptionUsed?: string;
  shippingAddress?: string;
  contactPhone?: string;
  notes?: string;
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  refundStatus: 'none' | 'pending' | 'completed';
  refundedAmount: number;
  refundedAt?: string;
}

export interface CreateOrderPayload {
  items: { inventoryItem: string; articleId: string; quantity: number }[];
  shippingAddress?: string;
  contactPhone?: string;
  notes?: string;
}

export interface CreateWalkInOrderPayload {
  customerId: string;
  items: { inventoryItem: string; articleId: string; quantity: number }[];
  paymentMethod: PaymentMethod;
  amountPaid?: number;
  prescriptionUsed?: string;
  notes?: string;
}

export interface UpdateOrderPayload {
  notes?: string;
  shippingAddress?: string;
  contactPhone?: string;
  paymentMethod?: PaymentMethod;
}
