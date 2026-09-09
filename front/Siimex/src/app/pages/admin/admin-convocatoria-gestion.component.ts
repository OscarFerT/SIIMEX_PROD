import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';

interface ConvocatoriaDetalle {
  id: number;
  titulo: string;
  area?: string | null;
  fechaApertura?: string | null;
  fechaCierre?: string | null;
  vigente?: boolean;
  reglasConfigurables?: string | null;
}

interface ConvocatoriaResumen {
  id: number;
  titulo: string;
  area?: string | null;
  fechaApertura?: string | null;
  fechaCierre?: string | null;
  vigente?: boolean;
}

interface ModuloGestion {
  nombre: string;
  descripcion: string;
  icono: string;
  estado: 'activo' | 'pendiente';
  alcance: 'convocatoria' | 'general';
  moduloReglaClave?: string;
  ruta?: any[] | string;
  queryParams?: Record<string, unknown>;
}

interface ReglaConfigurable {
  clave: string;
  valor: string;
}

interface PasoOperacionSiimex {
  numero: number;
  titulo: string;
  descripcion: string;
  estado: 'COMPLETO' | 'EN_PROCESO' | 'PENDIENTE';
  evidencia: string;
}

interface OperacionSiimexResumen {
  totalSolicitudes: number;
  revisadas: number;
  aprobadas: number;
  oficios: number;
  nombramientos: number;
  apoyosEntregados: number;
  recibosValidados: number;
  pasos: PasoOperacionSiimex[];
}

@Component({
  selector: 'app-admin-convocatoria-gestion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-convocatoria-gestion.component.html',
  styleUrls: ['./admin-convocatoria-gestion.component.css']
})
export class AdminConvocatoriaGestionComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  convocatoriaId: number | null = null;
  convocatoria: ConvocatoriaDetalle | null = null;
  convocatorias: ConvocatoriaResumen[] = [];
  loading = true;
  error: string | null = null;
  loadingOperacion = false;
  operacionSiimex: OperacionSiimexResumen | null = null;

  modulos: ModuloGestion[] = [];

  ngOnInit(): void {
    const rawId = Number(this.route.snapshot.paramMap.get('id'));
    this.convocatoriaId = Number.isFinite(rawId) && rawId > 0 ? rawId : null;
    this.prepararModulos();
    if (this.convocatoriaId) {
      this.cargarConvocatoria();
    } else {
      this.cargarConvocatorias();
    }
  }

  private prepararModulos(): void {
    const id = this.convocatoriaId;
    this.modulos = [
      {
        nombre: 'Convocatorias',
        descripcion: 'Administrar configuración base de convocatorias y su visibilidad.',
        icono: 'fa-bullhorn',
        estado: 'activo',
        alcance: 'general',
        ruta: ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Revisión',
        descripcion: id
          ? 'Visualizar y revisar solicitudes recibidas por convocatoria.'
          : 'Visualizar solicitudes. Primero selecciona una convocatoria.',
        icono: 'fa-folder-open',
        estado: 'activo',
        alcance: 'convocatoria',
        ruta: id ? ['/admin/convocatorias', id, 'postulaciones'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Evaluación',
        descripcion: 'Gestionar evaluación de solicitudes, puntajes y resultados.',
        icono: 'fa-clipboard-check',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_evaluadores_activo',
        ruta: id ? ['/admin/convocatorias', id, 'evaluacion'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Comité',
        descripcion: 'Concentrar decisiones de comité y asignación de montos.',
        icono: 'fa-users-gear',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_comite_activo',
        ruta: id ? ['/admin/convocatorias', id, 'comite'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Entrega de apoyo y recibo',
        descripcion: 'Registra la entrega del apoyo económico, valida datos bancarios y recibos de pago.',
        icono: 'fa-money-bill-transfer',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_bancaria_activo',
        ruta: id ? ['/admin/convocatorias', id, 'bancaria'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Cotejo',
        descripcion: 'Control de cotejo documental y estatus final de validación.',
        icono: 'fa-list-check',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_cotejo_activo',
        ruta: id ? ['/admin/convocatorias', id, 'cotejo'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Informes finales',
        descripcion: 'Seguimiento de carga de informes parciales y finales.',
        icono: 'fa-file-signature',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_informes_activo',
        ruta: id ? ['/admin/convocatorias', id, 'informes'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Renuncia del apoyo',
        descripcion: 'Registro y trazabilidad de renuncias al apoyo otorgado.',
        icono: 'fa-file-circle-xmark',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_renuncia_activo',
        ruta: id ? ['/admin/convocatorias', id, 'renuncias'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Seguro médico',
        descripcion: 'Seguimiento y documentación relacionada con seguro médico.',
        icono: 'fa-kit-medical',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_seguro_medico_activo',
        ruta: id ? ['/admin/convocatorias', id, 'seguro-medico'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Aceptación',
        descripcion: 'Envío de correo de aceptación y documento específico para personas aceptadas.',
        icono: 'fa-envelope-circle-check',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_aceptacion_activo',
        ruta: id ? ['/admin/convocatorias', id, 'aceptacion'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Constancias y cierre final',
        descripcion: 'Carta de cierre y constancias cuando la persona finaliza el proceso.',
        icono: 'fa-certificate',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_constancias_activo',
        ruta: id ? ['/admin/convocatorias', id, 'constancias'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Actualización de estatus académico',
        descripcion: 'Control de actualización del estatus académico de la persona beneficiaria.',
        icono: 'fa-graduation-cap',
        estado: 'activo',
        alcance: 'convocatoria',
        moduloReglaClave: 'modulo_status_academico_activo',
        ruta: id ? ['/admin/convocatorias', id, 'status-academico'] : ['/admin/convocatorias/listado']
      },
      {
        nombre: 'Consultas',
        descripcion: 'Reportes y consulta consolidada de postulaciones.',
        icono: 'fa-chart-line',
        estado: 'activo',
        alcance: 'general',
        ruta: ['/admin/reportes'],
        queryParams: id ? { convocatoriaId: id } : undefined
      },
      {
        nombre: 'Usuarios',
        descripcion: 'Administración de registros, perfiles y estado de cuentas.',
        icono: 'fa-user-shield',
        estado: 'activo',
        alcance: 'general',
        ruta: ['/admin/registros']
      },
      {
        nombre: 'Instituciones de adscripción',
        descripcion: 'Catálogo, validación y alta de instituciones de adscripción.',
        icono: 'fa-school',
        estado: 'activo',
        alcance: 'general',
        ruta: ['/admin/instituciones-educativas']
      },
      {
        nombre: 'Días feriados',
        descripcion: 'Configuración de feriados para cálculo de fechas.',
        icono: 'fa-calendar-xmark',
        estado: 'activo',
        alcance: 'general',
        ruta: ['/admin/feriados']
      },
      {
        nombre: 'Folios de registro',
        descripcion: 'Prefijos configurables para folios SIIMEX-INV, SIIMEX-IND y SIIMEX-HIB.',
        icono: 'fa-hashtag',
        estado: 'activo',
        alcance: 'general',
        ruta: ['/admin/configuracion-folios']
      },
      {
        nombre: 'Lista negra',
        descripcion: 'Sanciones globales (6 meses o 1 año) para bloquear postulaciones.',
        icono: 'fa-user-slash',
        estado: 'activo',
        alcance: 'general',
        ruta: ['/admin/lista-negra']
      }
    ];
  }

  private cargarConvocatoria(): void {
    if (!this.convocatoriaId || Number.isNaN(this.convocatoriaId)) {
      this.loading = false;
      this.error = 'Convocatoria inválida.';
      return;
    }

    this.http.get<ConvocatoriaDetalle>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}`).subscribe({
      next: (data) => {
        this.convocatoria = data;
        this.aplicarEstadosModulos(data?.reglasConfigurables);
        this.loading = false;
        this.cargarOperacionSiimex();
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo cargar la convocatoria.';
        this.loading = false;
      }
    });
  }

  private cargarConvocatorias(): void {
    this.loading = true;
    this.http.get<ConvocatoriaResumen[]>(`${environment.apiBaseUrl}/admin/convocatorias`).subscribe({
      next: (data) => {
        this.convocatorias = (data || []).sort((a, b) => (a?.titulo || '').localeCompare(b?.titulo || '', 'es', { sensitivity: 'base' }));
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las convocatorias.';
        this.loading = false;
      }
    });
  }

  private cargarOperacionSiimex(): void {
    if (!this.convocatoriaId) return;
    this.loadingOperacion = true;
    this.http.get<OperacionSiimexResumen>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/operacion-siimex`).subscribe({
      next: (data) => {
        this.operacionSiimex = data;
        this.loadingOperacion = false;
      },
      error: () => {
        this.operacionSiimex = null;
        this.loadingOperacion = false;
      }
    });
  }

  private aplicarEstadosModulos(reglasRaw: string | null | undefined): void {
    const reglas = this.parseReglas(reglasRaw);
    this.modulos = (this.modulos || []).map((modulo) => {
      if (modulo.alcance !== 'convocatoria' || !modulo.moduloReglaClave) {
        return modulo;
      }
      const activo = this.moduloActivoPorRegla(reglas, modulo.moduloReglaClave);
      if (activo) {
        return {
          ...modulo,
          estado: 'activo',
          descripcion: (modulo.descripcion || '').replace(' (Desactivado en esta convocatoria)', '')
        };
      }
      const descripcionBase = (modulo.descripcion || '').replace(' (Desactivado en esta convocatoria)', '');
      return {
        ...modulo,
        estado: 'pendiente',
        descripcion: `${descripcionBase} (Desactivado en esta convocatoria)`
      };
    });
  }

  private moduloActivoPorRegla(reglas: ReglaConfigurable[], clavePrincipal: string): boolean {
    const aliasMap: Record<string, string[]> = {
      modulo_evaluadores_activo: ['modulo_evaluadores', 'requiere_evaluadores'],
      modulo_comite_activo: ['modulo_comite', 'requiere_comite'],
      modulo_cotejo_activo: ['modulo_cotejo', 'requiere_cotejo'],
      modulo_informes_activo: ['modulo_informes', 'requiere_informes'],
      modulo_bancaria_activo: ['modulo_bancaria', 'requiere_bancaria'],
      modulo_renuncia_activo: ['modulo_renuncia', 'requiere_renuncia'],
      modulo_seguro_medico_activo: ['modulo_seguro_medico', 'requiere_seguro_medico'],
      modulo_aceptacion_activo: ['modulo_aceptacion', 'requiere_aceptacion'],
      modulo_constancias_activo: ['modulo_constancias', 'requiere_constancias', 'modulo_carta_cierre_activo', 'modulo_carta_cierre', 'requiere_carta_cierre'],
      modulo_status_academico_activo: ['modulo_status_academico', 'requiere_status_academico', 'modulo_estatus_academico_activo', 'modulo_estatus_academico', 'requiere_estatus_academico']
    };
    const claves = [clavePrincipal, ...(aliasMap[clavePrincipal] || [])];
    for (const clave of claves) {
      const raw = this.buscarValorRegla(reglas, clave);
      if (raw !== null) {
        return this.parseBooleano(raw, true);
      }
    }
    return true;
  }

  private parseReglas(raw: string | null | undefined): ReglaConfigurable[] {
    if (!raw?.trim()) return [];
    try {
      const arr = JSON.parse(raw) as ReglaConfigurable[];
      return (Array.isArray(arr) ? arr : [])
        .map((r) => ({
          clave: (r?.clave || '').trim(),
          valor: (r?.valor || '').trim()
        }))
        .filter((r) => !!r.clave);
    } catch {
      return [];
    }
  }

  private buscarValorRegla(reglas: ReglaConfigurable[], clave: string): string | null {
    const key = this.normalizarClave(clave);
    for (const regla of reglas || []) {
      if (this.normalizarClave(regla.clave) === key) {
        return (regla.valor || '').trim();
      }
    }
    return null;
  }

  private parseBooleano(raw: string | null | undefined, fallback: boolean): boolean {
    if (raw == null || !raw.toString().trim()) return fallback;
    const v = raw.toString().trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    return fallback;
  }

  private normalizarClave(v: string): string {
    return (v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]+/g, '_')
      .trim();
  }

  get pasosCompletos(): number {
    return (this.operacionSiimex?.pasos || []).filter((p) => p.estado === 'COMPLETO').length;
  }

  get avanceOperacion(): number {
    const pasos = this.operacionSiimex?.pasos || [];
    if (!pasos.length) return 0;
    return Math.round((this.pasosCompletos / pasos.length) * 100);
  }

  getEstadoPasoLabel(estado: PasoOperacionSiimex['estado']): string {
    if (estado === 'COMPLETO') return 'Completo';
    if (estado === 'EN_PROCESO') return 'En proceso';
    return 'Pendiente';
  }

  getEstadoPasoClass(estado: PasoOperacionSiimex['estado']): string {
    if (estado === 'COMPLETO') return 'bg-success';
    if (estado === 'EN_PROCESO') return 'bg-warning text-dark';
    return 'bg-light text-dark border';
  }

  getIconoPaso(estado: PasoOperacionSiimex['estado']): string {
    if (estado === 'COMPLETO') return 'fa-check';
    if (estado === 'EN_PROCESO') return 'fa-clock';
    return 'fa-circle';
  }

  exportarOperacionExcel(): void {
    if (!this.operacionSiimex || !this.convocatoria) return;
    const headers = ['Punto', 'Etapa', 'Estado', 'Descripción', 'Evidencia'];
    const rows = (this.operacionSiimex.pasos || []).map((paso) => [
      paso.numero,
      paso.titulo,
      this.getEstadoPasoLabel(paso.estado),
      paso.descripcion,
      paso.evidencia
    ]);
    rows.unshift([
      '',
      'Resumen',
      `${this.avanceOperacion}%`,
      `Convocatoria: ${this.convocatoria.titulo}`,
      `Solicitudes: ${this.operacionSiimex.totalSolicitudes} | Aprobadas: ${this.operacionSiimex.aprobadas} | Recibos validados: ${this.operacionSiimex.recibosValidados}`
    ]);
    const nombre = (this.convocatoria.titulo || 'convocatoria').replace(/\W/g, '_');
    exportRowsAsXlsx(headers, rows, `seguimiento_siimex_${nombre}_${this.timestamp()}.xlsx`, 'Seguimiento SIIMEX');
  }

  imprimirOperacion(): void {
    window.print();
  }

  private parseFechaLocal(s: string): Date | null {
    const value = String(s).trim();
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!match) return null;
    const [, y, m, d, hh = '00', mm = '00'] = match;
    const fecha = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    return isNaN(fecha.getTime()) ? null : fecha;
  }

  formatearFecha(s: string | null | undefined): string {
    if (!s) return '—';
    try {
      const d = this.parseFechaLocal(s);
      return d ? d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : s;
    } catch {
      return s;
    }
  }
  private timestamp(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }
}




