import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ErrorLogService {
  private readonly base = `${environment.apiUrl}/error-logs`;

  constructor(private http: HttpClient) {}

  report(message: string, stack?: string): void {
    this.http.post(`${this.base}/frontend`, { message, stack, url: window.location.href }).subscribe({
      error: () => {}, // never let error-reporting itself throw a new error
    });
  }

  list(params: { source?: string; severity?: string; search?: string; from?: string; to?: string; page?: number; limit?: number } = {}) {
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
    return this.http.get<any>(this.base, { params: cleaned as any });
  }
}
