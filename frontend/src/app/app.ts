import { Component, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from './core/auth.service';
import { ChatWidgetComponent } from './pages/chat-widget/chat-widget.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatWidgetComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly routerSubscription: Subscription;
  protected readonly title = signal('palinka-nyilvantarto');
  protected readonly showChatWidget = signal(true);

  constructor() {
    this.auth.initializeAuth();
    this.updateChatVisibility(this.router.url);
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateChatVisibility((event as NavigationEnd).urlAfterRedirects);
      });
  }

  ngOnDestroy() {
    this.routerSubscription.unsubscribe();
  }

  private updateChatVisibility(url: string) {
    this.showChatWidget.set(!(url.startsWith('/login') || url.startsWith('/register')));
  }
}
