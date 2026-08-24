export type CustomerTier = 'new' | 'regular' | 'frequent';

export interface ExistingCustomer {
  userId: string;
  name: string;
  phone: string;
  email: string;
  pointsBalance: number;
  orderCount: number;
  lastOrderAt: string;
  tier: CustomerTier;
}
