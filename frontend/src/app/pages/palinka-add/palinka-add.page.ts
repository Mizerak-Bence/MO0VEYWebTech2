import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';

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
    MatSelectModule,
  ],
  templateUrl: './palinka-add.page.html',
  styleUrl: './palinka-add.page.scss',
})
export class PalinkaAddPage {
  readonly defaultDistillationOption = 'Kétlépcsős lepárlás';
  readonly distillationOptions = [
    'Kétlépcsős lepárlás',
    'Egylépcsős (Oszlopos) lepárlás',
    'Egyéni',
  ];
  readonly customDistillationOption = 'Egyéni';

  private readonly fb = inject(FormBuilder);
  private readonly service = inject(PalinkaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly initialLoading = signal(false);
  readonly palinkaId = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = computed(() => !!this.palinkaId);
  readonly pageTitle = computed(() => (this.isEditMode() ? 'Pálinka szerkesztése' : 'Új pálinka tétel'));
  readonly submitLabel = computed(() => (this.isEditMode() ? 'Mentés' : 'Létrehozás'));

  readonly form = this.fb.group({
    fruitType: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    abvPercent: [null as number | null, [Validators.min(0), Validators.max(100)]],
    volumeLiters: [null as number | null, [Validators.required, Validators.min(0)]],
    volumeMinLiters: [null as number | null, [Validators.min(0)]],
    volumeMaxLiters: [null as number | null, [Validators.min(0)]],
    containerCapacityLiters: [null as number | null, [Validators.min(0)]],
    distillationPreset: [this.defaultDistillationOption, [Validators.required]],
    distillationCustom: ['', [Validators.maxLength(60)]],
    madeDate: [null as Date | null],
    notes: ['', [Validators.maxLength(500)]],
  });

  constructor() {
    if (this.palinkaId) {
      this.initialLoading.set(true);
      this.service
        .getById(this.palinkaId)
        .pipe(
          finalize(() => {
            this.initialLoading.set(false);
          })
        )
        .subscribe({
          next: (palinka) => {
            const preset = this.distillationOptions.includes(palinka.distillationStyle)
              ? palinka.distillationStyle
              : this.customDistillationOption;

            this.form.patchValue({
              fruitType: palinka.fruitType,
              abvPercent: palinka.abvPercent,
              volumeLiters: palinka.volumeLiters,
              volumeMinLiters: palinka.volumeMinLiters ?? null,
              volumeMaxLiters: palinka.volumeMaxLiters ?? null,
              containerCapacityLiters: palinka.containerCapacityLiters ?? null,
              distillationPreset: preset,
              distillationCustom: preset === this.customDistillationOption ? palinka.distillationStyle : '',
              madeDate: palinka.madeDate ? new Date(palinka.madeDate) : null,
              notes: palinka.notes ?? '',
            });
          },
          error: (err) => {
            this.error.set(err?.error?.message ?? 'Nem sikerült betölteni a tételt.');
          },
        });
    }
  }

  isCustomDistillationSelected() {
    return this.form.controls.distillationPreset.value === this.customDistillationOption;
  }

  private getDistillationStyle() {
    const preset = this.form.controls.distillationPreset.value?.trim() ?? '';
    const custom = this.form.controls.distillationCustom.value?.trim() ?? '';

    if (preset === this.customDistillationOption) {
      return custom;
    }

    return preset;
  }

  private buildPayload() {
    const value = this.form.getRawValue();

    return {
      fruitType: value.fruitType!,
      abvPercent: value.abvPercent == null ? undefined : Number(value.abvPercent),
      volumeLiters: Number(value.volumeLiters),
      volumeMinLiters: value.volumeMinLiters == null ? undefined : Number(value.volumeMinLiters),
      volumeMaxLiters: value.volumeMaxLiters == null ? undefined : Number(value.volumeMaxLiters),
      containerCapacityLiters:
        value.containerCapacityLiters == null ? undefined : Number(value.containerCapacityLiters),
      distillationStyle: this.getDistillationStyle(),
      madeDate: value.madeDate ? value.madeDate.toISOString() : undefined,
      notes: value.notes?.trim() ? value.notes.trim() : undefined,
    };
  }

  submit() {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.getDistillationStyle()) {
      this.form.markAllAsTouched();
      this.form.controls.distillationCustom.markAsTouched();
      this.error.set('Az egyéni főzéshez adj meg saját típust.');
      return;
    }

    this.loading.set(true);
    const request = this.isEditMode() && this.palinkaId
      ? this.service.update(this.palinkaId, this.buildPayload())
      : this.service.create(this.buildPayload());

    request.subscribe({
      next: () => {
        this.router.navigateByUrl('/palinkas');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Nem sikerült létrehozni a tételt.');
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }
}
