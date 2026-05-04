import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
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