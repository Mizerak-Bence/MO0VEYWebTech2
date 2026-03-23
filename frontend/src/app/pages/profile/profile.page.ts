import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    DatePipe,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage {
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly user = this.auth.currentUser;
  readonly loading = signal(false);
  readonly profileSaving = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly roleLabel = computed(() => (this.user()?.role === 'admin' ? 'Admin' : 'Felhasználó'));
  readonly isSystemAdmin = computed(() => !!this.user()?.isSystemAdmin);
  readonly verifyingPassword = signal(false);
  readonly currentPasswordVerified = signal(false);
  readonly passwordVerificationMessage = signal<string | null>(null);
  readonly verifiedPasswordValue = signal<string | null>(null);
  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly profileForm = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
  });

  readonly form = this.fb.group({
    currentPassword: ['', [Validators.required, Validators.minLength(1)]],
    newPassword: [{ value: '', disabled: true }, [Validators.required, Validators.minLength(6), Validators.maxLength(200)]],
    confirmNewPassword: [{ value: '', disabled: true }, [Validators.required]],
  });

  constructor() {
    effect(() => {
      const currentUser = this.user();
      if (currentUser) {
        this.profileForm.patchValue(
          {
            displayName: currentUser.displayName,
          },
          { emitEvent: false }
        );
      }
    });

    this.form.controls.currentPassword.valueChanges.subscribe((value) => {
      const normalized = value?.trim() ?? '';
      if (normalized !== (this.verifiedPasswordValue() ?? '')) {
        this.lockPasswordCreation(true);
        this.passwordVerificationMessage.set(normalized ? null : 'Add meg a jelenlegi jelszót az ellenőrzéshez.');
      }
    });
  }

  private lockPasswordCreation(clearValues: boolean) {
    this.currentPasswordVerified.set(false);
    this.verifiedPasswordValue.set(null);
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);

    if (clearValues) {
      this.form.controls.newPassword.reset('');
      this.form.controls.confirmNewPassword.reset('');
    }

    this.form.controls.newPassword.disable({ emitEvent: false });
    this.form.controls.confirmNewPassword.disable({ emitEvent: false });
  }

  private unlockPasswordCreation(currentPassword: string) {
    this.currentPasswordVerified.set(true);
    this.verifiedPasswordValue.set(currentPassword);
    this.form.controls.newPassword.enable({ emitEvent: false });
    this.form.controls.confirmNewPassword.enable({ emitEvent: false });
  }

  submitProfile() {
    this.error.set(null);
    this.success.set(null);

    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const { displayName } = this.profileForm.getRawValue();
    this.profileSaving.set(true);
    this.auth.updateProfile({ displayName: displayName! }).subscribe({
      next: () => {
        this.success.set('A profil frissítve lett.');
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Nem sikerült frissíteni a profilt.');
        this.profileSaving.set(false);
      },
      complete: () => {
        this.profileSaving.set(false);
      },
    });
  }

  toggleCurrentPassword() {
    this.showCurrentPassword.update((value) => !value);
  }

  toggleNewPassword() {
    if (!this.currentPasswordVerified()) {
      this.passwordVerificationMessage.set('Előbb ellenőrizd a jelenlegi jelszót.');
      return;
    }

    this.showNewPassword.update((value) => !value);
  }

  toggleConfirmPassword() {
    if (!this.currentPasswordVerified()) {
      this.passwordVerificationMessage.set('Előbb ellenőrizd a jelenlegi jelszót.');
      return;
    }

    this.showConfirmPassword.update((value) => !value);
  }

  verifyCurrentPassword() {
    this.error.set(null);
    this.success.set(null);
    this.passwordVerificationMessage.set(null);

    const currentPassword = this.form.controls.currentPassword.value?.trim() ?? '';
    if (!currentPassword) {
      this.form.controls.currentPassword.markAsTouched();
      this.passwordVerificationMessage.set('Add meg a jelenlegi jelszót az ellenőrzéshez.');
      return;
    }

    this.verifyingPassword.set(true);
    this.auth.verifyCurrentPassword({ currentPassword }).subscribe({
      next: (response) => {
        this.unlockPasswordCreation(currentPassword);
        this.passwordVerificationMessage.set(response.message);
      },
      error: (err) => {
        this.lockPasswordCreation(true);
        this.passwordVerificationMessage.set(err?.error?.message ?? 'A jelenlegi jelszó ellenőrzése sikertelen.');
        this.verifyingPassword.set(false);
      },
      complete: () => {
        this.verifyingPassword.set(false);
      },
    });
  }

  submitPasswordChange() {
    this.error.set(null);
    this.success.set(null);
    this.passwordVerificationMessage.set(null);

    if (!this.currentPasswordVerified()) {
      this.error.set('Előbb ellenőrizd a jelenlegi jelszót.');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmNewPassword } = this.form.getRawValue();
    if (newPassword !== confirmNewPassword) {
      this.error.set('Az új jelszavak nem egyeznek.');
      return;
    }

    this.loading.set(true);
    this.auth.changePassword({ currentPassword: currentPassword!, newPassword: newPassword! }).subscribe({
      next: (response) => {
        this.success.set(response.message);
        this.form.reset();
        this.lockPasswordCreation(false);
        this.passwordVerificationMessage.set('Add meg a jelenlegi jelszót az ellenőrzéshez.');
        this.showCurrentPassword.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Nem sikerült módosítani a jelszót.');
        this.loading.set(false);
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }
}
