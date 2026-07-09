import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CreateOrderPayload, Order, OrderStatus } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly base = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  create(payload: CreateOrderPayload) {
    return this.http.post<{ order: Order }>(this.base, payload);
  }

  myOrders() {
    return this.http.get<{ orders: Order[] }>(`${this.base}/my`);
  }

  all(params: { status?: string; page?: number; limit?: number } = {}) {
    return this.http.get<{ orders: Order[]; total: number; page: number; pages: number }>(this.base, {
      params: params as any,
    });
  }

  updateStatus(id: string, status: OrderStatus) {
    return this.http.put<{ order: Order }>(`${this.base}/${id}/status`, { status });
  }
}
