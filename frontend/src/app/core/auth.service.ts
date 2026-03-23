import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, map, of, tap } from 'rxjs';
import type {
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  UpdateProfileRequest,
  UserProfile,
  VerifyCurrentPasswordRequest,
} from './models';

const TOKEN_KEY = 'auth_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly currentUser = signal<UserProfile | null>(null);
  readonly authInitialized = signal(false);

  constructor(private readonly http: HttpClient) {}

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  login(payload: LoginRequest) {
    return this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/login`, payload).pipe(
      tap((response) => this.setSession(response))
    );
  }

  register(payload: RegisterRequest) {
    return this.http.post<AuthResponse>(`${environment.apiBaseUrl}/auth/register`, payload).pipe(
      tap((response) => this.setSession(response))
    );
  }

  fetchMe() {
    return this.http.get<{ user: UserProfile }>(`${environment.apiBaseUrl}/auth/me`).pipe(
      tap((response) => {
        this.currentUser.set(response.user);
        this.authInitialized.set(true);
      })
    );
  }

  initializeAuth() {
    if (!this.token) {
      this.currentUser.set(null);
      this.authInitialized.set(true);
      return;
    }

    this.fetchMe()
      .pipe(
        catchError(() => {
          this.logout();
          this.authInitialized.set(true);
          return of(null);
        })
      )
      .subscribe();
  }

  changePassword(payload: ChangePasswordRequest) {
    return this.http.post<{ message: string }>(`${environment.apiBaseUrl}/auth/change-password`, payload);
  }

  verifyCurrentPassword(payload: VerifyCurrentPasswordRequest) {
    return this.http.post<{ message: string }>(`${environment.apiBaseUrl}/auth/verify-password`, payload);
  }

  updateProfile(payload: UpdateProfileRequest) {
    return this.http.patch<{ user: UserProfile }>(`${environment.apiBaseUrl}/auth/me`, payload).pipe(
      tap((response) => {
        this.currentUser.set(response.user);
      })
    );
  }

  private setSession(response: AuthResponse) {
    localStorage.setItem(TOKEN_KEY, response.token);
    this.currentUser.set(response.user);
    this.authInitialized.set(true);
  }

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  logout() {
    this.clearToken();
    this.currentUser.set(null);
    this.authInitialized.set(true);
  }
}
