import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Lead } from '../models/lead.model';
import { ExistingCustomer } from '../models/existing-customer.model';
import { MarketingLogEntry } from '../models/marketing-log.model';

export interface LeadListResponse {
  leads: Lead[];
  total: number;
  page: number;
  pages: number;
}

export interface LeadUploadResult {
  created: Lead[];
  skipped: { row: any; reason: string }[];
}

export interface ExistingCustomerListResponse {
  customers: ExistingCustomer[];
  total: number;
  page: number;
  pages: number;
}

export interface SendRecipient {
  type: 'lead' | 'customer';
  name: string;
  phone: string;
  email?: string;
}

export interface SendCouponResult {
  sent: any[];
  failed: { recipient: SendRecipient; reason: string }[];
}

export interface MarketingLogListResponse {
  logs: MarketingLogEntry[];
  total: number;
  page: number;
  pages: number;
}

export interface GenerateReferralCouponRequest {
  referrerUserId: string;
  discountType: 'fixed' | 'percentage';
  value: number;
  minOrderValue?: number;
  expiresAt?: string;
  referralPercent: number;
  usageLimit?: number;
  code?: string;
}

export interface GenerateReferralCouponResult {
  coupon: { code: string; [key: string]: any };
  whatsappSent: boolean;
}

@Injectable({ providedIn: 'root' })
export class MarketingService {
  private readonly base = `${environment.apiUrl}/marketing`;

  constructor(private http: HttpClient) {}

  private cleanParams(params: Record<string, any>) {
    return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  }

  uploadLeads(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<LeadUploadResult>(`${this.base}/leads/upload`, formData);
  }

  listLeads(params: { search?: string; page?: number; limit?: number } = {}) {
    return this.http.get<LeadListResponse>(`${this.base}/leads`, { params: this.cleanParams(params) as any });
  }

  listExistingCustomers(params: { search?: string; page?: number; limit?: number } = {}) {
    return this.http.get<ExistingCustomerListResponse>(`${this.base}/customers`, { params: this.cleanParams(params) as any });
  }

  generateReferralCoupon(payload: GenerateReferralCouponRequest) {
    return this.http.post<GenerateReferralCouponResult>(`${this.base}/referral-coupons`, payload);
  }

  sendCoupon(templateCouponId: string, recipients: SendRecipient[]) {
    return this.http.post<SendCouponResult>(`${this.base}/send`, { templateCouponId, recipients });
  }

  getLogs(params: { page?: number; limit?: number } = {}) {
    return this.http.get<MarketingLogListResponse>(`${this.base}/logs`, { params: this.cleanParams(params) as any });
  }
}
