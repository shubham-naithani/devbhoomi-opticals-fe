import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { Coupon } from '../models/coupon.model';

export interface CouponListResponse {
  coupons: Coupon[];
  total: number;
  page: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class CouponService {
  private readonly base = `${environment.apiUrl}/coupons`;

  constructor(private http: HttpClient) {}

  list(params: { search?: string; page?: number; limit?: number } = {}) {
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return this.http.get<CouponListResponse>(this.base, { params: cleaned as any });
  }

  create(payload: {
    code: string;
    discountType: 'fixed' | 'percentage';
    value: number;
    minOrderValue?: number;
    expiresAt?: string;
    usageLimit?: number;
  }) {
    return this.http.post<{ coupon: Coupon }>(this.base, payload);
  }

  update(id: string, payload: Partial<{ isActive: boolean; value: number; minOrderValue: number; expiresAt: string; usageLimit: number }>) {
    return this.http.put<{ coupon: Coupon }>(`${this.base}/${id}`, payload);
  }

  delete(id: string) {
    return this.http.delete<{ message: string; id: string }>(`${this.base}/${id}`);
  }
}
