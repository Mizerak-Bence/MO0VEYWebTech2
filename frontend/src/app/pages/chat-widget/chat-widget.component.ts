import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/auth.service';
import { ChatService } from '../../core/chat.service';
import type { ChatThread } from '../../core/models';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatBadgeModule, MatInputModule, DatePipe],
  templateUrl: './chat-widget.component.html',
  styleUrl: './chat-widget.component.scss',
})
export class ChatWidgetComponent implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly chatService = inject(ChatService);
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  readonly isOpen = this.chatService.isOpen;
  readonly currentUser = this.auth.currentUser;
  readonly threads = signal<ChatThread[]>([]);
  readonly loading = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly draftMessage = signal('');
  readonly markingSeenThreadId = signal<string | null>(null);
  readonly selectedThreadId = this.chatService.selectedThreadId;
  readonly selectedThread = computed(
    () => this.threads().find((thread) => thread.id === this.selectedThreadId()) ?? this.threads()[0] ?? null
  );
  readonly unreadCount = computed(() => this.threads().reduce((sum, thread) => sum + thread.unreadCount, 0));

  constructor() {
    effect(() => {
      const user = this.currentUser();
      if (!user) {
        this.stopPolling();
        this.threads.set([]);
        this.chatService.closeWidget();
        return;
      }

      this.loadThreads();
      this.startPolling();
    });

    effect(() => {
      this.chatService.refreshNonce();
      if (this.currentUser()) {
        this.loadThreads();
      }
    });

    effect(() => {
      const isOpen = this.isOpen();
      const thread = this.selectedThread();
      if (isOpen && thread && thread.unreadCount > 0 && this.markingSeenThreadId() !== thread.id) {
        this.markThreadSeen(thread.id);
      }
    });
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  toggleWidget() {
    this.chatService.toggleWidget();
  }

  selectThread(threadId: string) {
    this.chatService.setSelectedThread(threadId);
  }

  threadStatusLabel(thread: ChatThread) {
    return thread.unreadCount > 0 ? `${thread.unreadCount} új üzenet` : 'Láttam';
  }

  sendMessage() {
    const thread = this.selectedThread();
    const text = this.draftMessage().trim();
    if (!thread || !text) {
      return;
    }

    this.sending.set(true);
    this.error.set(null);
    this.chatService.sendMessage(thread.id, text).subscribe({
      next: (response) => {
        this.upsertThread(response.thread);
        this.draftMessage.set('');
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Nem sikerült elküldeni az üzenetet.');
        this.sending.set(false);
      },
      complete: () => {
        this.sending.set(false);
      },
    });
  }

  private loadThreads() {
    this.loading.set(true);
    this.chatService.listThreads().subscribe({
      next: (threads) => {
        this.threads.set(threads);
        const selected = this.selectedThreadId();
        if (!selected && threads.length > 0) {
          this.chatService.setSelectedThread(threads[0].id);
        }
        if (selected && !threads.some((thread) => thread.id === selected) && threads.length > 0) {
          this.chatService.setSelectedThread(threads[0].id);
        }
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Nem sikerült betölteni a beszélgetéseket.');
        this.loading.set(false);
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }

  private markThreadSeen(threadId: string) {
    this.markingSeenThreadId.set(threadId);
    this.chatService.markSeen(threadId).subscribe({
      next: (response) => {
        this.upsertThread(response.thread);
      },
      error: () => {
        this.markingSeenThreadId.set(null);
      },
      complete: () => {
        this.markingSeenThreadId.set(null);
      },
    });
  }

  private upsertThread(thread: ChatThread) {
    const next = [thread, ...this.threads().filter((item) => item.id !== thread.id)].sort(
      (left, right) => new Date(right.latestMessageAt).getTime() - new Date(left.latestMessageAt).getTime()
    );
    this.threads.set(next);
    this.chatService.setSelectedThread(thread.id);
  }

  private startPolling() {
    if (this.pollHandle) {
      return;
    }

    this.pollHandle = setInterval(() => {
      if (this.currentUser()) {
        this.loadThreads();
      }
    }, 8000);
  }

  private stopPolling() {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }
}