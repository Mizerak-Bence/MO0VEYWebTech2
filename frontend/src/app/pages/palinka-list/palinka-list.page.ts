import { Component } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';

import { PalinkaService } from '../../core/palinka.service';
import type { Palinka } from '../../core/models';

@Component({
  selector: 'app-palinka-list-page',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatCardModule, MatTableModule, DatePipe],
  templateUrl: './palinka-list.page.html',
  styleUrl: './palinka-list.page.scss',
})
export class PalinkaListPage {
  loading = true;
  error: string | null = null;
  items: Palinka[] = [];

  readonly displayedColumns = ['name', 'fruitType', 'abvPercent', 'volumeLiters', 'distillationStyle', 'madeDate'];

  constructor(private readonly service: PalinkaService) {
    this.load();
  }

  load() {
    this.loading = true;
    this.error = null;

    this.service.list().subscribe({
      next: (items) => {
        this.items = items;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Nem sikerült betölteni a listát.';
        this.loading = false;
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
