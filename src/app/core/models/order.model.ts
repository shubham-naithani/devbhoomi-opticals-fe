export type OrderStatus = 'pending' | 'confirmed' | 'delivered' | 'cancelled';

export interface OrderItem {
  inventoryItem: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  _id: string;
  customer: string | { _id: string; name: string; email: string; phone?: string };
  items: OrderItem[];
  totalAmount: number;
  paymentMethod: 'cod';
  status: OrderStatus;
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
