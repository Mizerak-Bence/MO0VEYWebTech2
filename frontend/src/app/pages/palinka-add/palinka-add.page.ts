import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { PalinkaService } from '../../core/palinka.service';

@Component({
  selector: 'app-palinka-add-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './palinka-add.page.html',
  styleUrl: './palinka-add.page.scss',
})
export class PalinkaAddPage {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PalinkaService);
  private readonly router = inject(Router);

  error: string | null = null;
  loading = false;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    fruitType: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    abvPercent: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
    volumeLiters: [null as number | null, [Validators.required, Validators.min(0)]],
    distillationStyle: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    madeDate: [null as Date | null],
    notes: ['', [Validators.maxLength(500)]],
  });

  submit() {
    this.error = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.loading = true;
    this.service
      .create({
        name: value.name!,
        fruitType: value.fruitType!,
        abvPercent: Number(value.abvPercent),
        volumeLiters: Number(value.volumeLiters),
        distillationStyle: value.distillationStyle!,
        madeDate: value.madeDate ? value.madeDate.toISOString() : undefined,
        notes: value.notes?.trim() ? value.notes.trim() : undefined,
      })
      .subscribe({
        next: () => {
          this.router.navigateByUrl('/palinkas');
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message ?? 'Nem sikerült létrehozni a tételt.';
        },
        complete: () => {
          this.loading = false;
        },
      });
  }
}
