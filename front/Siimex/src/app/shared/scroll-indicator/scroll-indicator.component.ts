import { CommonModule } from '@angular/common';
import { Component, HostListener, NgZone, OnDestroy, OnInit, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';

@Component({
  selector: 'app-scroll-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scroll-indicator.component.html',
  styleUrl: './scroll-indicator.component.css'
})
export class ScrollIndicatorComponent implements OnInit, OnDestroy {
  protected readonly visible = signal(false);
  private routeSub?: Subscription;
  private rafId: number | null = null;

  constructor(
    private readonly router: Router,
    private readonly ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.ngZone.runOutsideAngular(() => {
      window.setTimeout(() => this.scheduleUpdate(), 250);
    });

    this.routeSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        window.setTimeout(() => this.scheduleUpdate(), 250);
      });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
    }
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected scheduleUpdate(): void {
    if (this.rafId !== null) {
      return;
    }

    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null;
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const viewportHeight = window.innerHeight || doc.clientHeight || 0;
      const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight);
      const remaining = scrollHeight - (scrollTop + viewportHeight);
      const shouldShow = scrollHeight > viewportHeight + 220 && remaining > 180;

      this.ngZone.run(() => this.visible.set(shouldShow));
    });
  }

  protected scrollDown(): void {
    window.scrollBy({
      top: Math.max(window.innerHeight * 0.7, 420),
      behavior: 'smooth'
    });
  }
}