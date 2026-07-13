import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CreateEyeTestPayload, EyeTest } from '../models/eye-test.model';

@Injectable({ providedIn: 'root' })
export class EyeTestService {
  private readonly base = `${environment.apiUrl}/eye-tests`;

  constructor(private http: HttpClient) {}

  create(payload: CreateEyeTestPayload) {
    return this.http.post<{ eyeTest: EyeTest }>(this.base, payload);
  }

  historyFor(customerId: string) {
    return this.http.get<{ eyeTests: EyeTest[] }>(`${this.base}/customer/${customerId}`);
  }

  latestFor(customerId: string) {
    return this.http.get<{ eyeTest: EyeTest | null }>(`${this.base}/customer/${customerId}/latest`);
  }
}
