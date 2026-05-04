import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  AdminOwnedPalinkaSummary,
  AdminUserSummary,
  TransferPalinkaOwnershipRequest,
  TransferPalinkaOwnershipResponse,
  UpdateAdminUserRequest,
} from './models';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  constructor(private readonly http: HttpClient) {}

  listUsers() {
    return this.http
      .get<{ users: AdminUserSummary[] }>(`${environment.apiBaseUrl}/admin/users`)
      .pipe(map((response) => response.users));
  }

  listOwnedPalinkas(userId: string) {
    return this.http
      .get<{ palinkas: AdminOwnedPalinkaSummary[] }>(`${environment.apiBaseUrl}/admin/users/${userId}/palinkas`)
      .pipe(map((response) => response.palinkas));
  }

  updateUser(userId: string, payload: UpdateAdminUserRequest) {
    return this.http
      .patch<{ user: AdminUserSummary }>(`${environment.apiBaseUrl}/admin/users/${userId}`, payload)
      .pipe(map((response) => response.user));
  }

  transferPalinkas(userId: string, payload: TransferPalinkaOwnershipRequest) {
    return this.http.post<TransferPalinkaOwnershipResponse>(
      `${environment.apiBaseUrl}/admin/users/${userId}/transfer-palinkas`,
      payload
    );
  }
}