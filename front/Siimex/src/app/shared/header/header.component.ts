import { Component, inject, OnInit, OnDestroy, HostListener, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { NotificacionService, Notificacion } from '../../core/notificacion.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  mostrarNavbar = true;

  perfilOpen = false;
  acercaOpen = false;
  investigadoresOpen = false;
  innovadoresOpen = false;
  perfilesOpen = false;

  private auth = inject(AuthService);
  private router = inject(Router);
  private notifService = inject(NotificacionService);
  private elRef = inject(ElementRef);

  loggedIn$ = this.auth.loggedIn$;
  user$ = this.auth.user$;

  notifCount = 0;
  notifPanelOpen = false;
  notificaciones: Notificacion[] = [];
  dropdownStyle: { [key: string]: string } = {};
  @ViewChild('notifBellBtn') notifBellBtn!: ElementRef;
  private subs: Subscription[] = [];
  private readonly notifRefreshMs = 10000;
  private readonly notifDropdownLimit = 12;

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  get isEvaluador(): boolean {
    return this.auth.isEvaluador() || this.auth.isAdmin();
  }

  ngOnInit(): void {
    this.subs.push(
      this.auth.loggedIn$.subscribe(loggedIn => {
        if (loggedIn) {
          this.refreshCount();
        }
      })
    );
    this.subs.push(
      this.notifService.count$.subscribe(c => {
        if (!this.isAdmin) this.notifCount = c;
      })
    );
    this.subs.push(
      this.notifService.adminCount$.subscribe(c => {
        if (this.isAdmin) this.notifCount = c;
      })
    );
    this.subs.push(
      interval(this.notifRefreshMs).subscribe(() => {
        if (this.auth.isLoggedIn()) {
          this.refreshCount();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private refreshCount(): void {
    if (this.isAdmin) {
      this.notifService.contarNoLeidasAdmin().subscribe();
    } else {
      this.notifService.contarNoLeidas().subscribe();
    }
  }

  toggleNotifPanel(): void {
    this.notifPanelOpen = !this.notifPanelOpen;
    if (this.notifPanelOpen) {
      this.refreshCount();
      this.positionDropdown();
      const obs = this.isAdmin
        ? this.notifService.listarAdminRecientes(this.notifDropdownLimit)
        : this.notifService.listarRecientes(this.notifDropdownLimit);
      obs.subscribe(items => this.notificaciones = items);
    }
  }

  private positionDropdown(): void {
    if (!this.notifBellBtn) return;
    const rect = this.notifBellBtn.nativeElement.getBoundingClientRect();
    this.dropdownStyle = {
      position: 'fixed',
      top: (rect.bottom + 8) + 'px',
      right: (window.innerWidth - rect.right) + 'px'
    };
  }

  marcarLeida(n: Notificacion): void {
    if (!n.leida) {
      const obs = this.isAdmin
        ? this.notifService.marcarLeidaAdmin(n.id)
        : this.notifService.marcarLeida(n.id);
      obs.subscribe(() => n.leida = true);
    }
    if (n.rutaLink) {
      this.notifPanelOpen = false;
      this.router.navigateByUrl(n.rutaLink);
    }
  }

  marcarTodasLeidas(): void {
    const obs = this.isAdmin
      ? this.notifService.marcarTodasLeidasAdmin()
      : this.notifService.marcarTodasLeidas();
    obs.subscribe(() => {
      this.notificaciones.forEach(n => n.leida = true);
    });
  }

  getNotifIcon(tipo: string): string {
    switch (tipo) {
      case 'POSTULACION_ACEPTADA': return 'fa-circle-check';
      case 'POSTULACION_RECHAZADA': return 'fa-circle-xmark';
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

  logoutAndGoLanding(): void {
    this.auth.logout();
    this.router.navigateByUrl('/');
  }
}
