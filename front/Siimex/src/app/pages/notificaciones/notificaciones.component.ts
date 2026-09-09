import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NotificacionService, Notificacion } from '../../core/notificacion.service';
import { AuthService } from '../../core/auth.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  filtroTexto = '';
  filtroTipo = '';
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
    const texto = this.normalizarTexto(this.filtroTexto);
    const tipo = this.filtroTipo;

    this.filtradas = this.notificaciones.filter(n => {
      const coincideEstado = this.filtroActivo === 'no-leidas'
        ? !n.leida
        : this.filtroActivo === 'leidas'
          ? n.leida
          : true;
      const coincideTipo = tipo ? n.tipo === tipo : true;
      const contenido = this.normalizarTexto(`${n.titulo || ''} ${n.mensaje || ''} ${this.getTipoLabel(n.tipo)} ${n.tipo || ''}`);
      const coincideTexto = texto ? contenido.includes(texto) : true;
      return coincideEstado && coincideTipo && coincideTexto;
    });
  }

  setFiltro(f: 'todas' | 'no-leidas' | 'leidas'): void {
    this.filtroActivo = f;
    this.aplicarFiltro();
  }

  limpiarFiltrosBusqueda(): void {
    this.filtroTexto = '';
    this.filtroTipo = '';
    this.aplicarFiltro();
  }

  get hayFiltrosBusqueda(): boolean {
    return !!(this.filtroTexto.trim() || this.filtroTipo);
  }

  get tiposDisponibles(): string[] {
    return Array.from(new Set(this.notificaciones.map(n => n.tipo).filter(Boolean)))
      .sort((a, b) => this.getTipoLabel(a).localeCompare(this.getTipoLabel(b), 'es', { sensitivity: 'base' }));
  }

  get countLeidas(): number {
    return this.notificaciones.filter(n => n.leida).length;
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

  private normalizarTexto(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}