export interface Lead {
  _id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  uploadBatchId: string;
  createdAt: string;
  lastCouponSentAt?: string | null;
  converted?: boolean;
}
