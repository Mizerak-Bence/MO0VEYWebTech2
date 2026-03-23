import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';

import { PalinkaService } from '../../core/palinka.service';
import type { Palinka } from '../../core/models';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';
import { ChatService } from '../../core/chat.service';

@Component({
  selector: 'app-palinka-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatToolbarModule,
    MatChipsModule,
    DatePipe,
  ],
  templateUrl: './palinka-list.page.html',
  styleUrl: './palinka-list.page.scss',
})
export class PalinkaListPage {
  private readonly service = inject(PalinkaService);
  private readonly auth = inject(AuthService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<Palinka[]>([]);
  readonly search = signal('');
  readonly viewMode = signal<'prioritized' | 'own'>('prioritized');
  readonly currentUser = this.auth.currentUser;

  readonly displayedColumns = [
    'fruitType',
    'owner',
    'containerCapacityLiters',
    'abvPercent',
    'volumeLiters',
    'distillationStyle',
    'reservation',
    'madeDate',
    'actions',
  ];

  readonly filteredItems = computed(() => {
    const baseItems = this.viewMode() === 'own'
      ? this.items().filter((item) => item.isOwnedByCurrentUser)
      : this.items();

    const query = this.search().trim().toLowerCase();
    if (!query) {
      return baseItems;
    }

    return baseItems.filter((item) => {
      const haystack = [
        item.fruitType,
        item.distillationStyle,
        item.owner?.displayName ?? '',
        item.owner?.username ?? '',
        item.notes ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  readonly totalVolume = computed(() =>
    this.filteredItems().reduce((sum, item) => sum + item.volumeLiters, 0)
  );

  readonly averageAbv = computed(() => {
    const withAbv = this.filteredItems().filter((item) => item.abvPercent != null);
    if (withAbv.length === 0) return null;

    const total = withAbv.reduce((sum, item) => sum + (item.abvPercent ?? 0), 0);
    return total / withAbv.length;
  });

  readonly uniqueFruits = computed(() => new Set(this.filteredItems().map((item) => item.fruitType)).size);

  constructor() {
    this.load();
  }

  setSearch(value: string) {
    this.search.set(value);
  }

  setViewMode(mode: 'prioritized' | 'own') {
    this.viewMode.set(mode);
  }

  formatVolume(value: number | null | undefined) {
    if (value == null) return '-';
    return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 2 }).format(value);
  }

  formatAbv(value: number | null) {
    return value == null ? '-' : `${this.formatVolume(value)}%`;
  }

  logout() {
    this.auth.logout();
    this.router.navigateByUrl('/login');
  }

  edit(item: Palinka) {
    if (!item.canManage) {
      return;
    }

    this.router.navigateByUrl(`/palinkas/${item.id}/edit`);
  }

  delete(item: Palinka) {
    if (!item.canManage) {
      return;
    }

    const confirmed = window.confirm(`Biztosan törlöd ezt a tételt?\n\n${this.describeItem(item)}`);
    if (!confirmed) {
      return;
    }

    this.service.delete(item.id).subscribe({
      next: () => {
        this.items.update((current) => current.filter((currentItem) => currentItem.id !== item.id));
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Nem sikerült törölni a tételt.');
      },
    });
  }

  openReservation(item: Palinka) {
    this.error.set(null);
    this.chat.reservePalinka(item.id).subscribe({
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Nem sikerült megnyitni a foglalási beszélgetést.');
      },
      complete: () => {
        this.load();
      },
    });
  }

  canReserve(item: Palinka) {
    return !item.isOwnedByCurrentUser && this.currentUser()?.role !== 'admin';
  }

  ownerLabel(item: Palinka) {
    if (item.isOwnedByCurrentUser) {
      return 'Saját tétel';
    }

    return item.owner?.displayName ?? item.owner?.username ?? 'Ismeretlen';
  }

  reservationLabel(item: Palinka) {
    const count = item.interestCount ?? 0;
    if (item.currentUserHasConversation) {
      return 'Beszélgetés megnyitva';
    }
    if (count === 0) {
      return 'Nincs még érdeklődő';
    }
    return `${count} érdeklődő`;
  }

  describeItem(item: Palinka) {
    return `${item.fruitType} · ${this.formatVolume(item.volumeLiters)} L · ${item.distillationStyle}`;
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.service
      .list()
      .pipe(
        finalize(() => {
          this.loading.set(false);
        })
      )
      .subscribe({
        next: (items) => {
          this.items.set(items);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Nem sikerült betölteni a listát.');
        },
      });
  }
}
