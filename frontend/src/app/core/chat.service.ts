import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import type { ChatThread } from './models';

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly isOpen = signal(false);
  readonly selectedThreadId = signal<string | null>(null);
  readonly refreshNonce = signal(0);
  readonly hasSelection = computed(() => !!this.selectedThreadId());

  constructor(private readonly http: HttpClient) {}

  listThreads() {
    return this.http.get<ChatThread[]>(`${environment.apiBaseUrl}/chats`);
  }

  reservePalinka(palinkaId: string, initialMessage?: string) {
    return this.http
      .post<{ thread: ChatThread }>(`${environment.apiBaseUrl}/chats/reserve`, { palinkaId, initialMessage })
      .pipe(
        tap((response) => {
          this.openThread(response.thread.id);
        })
      );
  }

  sendMessage(threadId: string, text: string) {
    return this.http.post<{ thread: ChatThread }>(`${environment.apiBaseUrl}/chats/${threadId}/messages`, { text }).pipe(
      tap((response) => {
        this.openThread(response.thread.id);
      })
    );
  }

  markSeen(threadId: string) {
    return this.http.post<{ thread: ChatThread }>(`${environment.apiBaseUrl}/chats/${threadId}/seen`, {}).pipe(
      tap((response) => {
        this.openThread(response.thread.id);
      })
    );
  }

  openThread(threadId: string) {
    this.selectedThreadId.set(threadId);
    this.isOpen.set(true);
    this.refreshNonce.update((value) => value + 1);
  }

  closeWidget() {
    this.isOpen.set(false);
  }

  toggleWidget() {
    this.isOpen.update((value) => !value);
    this.refreshNonce.update((value) => value + 1);
  }

  setSelectedThread(threadId: string) {
    this.selectedThreadId.set(threadId);
  }
}