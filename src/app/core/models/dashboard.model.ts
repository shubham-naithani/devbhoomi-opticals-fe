export interface DashboardStats {
  revenue: {
    today: { revenue: number; orders: number };
    week: { revenue: number; orders: number };
    month: { revenue: number; orders: number };
    bySource: { _id: string; revenue: number; orders: number }[];
  };
  statusBreakdown: { _id: string; count: number }[];
  topProducts: { _id: string; unitsSold: number; revenue: number }[];
  revenueTrend: { _id: string; revenue: number }[];
  recentOrders: {
    orderId: string;
    totalAmount: number;
    status: string;
    source: string;
    createdAt: string;
    paymentStatus: string;
    customer?: { name: string; phone: string };
  }[];
  totalUsers: number;
  totalInventory: number;
  lowStockCount: number;
  lowStockItems: { productId: string; name: string; sku: string; stock: number }[];
}
