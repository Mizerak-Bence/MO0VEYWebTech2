import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);

  @ViewChild('backdropCanvas') private backdropCanvas?: ElementRef<HTMLCanvasElement>;

  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly pointerX = signal(50);
  readonly pointerY = signal(50);

  private context: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private resizeObserver?: ResizeObserver;
  private viewportWidth = 0;
  private viewportHeight = 0;

  readonly form = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
    password: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(200)]],
  });

  ngAfterViewInit() {
    const canvas = this.backdropCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    this.context = canvas.getContext('2d');
    if (!this.context) {
      return;
    }

    this.resizeCanvas();

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
      this.resizeObserver.observe(canvas);
    }

    this.ngZone.runOutsideAngular(() => {
      const render = (timestamp: number) => {
        this.drawBackdrop(timestamp * 0.001);
        this.animationFrameId = requestAnimationFrame(render);
      };

      this.animationFrameId = requestAnimationFrame(render);
    });
  }

  ngOnDestroy() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.resizeObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.resizeCanvas();
  }

  onPointerMove(event: PointerEvent) {
    const currentTarget = event.currentTarget as HTMLElement | null;
    if (!currentTarget) {
      return;
    }

    const rect = currentTarget.getBoundingClientRect();
    this.pointerX.set(this.clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100));
    this.pointerY.set(this.clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100));
  }

  resetPointer() {
    this.pointerX.set(50);
    this.pointerY.set(50);
  }

  submit() {
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    const { username, password } = this.form.getRawValue();

    this.auth.login({ username: username!, password: password! }).subscribe({
      next: () => {
        this.router.navigateByUrl('/palinkas');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Sikertelen bejelentkezés.');
      },
      complete: () => {
        this.loading.set(false);
      },
    });
  }

  private resizeCanvas() {
    const canvas = this.backdropCanvas?.nativeElement;
    const context = this.context;

    if (!canvas || !context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    const devicePixelRatio = Math.max(window.devicePixelRatio || 1, 1);

    canvas.width = Math.floor(width * devicePixelRatio);
    canvas.height = Math.floor(height * devicePixelRatio);
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  private drawBackdrop(time: number) {
    const context = this.context;
    if (!context || !this.viewportWidth || !this.viewportHeight) {
      return;
    }

    const width = this.viewportWidth;
    const height = this.viewportHeight;
    const pointerX = width * (this.pointerX() / 100);
    const pointerY = height * (this.pointerY() / 100);

    context.clearRect(0, 0, width, height);

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#091217');
    background.addColorStop(0.52, '#102027');
    background.addColorStop(1, '#070b0f');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    const glows = [
      {
        x: width * 0.2 + Math.sin(time * 0.5) * 48,
        y: height * 0.28 + Math.cos(time * 0.7) * 34,
        radius: Math.max(width, height) * 0.32,
        inner: 'rgba(85, 145, 127, 0.24)',
      },
      {
        x: width * 0.78 + Math.cos(time * 0.42) * 58,
        y: height * 0.62 + Math.sin(time * 0.65) * 42,
        radius: Math.max(width, height) * 0.28,
        inner: 'rgba(33, 91, 122, 0.22)',
      },
      {
        x: pointerX,
        y: pointerY,
        radius: Math.max(width, height) * 0.22,
        inner: 'rgba(187, 220, 204, 0.16)',
      },
    ];

    for (const glow of glows) {
      const gradient = context.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.radius);
      gradient.addColorStop(0, glow.inner);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    }

    context.lineWidth = 1.2;
    for (let index = 0; index < 9; index += 1) {
      const baseY = (height * (index + 1)) / 10;
      context.beginPath();

      for (let x = -32; x <= width + 32; x += 24) {
        const wave = Math.sin(x * 0.013 + time * 1.3 + index * 0.58) * 12;
        const pullStrength = Math.max(0, 1 - Math.abs(baseY - pointerY) / (height * 0.7));
        const pull = Math.cos((x - pointerX) * 0.012 + time * 0.9) * pullStrength * 16;
        const y = baseY + wave + pull;

        if (x === -32) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.strokeStyle = `rgba(205, 230, 222, ${0.06 + index * 0.012})`;
      context.stroke();
    }

    context.lineWidth = 1;
    for (let index = 0; index < 12; index += 1) {
      const x = (width * index) / 11 + Math.sin(time * 0.55 + index * 0.7) * 14;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + Math.cos(time * 0.9 + index) * 12, height);
      context.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      context.stroke();
    }

    for (let index = 0; index < 18; index += 1) {
      const x = ((index * 97 + time * (24 + index)) % (width + 120)) - 60;
      const y =
        height * (0.18 + ((index * 17) % 55) / 100) +
        Math.sin(time * 0.75 + index * 0.8) * 18 +
        (pointerY - height / 2) * 0.05;
      const radius = 1.4 + (index % 4) * 0.45;

      context.beginPath();
      context.fillStyle = index % 3 === 0 ? 'rgba(214, 237, 226, 0.48)' : 'rgba(112, 180, 159, 0.28)';
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }
}
