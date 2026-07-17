import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  CreateOrderPayload,
  CreateWalkInOrderPayload,
  Order,
  OrderStatus,
  UpdateOrderPayload,
} from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly base = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  create(payload: CreateOrderPayload) {
    return this.http.post<{ order: Order }>(this.base, payload);
  }

  createWalkIn(payload: CreateWalkInOrderPayload) {
    return this.http.post<{ order: Order; changeDue: number }>(`${this.base}/walk-in`, payload);
  }

  myOrders() {
    return this.http.get<{ orders: Order[] }>(`${this.base}/my`);
  }

  all(params: { status?: string; source?: string; search?: string; page?: number; limit?: number } = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    );
    return this.http.get<{ orders: Order[]; total: number; page: number; pages: number }>(this.base, {
      params: cleaned as any,
    });
  }

  getById(id: string) {
    return this.http.get<{ order: Order }>(`${this.base}/${id}`);
  }

  update(id: string, payload: UpdateOrderPayload) {
    return this.http.put<{ order: Order }>(`${this.base}/${id}`, payload);
  }

  updateStatus(id: string, status: OrderStatus) {
    return this.http.put<{ order: Order }>(`${this.base}/${id}/status`, { status });
  }

  recordPayment(id: string, amount: number) {
    return this.http.put<{ order: Order; changeDue: number }>(`${this.base}/${id}/payment`, { amount });
  }

  remove(id: string) {
    return this.http.delete<{ message: string; id: string }>(`${this.base}/${id}`);
  }

  refund(id: string, payload: { mode: 'now' | 'pending'; amount?: number; method?: string; note?: string }) {
    return this.http.put<{ order: Order }>(`${this.base}/${id}/refund`, payload);
  }

  settleRefund(id: string, payload: { amount?: number; method?: string; note?: string }) {
    return this.http.put<{ order: Order }>(`${this.base}/${id}/settle-refund`, payload);
  }
}
