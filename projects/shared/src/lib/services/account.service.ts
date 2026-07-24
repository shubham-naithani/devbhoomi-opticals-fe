import { HttpClient } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '../api-base-url.token';
import { Address, User } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AccountService {
  constructor(private http: HttpClient, @Inject(API_BASE_URL) private apiBaseUrl: string) {}

  getMe() {
    return this.http.get<{ user: User }>(`${this.apiBaseUrl}/users/me`);
  }

  updateProfile(data: { name?: string; phone?: string }) {
    return this.http.put<{ user: User }>(`${this.apiBaseUrl}/users/me`, data);
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<{ message: string }>(`${this.apiBaseUrl}/users/me/password`, {
      currentPassword,
      newPassword,
    });
  }

  listAddresses() {
    return this.http.get<{ addresses: Address[] }>(`${this.apiBaseUrl}/users/me/addresses`);
  }

  addAddress(data: Omit<Address, '_id'>) {
    return this.http.post<{ addresses: Address[] }>(`${this.apiBaseUrl}/users/me/addresses`, data);
  }

  updateAddress(id: string, data: Partial<Omit<Address, '_id'>>) {
    return this.http.put<{ addresses: Address[] }>(`${this.apiBaseUrl}/users/me/addresses/${id}`, data);
  }

  deleteAddress(id: string) {
    return this.http.delete<{ addresses: Address[] }>(`${this.apiBaseUrl}/users/me/addresses/${id}`);
  }
}
