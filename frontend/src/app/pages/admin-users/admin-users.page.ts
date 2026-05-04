import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs/operators';
import { AdminUsersService } from '../../core/admin-users.service';
import { AuthService } from '../../core/auth.service';
import type { AdminUserSummary } from '../../core/models';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    DatePipe,
  ],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
})
export class AdminUsersPage {
  private readonly adminUsers = inject(AdminUsersService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly currentUser = this.auth.currentUser;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly transferring = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly users = signal<AdminUserSummary[]>([]);
  readonly selectedUserId = signal<string | null>(null);
  readonly roleOptions = [
    { value: 'user' as const, label: 'Felhasználó', description: 'Saját tételek és érdeklődések kezelése.' },
    { value: 'admin' as const, label: 'Admin', description: 'Felhasználókezelés és teljes rendszer-hozzáférés.' },
  ];

  readonly roleForm = this.fb.nonNullable.group({
    role: this.fb.nonNullable.control<'user' | 'admin'>('user', Validators.required),
  });

  readonly transferForm = this.fb.nonNullable.group({
    targetUserId: this.fb.nonNullable.control('', Validators.required),
  });

  readonly selectedUser = computed(
    () => this.users().find((user) => user.id === this.selectedUserId()) ?? this.users()[0] ?? null
  );
  readonly selectedUserDisplayName = computed(() => this.selectedUser()?.displayName ?? 'Nincs kiválasztva');
  readonly selectedUserOwnedPalinkaCount = computed(() => this.selectedUser()?.ownedPalinkaCount ?? 0);
  readonly selectedUserActiveInterestCount = computed(() => this.selectedUser()?.activeInterestCount ?? 0);

  readonly targetUsers = computed(() => {
    const selectedUser = this.selectedUser();
    if (!selectedUser) {
      return [];
    }

    return this.users().filter((user) => user.id !== selectedUser.id && !user.isDisabled);
  });

  readonly stats = computed(() => ({
    totalUsers: this.users().length,
    activeUsers: this.users().filter((user) => !user.isDisabled).length,
    disabledUsers: this.users().filter((user) => user.isDisabled).length,
    adminCount: this.users().filter((user) => user.role === 'admin' && !user.isDisabled).length,
    totalPalinkas: this.users().reduce((sum, user) => sum + user.ownedPalinkaCount, 0),
  }));

  constructor() {
    effect(() => {
      const selectedUser = this.selectedUser();
      if (!selectedUser) {
        return;
      }

      this.roleForm.controls.role.setValue(selectedUser.role, { emitEvent: false });

      const currentTargetId = this.transferForm.controls.targetUserId.value;
      if (currentTargetId && !this.targetUsers().some((user) => user.id === currentTargetId)) {
        this.transferForm.controls.targetUserId.setValue('', { emitEvent: false });
      }
    });

    this.loadUsers();
  }

  loadUsers(preferredUserId?: string) {
    this.error.set(null);
    this.loading.set(true);

    this.adminUsers
      .listUsers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          const nextSelectedUserId = preferredUserId ?? this.selectedUserId();
          const resolvedUserId = nextSelectedUserId && users.some((user) => user.id === nextSelectedUserId)
            ? nextSelectedUserId
            : users[0]?.id ?? null;

          this.selectedUserId.set(resolvedUserId);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Nem sikerült betölteni a felhasználólistát.');
        },
      });
  }

  selectUser(userId: string) {
    this.selectedUserId.set(userId);
    this.error.set(null);
    this.success.set(null);
  }

  roleLabel(role: 'user' | 'admin') {
    return role === 'admin' ? 'Admin' : 'Felhasználó';
  }

  statusLabel(user: AdminUserSummary) {
    if (user.isSystemAdmin) {
      return 'Rendszerfiók';
    }

    return user.isDisabled ? 'Letiltva' : 'Aktív';
  }

  isCurrentUser(user: AdminUserSummary) {
    return this.currentUser()?.id === user.id;
  }

  canManage(user: AdminUserSummary | null) {
    return !!user && !user.isSystemAdmin && !this.isCurrentUser(user);
  }

  saveRole() {
    const selectedUser = this.selectedUser();
    if (!selectedUser) {
      return;
    }

    if (!this.canManage(selectedUser)) {
      this.error.set('Ez a fiók itt nem módosítható.');
      return;
    }

    const role = this.roleForm.controls.role.value;
    if (role === selectedUser.role) {
      this.success.set('A szerepkör nem változott.');
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);
    this.adminUsers
      .updateUser(selectedUser.id, { role })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set('A szerepkör frissítve lett.');
          this.loadUsers(selectedUser.id);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Nem sikerült frissíteni a szerepkört.');
        },
      });
  }

  toggleDisabled() {
    const selectedUser = this.selectedUser();
    if (!selectedUser) {
      return;
    }

    if (!this.canManage(selectedUser)) {
      this.error.set('Ez a fiók itt nem módosítható.');
      return;
    }

    const nextDisabled = !selectedUser.isDisabled;
    const confirmed = window.confirm(
      nextDisabled
        ? `Biztosan letiltod ezt a fiókot?\n\n${selectedUser.displayName} (@${selectedUser.username})`
        : `Biztosan újra aktiválod ezt a fiókot?\n\n${selectedUser.displayName} (@${selectedUser.username})`
    );

    if (!confirmed) {
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);
    this.adminUsers
      .updateUser(selectedUser.id, { isDisabled: nextDisabled })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set(nextDisabled ? 'A fiók le lett tiltva.' : 'A fiók újra aktív.');
          this.loadUsers(selectedUser.id);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Nem sikerült frissíteni a fiók állapotát.');
        },
      });
  }

  transferOwnership() {
    const selectedUser = this.selectedUser();
    if (!selectedUser) {
      return;
    }

    if (!this.canManage(selectedUser)) {
      this.error.set('Ehhez a felhasználóhoz nem érhető el tulajdon-átruházás.');
      return;
    }

    if (selectedUser.ownedPalinkaCount === 0) {
      this.error.set('A kiválasztott felhasználónak nincs saját tétele.');
      return;
    }

    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }

    const targetUserId = this.transferForm.controls.targetUserId.value;
    const targetUser = this.targetUsers().find((user) => user.id === targetUserId);
    const confirmed = window.confirm(
      `Biztosan átadod ${selectedUser.ownedPalinkaCount} tétel tulajdonjogát ${targetUser?.displayName ?? 'a kiválasztott felhasználó'} részére?`
    );

    if (!confirmed) {
      return;
    }

    this.error.set(null);
    this.success.set(null);
    this.transferring.set(true);
    this.adminUsers
      .transferPalinkas(selectedUser.id, { targetUserId })
      .pipe(finalize(() => this.transferring.set(false)))
      .subscribe({
        next: (response) => {
          this.success.set(response.message);
          this.transferForm.controls.targetUserId.setValue('', { emitEvent: false });
          this.loadUsers(selectedUser.id);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Nem sikerült átruházni a tételeket.');
        },
      });
  }
}