import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../api-base-url.token';
import { Article, ArticleFormValue, InventoryItem, ProductFormValue } from '../models/inventory.model';

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private http: HttpClient, @Inject(API_BASE_URL) private apiBaseUrl: string) {}

  private get base() { return `${this.apiBaseUrl}/inventory`; }

  list(params: {
    search?: string;
    category?: string;
    gender?: string;
    frameShape?: string;
    brand?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return this.http.get<PaginatedResponse<InventoryItem>>(this.base, { params: cleaned as any });
  }

  getById(id: string) {
    return this.http.get<{ item: InventoryItem }>(`${this.base}/${id}`);
  }

  brands() {
    return this.http.get<{ brands: string[] }>(`${this.base}/brands`);
  }

  brandDefaults(brand: string) {
    return this.http.get<{ defaults: { category?: string; frameType?: string; gender?: string } | null }>(
      `${this.base}/brands/${encodeURIComponent(brand)}/defaults`
    );
  }

  addBrand(name: string) {
    return this.http.post<{ brand: { _id: string; name: string } }>(`${this.base}/brands`, { name });
  }

  lookupByBarcode(barcode: string) {
    return this.http.get<{ item: InventoryItem; article: Article }>(`${this.base}/barcode/${barcode}`);
  }

  uploadImages(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));
    return this.http.post<{ urls: string[] }>(`${this.base}/upload-images`, formData);
  }

  createProduct(payload: Partial<ProductFormValue> & { article: Partial<ArticleFormValue> }) {
    return this.http.post<{ item: InventoryItem }>(this.base, payload);
  }

  updateProduct(id: string, payload: Partial<ProductFormValue>) {
    return this.http.put<{ item: InventoryItem }>(`${this.base}/${id}`, payload);
  }

  deleteProduct(id: string) {
    return this.http.delete<{ message: string; id: string }>(`${this.base}/${id}`);
  }

  addArticle(productId: string, payload: Partial<ArticleFormValue>) {
    return this.http.post<{ item: InventoryItem }>(`${this.base}/${productId}/articles`, payload);
  }

  updateArticle(productId: string, articleId: string, payload: Partial<ArticleFormValue>) {
    return this.http.put<{ item: InventoryItem }>(`${this.base}/${productId}/articles/${articleId}`, payload);
  }

  deleteArticle(productId: string, articleId: string) {
    return this.http.delete<{ item: InventoryItem }>(`${this.base}/${productId}/articles/${articleId}`);
  }

  bulkUpdateStatus(ids: string[], isActive: boolean) {
    return this.http.put<{ message: string; updatedCount: number }>(`${this.base}/bulk/status`, { ids, isActive });
  }

  bulkDelete(ids: string[]) {
    return this.http.delete<{ message: string; deletedCount: number }>(`${this.base}/bulk`, { body: { ids } });
  }
}
