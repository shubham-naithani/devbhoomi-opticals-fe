export interface Coupon {
  _id: string;
  code: string;
  discountType: 'fixed' | 'percentage';
  value: number;
  minOrderValue: number;
  expiresAt?: string;
  usageLimit?: number;
  usageCount: number;
  isActive: boolean;
  createdAt: string;
}
