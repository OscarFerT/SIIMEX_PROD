import { Component, OnInit, OnDestroy, inject, HostListener, ElementRef } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, DOCUMENT } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import { NotificacionService, Notificacion } from '../../core/notificacion.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private notifService = inject(NotificacionService);
  private router = inject(Router);
  private elRef = inject(ElementRef);
  private doc = inject(DOCUMENT);

  notifCount = 0;
  notifPanelOpen = false;
  notificaciones: Notificacion[] = [];
  sidebarOpen = false;
  private subs: Subscription[] = [];
  private readonly notifRefreshMs = 10000;
  private readonly notifDropdownLimit = 12;

  ngOnInit(): void {
    this.doc.body.classList.add('admin-surface');
    this.notifService.contarNoLeidasAdmin().subscribe();
    this.subs.push(
      this.notifService.adminCount$.subscribe(c => this.notifCount = c)
    );
    this.subs.push(
      interval(this.notifRefreshMs).subscribe(() => {
        this.notifService.contarNoLeidasAdmin().subscribe();
      })
    );
  }

  ngOnDestroy(): void {
    this.doc.body.classList.remove('admin-surface');
    this.subs.forEach(s => s.unsubscribe());
  }

  toggleNotifPanel(): void {
    this.notifPanelOpen = !this.notifPanelOpen;
    if (this.notifPanelOpen) {
      this.notifService.contarNoLeidasAdmin().subscribe();
      this.notifService.listarAdminRecientes(this.notifDropdownLimit).subscribe(items => this.notificaciones = items);
    }
  }

  marcarLeida(n: Notificacion): void {
    if (!n.leida) {
      this.notifService.marcarLeidaAdmin(n.id).subscribe(() => n.leida = true);
    }
    if (n.rutaLink) {
      this.notifPanelOpen = false;
      this.router.navigateByUrl(n.rutaLink);
    }
  }

  marcarTodasLeidas(): void {
    this.notifService.marcarTodasLeidasAdmin().subscribe(() => {
      this.notificaciones.forEach(n => n.leida = true);
    });
  }

  getNotifIcon(tipo: string): string {
    switch (tipo) {
      case 'NUEVA_POSTULACION': return 'fa-file-circle-plus';
      case 'NUEVO_REGISTRO': return 'fa-user-plus';
      case 'NUEVA_CONVOCATORIA': return 'fa-bullhorn';
      case 'SISTEMA': return 'fa-gear';
      default: return 'fa-bell';
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.notifPanelOpen && !this.elRef.nativeElement.contains(event.target)) {
      this.notifPanelOpen = false;
    }
  }

  logout(): void {
    this.auth.logout();
    window.location.href = '/login/admin';
  }
}
