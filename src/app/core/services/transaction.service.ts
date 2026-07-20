import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PnlSummary, TransactionListResponse } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly base = `${environment.apiUrl}/transactions`;

  constructor(private http: HttpClient) {}

  list(params: { type?: string; from?: string; to?: string; search?: string; page?: number; limit?: number } = {}) {
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return this.http.get<TransactionListResponse>(this.base, { params: cleaned as any });
  }

  pnl(params: { from?: string; to?: string } = {}) {
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return this.http.get<PnlSummary>(`${this.base}/pnl`, { params: cleaned as any });
  }
}
