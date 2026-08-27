import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CreateRepairPayload, RepairLookupResult, RepairStatus, RepairTicket } from '../models/repair.model';

// Line item as it comes back from a scanned order — a trimmed view of an
// Order's item, just the fields the repair-intake flow actually needs.
export interface RepairOrderItem {
  inventoryItem: string;
  articleId: string;
  name: string;
  price: number;
  quantity: number;
  warrantyMonths: number;
}

// What GET /repairs/lookup-order returns — the whole order the scanned
// barcode resolved to, so staff can pick which line item needs a ticket.
export interface RepairOrderLookup {
  _id: string;
  orderId: string;
  createdAt: string;
  items: RepairOrderItem[];
}

@Injectable({ providedIn: 'root' })
export class RepairService {
  private readonly base = `${environment.apiUrl}/repairs`;

  constructor(private http: HttpClient) {}

  // LEGACY — superseded by lookupOrder() below now that invoices print a
  // single order-level barcode instead of one per item. Left in place in
  // case anything else still calls it; not used by repair-order.component.
  lookup(customerId: string, barcode: string) {
    return this.http.get<RepairLookupResult>(`${this.base}/lookup`, { params: { customerId, barcode } });
  }

  // Resolves a scanned order-level barcode (from the printed invoice) to
  // the full order — customer, purchase date, and every line item — for
  // the repair-intake item picker.
  lookupOrder(customerId: string, barcode: string) {
    return this.http.get<{ order: RepairOrderLookup }>(`${this.base}/lookup-order`, {
      params: { customerId, barcode },
    });
  }

  create(payload: CreateRepairPayload) {
    return this.http.post<{ ticket: RepairTicket }>(this.base, payload);
  }

  all(params: { status?: string; search?: string; page?: number; limit?: number }) {
    const cleanParams: Record<string, string> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        cleanParams[key] = String(value);
      }
    });
    return this.http.get<{ tickets: RepairTicket[]; total: number; page: number; pages: number }>(this.base, {
      params: cleanParams,
    });
  }

  getById(id: string) {
    return this.http.get<{ ticket: RepairTicket }>(`${this.base}/${id}`);
  }

  updateStatus(id: string, status: RepairStatus) {
    return this.http.put<{ ticket: RepairTicket }>(`${this.base}/${id}/status`, { status });
  }

  update(id: string, payload: Partial<CreateRepairPayload> & { feeCollected?: boolean }) {
    return this.http.put<{ ticket: RepairTicket }>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string; id: string }>(`${this.base}/${id}`);
  }
}
