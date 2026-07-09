import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { PaginatedResponse } from '../models/paginated-response.model';
import { User, UserFormValue } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly base = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  list(params: { search?: string; role?: string; page?: number; limit?: number } = {}) {
    return this.http.get<PaginatedResponse<User>>(this.base, { params: params as any });
  }

  getById(id: string) {
    return this.http.get<{ user: User }>(`${this.base}/${id}`);
  }

  create(payload: UserFormValue) {
    return this.http.post<{ user: User }>(this.base, payload);
  }

  update(id: string, payload: Partial<UserFormValue>) {
    return this.http.put<{ user: User }>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ message: string; id: string }>(`${this.base}/${id}`);
  }
}
