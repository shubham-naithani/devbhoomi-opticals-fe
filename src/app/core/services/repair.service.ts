import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CreateRepairPayload, RepairLookupResult, RepairStatus, RepairTicket } from '../models/repair.model';

@Injectable({ providedIn: 'root' })
export class RepairService {
  private readonly base = `${environment.apiUrl}/repairs`;

  constructor(private http: HttpClient) {}

  lookup(customerId: string, barcode: string) {
    return this.http.get<RepairLookupResult>(`${this.base}/lookup`, { params: { customerId, barcode } });
  }

  create(payload: CreateRepairPayload) {
    return this.http.post<{ ticket: RepairTicket }>(this.base, payload);
  }

  all(params: { status?: string; search?: string; page?: number; limit?: number }) {
    return this.http.get<{ tickets: RepairTicket[]; total: number; page: number; pages: number }>(this.base, {
      params: params as any,
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
