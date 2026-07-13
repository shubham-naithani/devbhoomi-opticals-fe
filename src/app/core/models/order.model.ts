export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cod' | 'cash' | 'card' | 'upi';
export type OrderSource = 'online' | 'in_store';

export interface OrderItem {
  inventoryItem: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  _id: string;
  orderId: string;
  customer: string | { _id: string; name: string; email?: string; phone?: string };
  createdBy?: string | { _id: string; name: string };
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  source: OrderSource;
  prescriptionUsed?: string;
  shippingAddress?: string;
  contactPhone?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateOrderPayload {
  items: { inventoryItem: string; quantity: number }[];
  shippingAddress?: string;
  contactPhone?: string;
  notes?: string;
}

export interface CreateWalkInOrderPayload {
  customerId: string;
  items: { inventoryItem: string; quantity: number }[];
  paymentMethod: PaymentMethod;
  prescriptionUsed?: string;
  notes?: string;
}
