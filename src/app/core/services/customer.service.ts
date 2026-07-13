import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

export interface QuickCreateCustomerPayload {
  name: string;
  phone: string;
  email?: string;
  address?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly base = `${environment.apiUrl}/customers`;

  constructor(private http: HttpClient) {}

  searchByPhone(phone: string) {
    return this.http.get<{ customers: User[] }>(`${this.base}/search`, { params: { phone } });
  }

  quickCreate(payload: QuickCreateCustomerPayload) {
    return this.http.post<{ customer: User }>(`${this.base}/quick-create`, payload);
  }
}
