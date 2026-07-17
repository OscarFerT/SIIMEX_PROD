import { Component, inject } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './shared/header/header.component';
import { FooterComponent } from './shared/footer/footer.component';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, HeaderComponent, FooterComponent],
  template: `
    <ng-container *ngIf="!isAdminRoute">
      <app-header></app-header>
    </ng-container>
    <main [class]="isAdminRoute ? '' : 'container my-4'">
      <router-outlet></router-outlet>
    </main>
    <ng-container *ngIf="!isAdminRoute">
      <app-footer></app-footer>
    </ng-container>
  `
})
export class AppComponent {
  title = 'comecyt-portal';
  isAdminRoute = false;
  private router = inject(Router);

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.isAdminRoute = e.urlAfterRedirects.startsWith('/admin');
    });
  }
}
