import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import {
  CHAT_INTEREST_STATUS_DESCRIPTIONS,
  CHAT_INTEREST_STATUS_LABELS,
  isClosedChatInterestStatus,
  type ChatInterestStatus,
  type PalinkaManageableState,
  type Palinka,
  type PalinkaStatus,
  type UpdatePalinkaRequest,
} from '../../core/models';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';
import { ChatService } from '../../core/chat.service';

type DashboardTimelinePoint = {
  key: string;
  dayLabel: string;
  dateLabel: string;
  inventory: number;
  interests: number;
  closures: number;
  inventoryHeight: number;
  interestsHeight: number;
  closuresHeight: number;
};

@Component({
  selector: 'app-palinka-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
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
  private readonly interestHighlightWindowMs = 48 * 60 * 60 * 1000;
  private pollHandle: ReturnType<typeof setInterval> | null = null;
  private readonly weekdayFormatter = new Intl.DateTimeFormat('hu-HU', { weekday: 'short' });
  private readonly shortDateFormatter = new Intl.DateTimeFormat('hu-HU', { month: '2-digit', day: '2-digit' });
  private readonly statusLabels: Record<PalinkaStatus, string> = {
    active: 'Aktív',
    reserved: 'Lefoglalva',
    partial: 'Részben kiadva',
    exhausted: 'Elfogyott',
    archived: 'Archivált',
  };

  private readonly statusDescriptions: Record<PalinkaStatus, string> = {
    active: 'Fogad új érdeklődést.',
    reserved: 'Új érdeklődés nem indítható.',
    partial: 'Még elérhető maradék készlet.',
    exhausted: 'Készlethiány miatt zárt.',
    archived: 'Csak nyilvántartási céllal marad meg.',
  };
  readonly ownerStateOptions: Array<{ value: PalinkaManageableState; label: string }> = [
    { value: 'active', label: 'Aktív' },
    { value: 'reserved', label: 'Lefoglalva' },
    { value: 'partial', label: 'Részben kiadva' },
    { value: 'exhausted', label: 'Elfogyott' },
    { value: 'archived', label: 'Archivált' },
    { value: 'closed', label: 'Lezárva' },
  ];

  private readonly service = inject(PalinkaService);
  private readonly auth = inject(AuthService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly items = signal<Palinka[]>([]);
  readonly updatingStateItemId = signal<string | null>(null);
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
    'status',
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
  readonly dashboardSeries = computed<DashboardTimelinePoint[]>(() => {
    const points = this.createTimelineWindow();
    const pointByKey = new Map(points.map((point) => [point.key, point]));

    for (const item of this.filteredItems()) {
      const inventoryKey = this.getLocalDateKey(item.createdAt);
      if (inventoryKey) {
        const point = pointByKey.get(inventoryKey);
        if (point) {
          point.inventory += 1;
        }
      }

      for (const interest of item.interestEntries ?? []) {
        const interestKey = this.getLocalDateKey(interest.latestMessageAt);
        if (!interestKey) {
          continue;
        }

        const point = pointByKey.get(interestKey);
        if (!point) {
          continue;
        }

        point.interests += 1;
        if (isClosedChatInterestStatus(interest.status)) {
          point.closures += 1;
        }
      }
    }

    const maxValue = Math.max(
      1,
      ...points.flatMap((point) => [point.inventory, point.interests, point.closures])
    );

    return points.map((point) => ({
      ...point,
      inventoryHeight: this.getBarHeight(point.inventory, maxValue),
      interestsHeight: this.getBarHeight(point.interests, maxValue),
      closuresHeight: this.getBarHeight(point.closures, maxValue),
    }));
  });
  readonly dashboardTotals = computed(() => {
    const series = this.dashboardSeries();

    return {
      inventory: series.reduce((sum, point) => sum + point.inventory, 0),
      interests: series.reduce((sum, point) => sum + point.interests, 0),
      closures: series.reduce((sum, point) => sum + point.closures, 0),
      activeInterests: this.filteredItems().reduce(
        (sum, item) => sum + (item.interestEntries?.filter((interest) => !isClosedChatInterestStatus(interest.status)).length ?? 0),
        0
      ),
    };
  });
  readonly hasDashboardActivity = computed(() => {
    const totals = this.dashboardTotals();
    return totals.inventory > 0 || totals.interests > 0 || totals.closures > 0;
  });

  constructor() {
    this.load();
    this.startPolling();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  private createTimelineWindow() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_value, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));

      return {
        key: this.formatLocalDateKey(date),
        dayLabel: this.weekdayFormatter.format(date).replace('.', '').toUpperCase(),
        dateLabel: this.shortDateFormatter.format(date),
        inventory: 0,
        interests: 0,
        closures: 0,
        inventoryHeight: 0,
        interestsHeight: 0,
        closuresHeight: 0,
      };
    });
  }

  private getBarHeight(value: number, maxValue: number) {
    if (value <= 0) {
      return 0;
    }

    return Math.max(14, Math.round((value / maxValue) * 100));
  }

  private getLocalDateKey(value: string | Date | null | undefined) {
    if (!value) {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    date.setHours(0, 0, 0, 0);
    return this.formatLocalDateKey(date);
  }

  private formatLocalDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    return !item.isOwnedByCurrentUser && this.currentUser()?.role !== 'admin' && (item.currentUserHasConversation || this.canStartInterest(item));
  }

  canStartInterest(item: Palinka) {
    return !item.workflowClosedAt && (item.status === 'active' || item.status === 'partial');
  }

  statusLabel(item: Palinka) {
    if (item.workflowClosedAt) {
      return 'Lezárva';
    }

    return this.statusLabels[item.status];
  }

  statusDescription(item: Palinka) {
    if (item.workflowClosedAt) {
      return 'A tulajdonos lezárta a tételt. 7 napig még látható, utána eltűnik a listából.';
    }

    if (this.hasFreshInterest(item)) {
      return 'Van friss érdeklődés a tételre. Ha 48 órán belül nincs lezárás, automatikusan visszaáll zöld aktívra.';
    }

    return this.statusDescriptions[item.status];
  }

  statusClass(item: Palinka) {
    if (item.workflowClosedAt) {
      return 'status-pill status-pill-exhausted';
    }

    if (this.hasFreshInterest(item)) {
      return 'status-pill status-pill-reserved';
    }

    return `status-pill status-pill-${item.status}`;
  }

  showFreshInterestInfo(item: Palinka) {
    return !item.workflowClosedAt && this.hasFreshInterest(item);
  }

  statusInlineDescription(item: Palinka) {
    return this.showFreshInterestInfo(item) ? null : this.statusDescription(item);
  }

  canAdjustState(item: Palinka) {
    return !!item.isOwnedByCurrentUser;
  }

  ownerStateValue(item: Palinka): PalinkaManageableState {
    return item.workflowClosedAt ? 'closed' : item.status;
  }

  isUpdatingState(itemId: string) {
    return this.updatingStateItemId() === itemId;
  }

  private buildUpdatePayloadFromItem(item: Palinka, status: PalinkaStatus): UpdatePalinkaRequest {
    return {
      fruitType: item.fruitType,
      abvPercent: item.abvPercent ?? undefined,
      volumeLiters: item.volumeLiters,
      volumeMinLiters: item.volumeMinLiters ?? undefined,
      volumeMaxLiters: item.volumeMaxLiters ?? undefined,
      containerCapacityLiters: item.containerCapacityLiters ?? undefined,
      status,
      distillationStyle: item.distillationStyle,
      madeDate: item.madeDate ? new Date(item.madeDate).toISOString() : undefined,
      notes: item.notes ?? undefined,
    };
  }

  updateOwnerState(item: Palinka, rawState: string) {
    const state = rawState as PalinkaManageableState;
    if (!this.canAdjustState(item) || this.ownerStateValue(item) === state) {
      return;
    }

    this.error.set(null);
    this.updatingStateItemId.set(item.id);
    const request = state !== 'closed' && !item.workflowClosedAt
      ? this.service.update(item.id, this.buildUpdatePayloadFromItem(item, state))
      : this.service.updateState(item.id, { state });

    request.subscribe({
      next: (updated) => {
        this.items.update((current) => current.map((currentItem) => (currentItem.id === updated.id ? updated : currentItem)));
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Nem sikerült frissíteni a tétel állapotát.');
        this.updatingStateItemId.set(null);
      },
      complete: () => {
        this.updatingStateItemId.set(null);
      },
    });
  }

  interestStatusLabel(status: ChatInterestStatus) {
    return CHAT_INTEREST_STATUS_LABELS[status];
  }

  interestStatusDescription(status: ChatInterestStatus) {
    return CHAT_INTEREST_STATUS_DESCRIPTIONS[status];
  }

  ownerLabel(item: Palinka) {
    if (item.isOwnedByCurrentUser) {
      return 'Saját tétel';
    }

    return item.owner?.displayName ?? item.owner?.username ?? 'Ismeretlen';
  }

  reservationLabel(item: Palinka) {
    const count = this.getOpenInterestCount(item);
    if (item.workflowClosedAt) {
      return 'Lezárt tétel';
    }
    if (!this.canStartInterest(item)) {
      return 'Új érdeklődés lezárva';
    }
    if (count === 0) {
      return 'Nincs aktív érdeklődő';
    }
    return count === 1 ? '1 aktív érdeklődő' : `${count} aktív érdeklődő`;
  }

  reservationHint(item: Palinka) {
    if (item.currentUserHasConversation) {
      return 'A meglévő beszélgetés bármikor újranyitható.';
    }

    if (item.workflowClosedAt) {
      return 'A tulajdonos lezárta ezt a tételt.';
    }

    if (!this.canStartInterest(item)) {
      return this.statusDescription(item);
    }

    return null;
  }

  showOwnInterestBadge(item: Palinka) {
    return !!item.currentUserHasConversation && !item.isOwnedByCurrentUser && this.currentUser()?.role !== 'admin';
  }

  adminInterestEntries(item: Palinka) {
    return (item.interestEntries ?? []).filter((interest) => !isClosedChatInterestStatus(interest.status));
  }

  private hasFreshInterest(item: Palinka) {
    const now = Date.now();

    return (item.interestEntries ?? []).some((interest) => {
      if (isClosedChatInterestStatus(interest.status)) {
        return false;
      }

      const latestMessageAt = new Date(interest.latestMessageAt).getTime();
      return Number.isFinite(latestMessageAt) && now - latestMessageAt <= this.interestHighlightWindowMs;
    });
  }

  private getOpenInterestCount(item: Palinka) {
    return item.interestCount ?? this.adminInterestEntries(item).length;
  }

  describeItem(item: Palinka) {
    return `${item.fruitType} · ${this.formatVolume(item.volumeLiters)} L · ${item.distillationStyle}`;
  }

  load(silent = false) {
    if (!silent) {
      this.loading.set(true);
      this.error.set(null);
    }

    this.service
      .list()
      .pipe(
        finalize(() => {
          if (!silent) {
            this.loading.set(false);
          }
        })
      )
      .subscribe({
        next: (items) => {
          this.items.set(items);
        },
        error: (err) => {
          if (!silent) {
            this.error.set(err?.error?.message ?? 'Nem sikerült betölteni a listát.');
          }
        },
      });
  }

  private startPolling() {
    if (this.pollHandle) {
      return;
    }

    this.pollHandle = setInterval(() => {
      this.load(true);
    }, 8000);
  }

  private stopPolling() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}
