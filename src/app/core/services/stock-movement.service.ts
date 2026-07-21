import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { StockMovement } from '../models/stock-movement.model';

export interface StockMovementListResponse {
  movements: StockMovement[];
  total: number;
  page: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class StockMovementService {
  private readonly base = `${environment.apiUrl}/stock-movements`;

  constructor(private http: HttpClient) {}

  list(params: {
    search?: string;
    type?: string;
    articleId?: string;
    inventoryItem?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return this.http.get<StockMovementListResponse>(this.base, { params: cleaned as any });
  }
}
