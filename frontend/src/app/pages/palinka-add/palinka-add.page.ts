import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { startWith } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';

import { AuthService } from '../../core/auth.service';
import { PalinkaService } from '../../core/palinka.service';
import { type Palinka, type PalinkaHistoryEntry, type PalinkaStatus } from '../../core/models';

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
    MatIconModule,
    MatSelectModule,
    MatToolbarModule,
  ],
  templateUrl: './palinka-add.page.html',
  styleUrl: './palinka-add.page.scss',
})
export class PalinkaAddPage {
  readonly statusOptions: Array<{ value: PalinkaStatus; label: string; hint: string }> = [
    { value: 'active', label: 'Aktív', hint: 'Szabadon elérhető, új érdeklődést fogadhat.' },
    { value: 'reserved', label: 'Lefoglalva', hint: 'Már félretett tétel, új érdeklődés nem indítható.' },
    { value: 'partial', label: 'Részben kiadva', hint: 'Még van belőle, ezért további érdeklődés fogadható.' },
    { value: 'exhausted', label: 'Elfogyott', hint: 'Készlethiányos, ezért nem fogad új érdeklődést.' },
    { value: 'archived', label: 'Archivált', hint: 'Történeti vagy lezárt tétel, csak nyilvántartási célra marad.' },
  ];
  readonly defaultDistillationOption = 'Kétlépcsős lepárlás';
  readonly distillationOptions = [
    'Kétlépcsős lepárlás',
    'Egylépcsős (Oszlopos) lepárlás',
    'Egyéni',
  ];
  readonly customDistillationOption = 'Egyéni';

  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly service = inject(PalinkaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly currentUser = this.auth.currentUser;
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly initialLoading = signal(false);
  readonly currentPalinka = signal<Palinka | null>(null);
  readonly palinkaId = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = computed(() => !!this.palinkaId);
  readonly pageTitle = computed(() => (this.isEditMode() ? 'Pálinka szerkesztése' : 'Új pálinka tétel'));
  readonly submitLabel = computed(() => (this.isEditMode() ? 'Mentés' : 'Létrehozás'));
  readonly historyEntries = computed<PalinkaHistoryEntry[]>(() => this.currentPalinka()?.history ?? []);
  readonly historyCount = computed(() => this.historyEntries().length);
  readonly heroKicker = computed(() => (this.isEditMode() ? 'Tétel szerkesztése' : 'Új tétel rögzítése'));
  readonly pageDescription = computed(() =>
    this.isEditMode()
      ? 'A tétel állapota, mennyisége és megjegyzései egy helyen szerkeszthetők, az audit trail pedig közvetlenül alatta követhető.'
      : 'Új pálinkatétel felvitele ugyanabban a belső rendszerben, mint a lista- és profiloldalak: tisztább shell, jobb fókusz és gyors állapotkezelés.'
  );

  readonly form = this.fb.group({
    fruitType: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    abvPercent: [null as number | null, [Validators.min(0), Validators.max(100)]],
    volumeLiters: [null as number | null, [Validators.required, Validators.min(0)]],
    containerCapacityLiters: [null as number | null, [Validators.min(0)]],
    status: ['active' as PalinkaStatus, [Validators.required]],
    distillationPreset: [this.defaultDistillationOption, [Validators.required]],
    distillationCustom: ['', [Validators.maxLength(60)]],
    madeDate: [null as Date | null],
    notes: ['', [Validators.maxLength(500)]],
  });
  readonly statusValue = toSignal(this.form.controls.status.valueChanges.pipe(startWith(this.form.controls.status.value)), {
    initialValue: this.form.controls.status.value,
  });
  readonly selectedStatusOption = computed(
    () => this.statusOptions.find((option) => option.value === this.statusValue()) ?? this.statusOptions[0]
  );
  readonly selectedStatusLabel = computed(() => this.selectedStatusOption().label);
  readonly selectedStatusHint = computed(() => this.selectedStatusOption().hint);

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
            this.currentPalinka.set(palinka);
            const preset = this.distillationOptions.includes(palinka.distillationStyle)
              ? palinka.distillationStyle
              : this.customDistillationOption;

            this.form.patchValue({
              fruitType: palinka.fruitType,
              abvPercent: palinka.abvPercent,
              volumeLiters: palinka.volumeLiters,
              containerCapacityLiters: palinka.containerCapacityLiters ?? null,
              status: palinka.status,
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
      containerCapacityLiters:
        value.containerCapacityLiters == null ? undefined : Number(value.containerCapacityLiters),
      status: value.status!,
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
        this.error.set(err?.error?.message ?? (this.isEditMode() ? 'Nem sikerült menteni a tételt.' : 'Nem sikerült létrehozni a tételt.'));
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
