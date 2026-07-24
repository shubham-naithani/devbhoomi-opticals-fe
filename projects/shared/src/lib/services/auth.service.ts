import { HttpClient } from '@angular/common/http';
import { Inject, Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../api-base-url.token'; // ← replaces environment import
import { User } from '../models/user.model';
import { CartService } from './cart.service';

const TOKEN_KEY = 'devbhoomi_token';
const USER_KEY = 'devbhoomi_user';

interface AuthResponse {
  user: User;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserSignal = signal<User | null>(this.readStoredUser());

  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isLoggedIn = computed(() => !!this.currentUserSignal());
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'admin');
  readonly isStaff = computed(() => this.currentUserSignal()?.role === 'staff');
  readonly isStaffOrAdmin = computed(() => this.isAdmin() || this.isStaff());

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(API_BASE_URL) private apiBaseUrl: string,
    private cart: CartService
  ) {}

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/login`, { email, password }).pipe(
      tap((res) => this.setSession(res))
    );
  }

  register(name: string, email: string, password: string, phone?: string) {
    return this.http.post<AuthResponse>(`${this.apiBaseUrl}/auth/register`, { name, email, password, phone }).pipe(
      tap((res) => this.setSession(res))
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUserSignal.set(null);
    this.cart.switchToGuest();
    this.router.navigate(['/']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private setSession(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.currentUserSignal.set(res.user);
    this.cart.switchToUser(res.user._id);
  }

  private readStoredUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as User;
    } catch {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
  }
}
