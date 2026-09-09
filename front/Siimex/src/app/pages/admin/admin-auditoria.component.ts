import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';

interface AuditItem {
  id: number;
  fecha: string;
  categoria: string;
  accion: string;
  detalle: string | null;
  usuarioId: number | null;
  usuarioEmail: string | null;
  usuarioNombre: string | null;
  entidadTipo: string | null;
  entidadId: number | null;
  ipAddress: string | null;
}

interface AuditStats {
  total24h: number;
  total7d: number;
  total30d: number;
  porAccion: { accion: string; total: number }[];
  porCategoria: { categoria: string; total: number }[];
  ultimosEventos: { id: number; fecha: string; categoria: string; accion: string; usuarioEmail: string; detalle: string }[];
}

interface PageResponse {
  items: AuditItem[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-auditoria.component.html',
  styleUrls: ['./admin-auditoria.component.css']
})
export class AdminAuditoriaComponent implements OnInit {
  private http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  vista: 'logs' | 'stats' = 'logs';

  items: AuditItem[] = [];
  totalElements = 0;
  totalPages = 0;
  page = 0;
  size = 25;

  filtroCategoria = '';
  filtroEmail = '';
  filtroAccion = '';
  filtroDesde = '';
  filtroHasta = '';

  stats: AuditStats | null = null;
  statsLoading = false;

  detalleVisible = false;
  detalleItem: AuditItem | null = null;

  readonly CATEGORIAS = [
    { value: 'AUTENTICACION', label: 'Autenticación', icon: 'fa-key', color: '#2563eb' },
    { value: 'USUARIO', label: 'Usuario', icon: 'fa-user', color: '#059669' },
    { value: 'ADMIN', label: 'Administración', icon: 'fa-shield-alt', color: '#dc2626' },
    { value: 'CONVOCATORIA', label: 'Convocatoria', icon: 'fa-bullhorn', color: '#d97706' },
    { value: 'POSTULACION', label: 'Postulación', icon: 'fa-file-alt', color: '#7c3aed' },
    { value: 'DOCUMENTO', label: 'Documento', icon: 'fa-file-upload', color: '#0891b2' },
    { value: 'SISTEMA', label: 'Sistema', icon: 'fa-cog', color: '#64748b' }
  ];

  ngOnInit(): void {
    this.buscar();
  }

  cambiarVista(v: 'logs' | 'stats'): void {
    this.vista = v;
    if (v === 'stats' && !this.stats) {
      this.cargarStats();
    }
  }

  buscar(): void {
    this.loading = true;
    this.error = null;
    let params = new HttpParams()
      .set('page', this.page.toString())
      .set('size', this.size.toString());
    if (this.filtroCategoria) params = params.set('categoria', this.filtroCategoria);
    if (this.filtroEmail.trim()) params = params.set('email', this.filtroEmail.trim());
    if (this.filtroAccion.trim()) params = params.set('accion', this.filtroAccion.trim());
    if (this.filtroDesde) params = params.set('desde', this.filtroDesde);
    if (this.filtroHasta) params = params.set('hasta', this.filtroHasta);

    this.http.get<PageResponse>(`${environment.apiBaseUrl}/admin/auditoria`, { params }).subscribe({
      next: (res) => {
        this.items = res.items;
        this.totalElements = res.totalElements;
        this.totalPages = res.totalPages;
        this.page = res.page;
        this.loading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'Error al cargar logs de auditoría';
        this.loading = false;
      }
    });
  }

  cargarStats(): void {
    this.statsLoading = true;
    this.http.get<AuditStats>(`${environment.apiBaseUrl}/admin/auditoria/stats`).subscribe({
      next: (res) => {
        this.stats = res;
        this.statsLoading = false;
      },
      error: () => {
        this.statsLoading = false;
      }
    });
  }

  aplicarFiltros(): void {
    this.page = 0;
    this.buscar();
  }

  limpiarFiltros(): void {
    this.filtroCategoria = '';
    this.filtroEmail = '';
    this.filtroAccion = '';
    this.filtroDesde = '';
    this.filtroHasta = '';
    this.page = 0;
    this.buscar();
  }

  tieneFiltrosActivos(): boolean {
    return !!(this.filtroCategoria || this.filtroEmail.trim() || this.filtroAccion.trim() || this.filtroDesde || this.filtroHasta);
  }

  irPagina(p: number): void {
    if (p < 0 || p >= this.totalPages) return;
    this.page = p;
    this.buscar();
  }

  get paginas(): number[] {
    const total = this.totalPages;
    const current = this.page;
    const pages: number[] = [];
    const start = Math.max(0, current - 2);
    const end = Math.min(total - 1, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  verDetalle(item: AuditItem): void {
    this.detalleItem = item;
    this.detalleVisible = true;
  }

  cerrarDetalle(): void {
    this.detalleVisible = false;
    this.detalleItem = null;
  }

  getCategoriaInfo(cat: string): { label: string; icon: string; color: string } {
    return this.CATEGORIAS.find(c => c.value === cat) || { label: cat, icon: 'fa-circle', color: '#64748b' };
  }

  formatFecha(iso: string): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' });
    } catch {
      return iso;
    }
  }

  formatFechaCorta(iso: string): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  }

  getAccionClase(accion: string): string {
    const a = (accion || '').toUpperCase();
    if (a.includes('LOGIN') || a.includes('REGISTRO')) return 'accion-auth';
    if (a.includes('CREAR') || a.includes('OTORGAR')) return 'accion-crear';
    if (a.includes('ELIMINAR') || a.includes('SUSPENDER') || a.includes('REVOCAR')) return 'accion-eliminar';
    if (a.includes('RESET') || a.includes('REACTIVAR')) return 'accion-modificar';
    return 'accion-default';
  }

  formatAccion(accion: string): string {
    const raw = (accion || '').trim();
    if (!raw) return 'Actividad registrada';

    const upper = raw.toUpperCase();
    const acciones: Record<string, string> = {
      LOGIN_ADMIN: 'Inicio de sesión de administrador',
      LOGIN_2FA_SKIP: 'Entró con dispositivo de confianza',
      LOGIN_2FA_CODIGO: 'Solicitó código de acceso',
      LOGIN_2FA_OK: 'Confirmó el código de acceso',
      LOGIN_OK: 'Inició sesión',
      LOGIN_FAIL: 'Intento fallido de inicio de sesión',
      LOGOUT: 'Cerró sesión',
      REGISTRO: 'Creó una cuenta',
      REGISTRO_OK: 'Registro completado',
      VERIFICACION_CORREO: 'Confirmó su correo',
      RESET_PASSWORD: 'Solicitó recuperar contraseña',
      CAMBIO_PASSWORD: 'Cambió su contraseña',
      CREAR_USUARIO: 'Creó un usuario',
      SUSPENDER_USUARIO: 'Suspendió un usuario',
      REACTIVAR_USUARIO: 'Reactivó un usuario',
      ELIMINAR_USUARIO: 'Eliminó un usuario',
      OTORGAR_ROL: 'Asignó permisos',
      REVOCAR_ROL: 'Quitó permisos'
    };

    if (acciones[upper]) return acciones[upper];

    const requestMatch = raw.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/i);
    if (requestMatch) {
      return this.formatAccionHttp(requestMatch[1].toUpperCase(), requestMatch[2]);
    }

    return raw
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  formatDetalle(detalle: string | null | undefined, accion?: string): string {
    const raw = (detalle || '').trim();
    if (!raw) return 'Sin detalle adicional';

    const httpMatch = raw.match(/^HTTP\s+(\d{3})$/i);
    if (httpMatch) {
      return this.formatHttpStatus(Number(httpMatch[1]));
    }

    const detalles: Record<string, string> = {
      'LOGIN CON TOKEN DE CONFIANZA (SIN 2FA)': 'Ingresó desde un dispositivo ya reconocido.',
      'CODIGO 2FA SOLICITADO': 'Se envió un código de verificación al correo.',
      'CÓDIGO 2FA SOLICITADO': 'Se envió un código de verificación al correo.',
      'VERIFICACION 2FA EXITOSA': 'El código de verificación fue correcto.',
      'VERIFICACIÓN 2FA EXITOSA': 'El código de verificación fue correcto.',
      'INICIO DE SESION DE ADMINISTRADOR': 'Acceso correcto al panel de administración.',
      'INICIO DE SESIÓN DE ADMINISTRADOR': 'Acceso correcto al panel de administración.'
    };

    const normalized = this.normalizarTexto(raw);
    const detalleComun = detalles[normalized] || detalles[raw.toUpperCase()];
    if (detalleComun) return detalleComun;

    return raw;
  }

  private formatAccionHttp(method: string, path: string): string {
    const cleanPath = (path || '').split('?')[0].replace(/^\/api/i, '');
    const seccionMatch = cleanPath.match(/\/usuarios\/me\/completar-registro\/seccion\/([^/\s]+)/i);
    if (seccionMatch) {
      return `Guardó la sección ${this.nombreSeccion(seccionMatch[1])}`;
    }

    if (/\/usuarios\/me$/i.test(cleanPath)) return 'Actualizó su perfil';
    if (/\/usuarios/i.test(cleanPath)) return this.verboHttp(method, 'usuario');
    if (/\/documentos/i.test(cleanPath)) return method === 'DELETE' ? 'Eliminó un documento' : 'Cargó o actualizó documentos';
    if (/\/postulaciones/i.test(cleanPath)) return this.verboHttp(method, 'postulación');
    if (/\/convocatorias/i.test(cleanPath)) return this.verboHttp(method, 'convocatoria');
    if (/\/admin/i.test(cleanPath)) return 'Realizó una acción administrativa';

    return this.verboHttp(method, 'información del sistema');
  }

  private verboHttp(method: string, objetivo: string): string {
    switch (method) {
      case 'GET': return `Consultó ${objetivo}`;
      case 'POST': return `Registró ${objetivo}`;
      case 'PUT':
      case 'PATCH': return `Actualizó ${objetivo}`;
      case 'DELETE': return `Eliminó ${objetivo}`;
      default: return `Gestionó ${objetivo}`;
    }
  }

  private nombreSeccion(slug: string): string {
    const key = this.normalizarTexto(slug).replace(/[-_\s]/g, '');
    const secciones: Record<string, string> = {
      datospersonales: 'Datos personales',
      padroninstitucional: 'Padrón institucional',
      institucion: 'Institución',
      areaconocimiento: 'Área de conocimiento',
      perfilacademico: 'Perfil académico',
      trayectoriaacademica: 'Perfil académico',
      trayectoriaprofesional: 'Trayectoria profesional',
      cursosimpartidos: 'Cursos impartidos',
      idiomas: 'Dominio de idiomas',
      aportacionescientificas: 'Aportaciones científicas',
      produccioncientifica: 'Aportaciones científicas',
      logros: 'Logros y reconocimientos',
      reconocimientos: 'Logros y reconocimientos',
      estancias: 'Estancias',
      divulgacion: 'Divulgación',
      desarrollotecnologico: 'Desarrollo tecnológico'
    };
    return secciones[key] || slug.replace(/[-_]/g, ' ');
  }

  private formatHttpStatus(status: number): string {
    if (status >= 200 && status < 300) return 'Operación realizada correctamente.';
    if (status === 400) return 'No se pudo completar: revisa los datos capturados.';
    if (status === 401) return 'No autorizado o sesión vencida.';
    if (status === 403) return 'No tiene permisos para realizar esta acción.';
    if (status === 404) return 'La información solicitada no fue encontrada.';
    if (status === 409) return 'No se pudo completar por conflicto con información existente.';
    if (status === 429) return 'Demasiados intentos. Intenta más tarde.';
    if (status >= 500) return 'Ocurrió un error interno del servidor.';
    return `Resultado del sistema: ${status}`;
  }

  private normalizarTexto(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }
  exportarExcel(): void {
    const headers = ['ID', 'Fecha', 'Categoría', 'Acción', 'Email', 'Detalle', 'IP', 'Entidad', 'Entidad ID'];
    const rows = this.items.map(i => [
      i.id,
      i.fecha,
      i.categoria,
      this.formatAccion(i.accion),
      i.usuarioEmail || '',
      this.formatDetalle(i.detalle, i.accion),
      i.ipAddress || '',
      i.entidadTipo || '',
      i.entidadId ?? ''
    ]);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    exportRowsAsXlsx(headers, rows, `auditoria_${ts}.xlsx`, 'Auditoria');
  }

  private escHtml(v: string): string {
    return (v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
