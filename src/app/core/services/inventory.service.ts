import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { InventoryFormValue, InventoryItem } from '../models/inventory.model';
import { PaginatedResponse } from '../models/paginated-response.model';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly base = `${environment.apiUrl}/inventory`;

  constructor(private http: HttpClient) {}

  list(params: { search?: string; category?: string; gender?: string; frameShape?: string; page?: number; limit?: number } = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    );
    return this.http.get<PaginatedResponse<InventoryItem>>(this.base, { params: cleaned as any });
  }

  uploadImages(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return this.http.post<{ urls: string[] }>(`${this.base}/upload-images`, formData);
  }

  getById(id: string) {
    return this.http.get<{ item: InventoryItem }>(`${this.base}/${id}`);
  }

  create(payload: Partial<InventoryFormValue>) {
    return this.http.post<{ item: InventoryItem }>(this.base, payload);
  }

  update(id: string, payload: Partial<InventoryFormValue>) {
    return this.http.put<{ item: InventoryItem }>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string; id: string }>(`${this.base}/${id}`);
  }
}
