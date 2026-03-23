import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
})
export class RegisterPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    displayName: ['', [Validators.minLength(2), Validators.maxLength(80)]],
    password: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(200)]],
    confirmPassword: ['', [Validators.required]],
  });

  submit() {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { username, displayName, password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.error.set('A két jelszó nem egyezik.');
      return;
    }

    this.loading.set(true);
    this.auth
      .register({
        username: username!,
        displayName: displayName?.trim() ? displayName.trim() : undefined,
        password: password!,
      })
      .subscribe({
        next: () => {
          this.router.navigateByUrl('/palinkas');
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'Sikertelen regisztráció.');
        },
        complete: () => {
          this.loading.set(false);
        },
      });
  }
}
