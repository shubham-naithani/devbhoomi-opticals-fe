import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AuditLogEntry } from '../models/audit-log.model';

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private readonly base = `${environment.apiUrl}/audit-logs`;

  constructor(private http: HttpClient) {}

  list(params: { entityType?: string; page?: number; limit?: number } = {}) {
    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    );
    return this.http.get<{ logs: AuditLogEntry[]; total: number; page: number; pages: number }>(this.base, {
      params: cleaned as any,
    });
  }
}
