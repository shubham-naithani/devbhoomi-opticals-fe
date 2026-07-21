import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PurchaseRecord } from '../models/purchase.model';

export interface PurchaseListResponse {
  records: PurchaseRecord[];
  total: number;
  page: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly base = `${environment.apiUrl}/purchases`;

  constructor(private http: HttpClient) {}

  list(params: { search?: string; from?: string; to?: string; page?: number; limit?: number } = {}) {
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return this.http.get<PurchaseListResponse>(this.base, { params: cleaned as any });
  }

  getById(id: string) {
    return this.http.get<{ purchaseRecord: PurchaseRecord }>(`${this.base}/${id}`);
  }

  create(payload: {
    supplierName: string;
    invoiceNumber?: string;
    invoiceDate: string;
    items: { inventoryItem: string; articleId: string; quantity: number; unitCost: number }[];
    notes?: string;
  }) {
    return this.http.post<{ purchaseRecord: PurchaseRecord }>(this.base, payload);
  }
}
