import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificacionService, Notificacion } from '../../core/notificacion.service';
import { AuthService } from '../../core/auth.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificaciones.component.html',
  styleUrls: ['./notificaciones.component.css']
})
export class NotificacionesComponent implements OnInit, OnDestroy {
  private notifService = inject(NotificacionService);
  private auth = inject(AuthService);
  private router = inject(Router);

  notificaciones: Notificacion[] = [];
  filtradas: Notificacion[] = [];
  loading = true;
  refreshing = false;
  filtroActivo: 'todas' | 'no-leidas' | 'leidas' = 'todas';
  private subs: Subscription[] = [];
  private readonly autoRefreshMs = 10000;

  get isAdmin(): boolean {
    return this.auth.isAdmin();
  }

  ngOnInit(): void {
    this.cargar();
    this.subs.push(
      interval(this.autoRefreshMs).subscribe(() => this.cargarSilencioso())
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  cargar(): void {
    this.loading = true;
    const obs = this.isAdmin
      ? this.notifService.listarAdmin()
      : this.notifService.listar();

    obs.subscribe({
      next: (list) => {
        this.notificaciones = list;
        this.aplicarFiltro();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  cargarSilencioso(): void {
    this.refreshing = true;
    const obs = this.isAdmin
      ? this.notifService.listarAdmin()
      : this.notifService.listar();

    obs.subscribe({
      next: (list) => {
        this.notificaciones = list;
        this.aplicarFiltro();
        this.refreshing = false;
      },
      error: () => {
        this.refreshing = false;
      }
    });
  }

  aplicarFiltro(): void {
    if (this.filtroActivo === 'no-leidas') {
      this.filtradas = this.notificaciones.filter(n => !n.leida);
    } else if (this.filtroActivo === 'leidas') {
      this.filtradas = this.notificaciones.filter(n => n.leida);
    } else {
      this.filtradas = [...this.notificaciones];
    }
  }

  setFiltro(f: 'todas' | 'no-leidas' | 'leidas'): void {
    this.filtroActivo = f;
    this.aplicarFiltro();
  }

  get countNoLeidas(): number {
    return this.notificaciones.filter(n => !n.leida).length;
  }

  marcarLeida(n: Notificacion): void {
    if (n.leida) {
      if (n.rutaLink) this.router.navigateByUrl(n.rutaLink);
      return;
    }
    const obs = this.isAdmin
      ? this.notifService.marcarLeidaAdmin(n.id)
      : this.notifService.marcarLeida(n.id);

    obs.subscribe(() => {
      n.leida = true;
      this.aplicarFiltro();
      if (n.rutaLink) this.router.navigateByUrl(n.rutaLink);
    });
  }

  marcarTodasLeidas(): void {
    const obs = this.isAdmin
      ? this.notifService.marcarTodasLeidasAdmin()
      : this.notifService.marcarTodasLeidas();

    obs.subscribe(() => {
      this.notificaciones.forEach(n => n.leida = true);
      this.aplicarFiltro();
    });
  }

  getIcon(tipo: string): string {
    const map: Record<string, string> = {
      POSTULACION_ACEPTADA: 'fa-check-circle',
      POSTULACION_RECHAZADA: 'fa-times-circle',
      NUEVA_CONVOCATORIA: 'fa-bullhorn',
      NUEVA_POSTULACION: 'fa-file-alt',
      NUEVO_REGISTRO: 'fa-user-plus',
      SISTEMA: 'fa-cog'
    };
    return map[tipo] || 'fa-bell';
  }

  getIconColor(tipo: string): string {
    const map: Record<string, string> = {
      POSTULACION_ACEPTADA: '#28a745',
      POSTULACION_RECHAZADA: '#dc3545',
      NUEVA_CONVOCATORIA: '#6f42c1',
      NUEVA_POSTULACION: '#007bff',
      NUEVO_REGISTRO: '#17a2b8',
      SISTEMA: '#6c757d'
    };
    return map[tipo] || '#800020';
  }

  getTipoLabel(tipo: string): string {
    const map: Record<string, string> = {
      POSTULACION_ACEPTADA: 'Aceptada',
      POSTULACION_RECHAZADA: 'Rechazada',
      NUEVA_CONVOCATORIA: 'Convocatoria',
      NUEVA_POSTULACION: 'Postulación',
      NUEVO_REGISTRO: 'Registro',
      SISTEMA: 'Sistema'
    };
    return map[tipo] || tipo;
  }

  tiempoRelativo(fecha: string): string {
    const now = new Date();
    const d = new Date(fecha);
    const diffMs = now.getTime() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Justo ahora';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
