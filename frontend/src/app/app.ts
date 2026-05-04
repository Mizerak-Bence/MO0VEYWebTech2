import { Component, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { filter, Subscription } from 'rxjs';
import { AuthService } from './core/auth.service';
import { ChatWidgetComponent } from './pages/chat-widget/chat-widget.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatWidgetComponent, MatButtonModule, MatIconModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly routerSubscription: Subscription;
  protected readonly title = signal('palinka-nyilvantarto');
  protected readonly showChatWidget = signal(true);
  protected readonly showScrollTopButton = signal(false);
  private readonly currentUrl = signal('');

  constructor() {
    this.auth.initializeAuth();
    this.updateFloatingUi(this.router.url);
    this.routerSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.updateFloatingUi((event as NavigationEnd).urlAfterRedirects);
      });
  }

  ngOnDestroy() {
    this.routerSubscription.unsubscribe();
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    this.updateScrollTopVisibility();
  }

  protected scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private updateFloatingUi(url: string) {
    this.currentUrl.set(url);
    this.showChatWidget.set(!(url.startsWith('/login') || url.startsWith('/register') || url.startsWith('/admin')));
    this.updateScrollTopVisibility();
  }

  private updateScrollTopVisibility() {
    const url = this.currentUrl();
    this.showScrollTopButton.set(url === '/palinkas' && window.scrollY > 280);
  }
}
