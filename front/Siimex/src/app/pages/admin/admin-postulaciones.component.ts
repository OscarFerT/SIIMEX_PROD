import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';

export interface PostulacionItem {
  id: number;
  folio?: string | null;
  nombre: string;
  correo: string;
  cedula?: string;
  curp?: string;
  telefono?: string;
  tipoApoyo?: string;
  tipoSolicitud?: string;
  fechaEvento?: string | null;
  tituloProyecto?: string;
  descripcionProyecto?: string;
  observaciones?: string;
  observacionesRevision?: string | null;
  fechaRevision?: string | null;
  fechaLimiteCorreccion?: string | null;
  evaluadorEmail?: string | null;
  fechaAsignacionEvaluador?: string | null;
  resultadoEvaluacion?: 'APROBADA' | 'NO_APROBADA' | null;
  puntajeEvaluacion?: number | null;
  comentariosEvaluacion?: string | null;
  fechaEvaluacion?: string | null;
  criteriosJson?: string;
  fechaCreacion: string;
  estado: string;
  compatibilidad: number;
  tieneCurriculum: boolean;
  curriculumDocumentoId?: number | null;
  curriculumNombreArchivo?: string | null;
  fotoDocumentoId?: number | null;
  fotoUrl?: string | SafeResourceUrl | null;
  documentosAdjuntos?: Array<{ clave: string; documentoId: number; nombreArchivo: string }>;
}

interface RegistroEvaluadorOption {
  id: number;
  nombre: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  email: string | null;
  areaNombre?: string | null;
  campoNombre?: string | null;
  disciplinaNombre?: string | null;
  subdisciplinaNombre?: string | null;
  roles?: string[];
  esEvaluador?: boolean;
}

interface ReglaConfigurable {
  clave: string;
  valor: string;
  descripcion?: string;
}

@Component({
  selector: 'app-admin-postulaciones',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-postulaciones.component.html',
  styleUrls: ['./admin-postulaciones.component.css']
})
export class AdminPostulacionesComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  convocatoriaId: number | null = null;
  convocatoriaTitulo = '';
  loading = true;
  error: string | null = null;
  postulaciones: PostulacionItem[] = [];
  postulacionSeleccionadaId: number | null = null;
  filtroTipoApoyo = '';
  evaluadoresDisponibles: RegistroEvaluadorOption[] = [];
  private falloCargaEvaluadores = false;
  private evaluadoresDesdeEndpoint = false;
  private readonly apiBase = environment.apiBaseUrl || 'http://localhost:8083';
  plazoCorreccionHorasDefault = 120;
  plazoCorreccionHorasMin = 24;
  plazoCorreccionHorasMax = 720;

  ngOnInit(): void {
    this.convocatoriaId = +this.route.snapshot.paramMap.get('id')!;
    this.cargarConvocatoria();
    this.cargarPostulaciones();
  }

  private cargarConvocatoria(): void {
    this.http.get<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}`).subscribe({
      next: (c) => {
        this.convocatoriaTitulo = c.titulo || 'Convocatoria';
        this.aplicarReglasPlazoCorreccion(c?.reglasConfigurables);
      },
      error: () => { this.convocatoriaTitulo = 'Convocatoria'; }
    });
  }

  cargarPostulaciones(): void {
    this.loading = true;
    this.error = null;
    this.http.get<PostulacionItem[]>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones`).subscribe({
      next: (data) => {
        this.postulaciones = data;
        if (this.postulacionSeleccionadaId != null && !data.some((p) => p.id === this.postulacionSeleccionadaId)) {
          this.postulacionSeleccionadaId = null;
        }
        data.filter(p => p.fotoDocumentoId).forEach(p => this.cargarFoto(p));
        this.cargarEvaluadoresRegistrados();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las postulaciones.';
        this.loading = false;
      }
    });
  }

  private cargarEvaluadoresRegistrados(): void {
    this.falloCargaEvaluadores = false;
    this.http.get<RegistroEvaluadorOption[]>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/evaluadores-disponibles`).subscribe({
      next: (data) => {
        this.evaluadoresDesdeEndpoint = true;
        this.evaluadoresDisponibles = this.filtrarNoPostulantes((data || [])
          .filter((r) => !!r.email)
          .sort((a, b) => this.getLabelEvaluador(a).localeCompare(this.getLabelEvaluador(b), 'es', { sensitivity: 'base' })));
      },
      error: () => {
        this.evaluadoresDesdeEndpoint = false;
        this.cargarEvaluadoresFallback();
      }
    });
  }

  private cargarEvaluadoresFallback(): void {
    this.http.get<RegistroEvaluadorOption[]>(`${environment.apiBaseUrl}/admin/registros`).subscribe({
      next: (data) => {
        this.evaluadoresDisponibles = this.filtrarNoPostulantes((data || [])
          .filter((r) => !!r.email)
          .sort((a, b) => this.getLabelEvaluador(a).localeCompare(this.getLabelEvaluador(b), 'es', { sensitivity: 'base' })));
      },
      error: () => {
        this.evaluadoresDisponibles = [];
        this.falloCargaEvaluadores = true;
      }
    });
  }

  get tiposApoyoDisponibles(): string[] {
    const tipos = this.postulaciones
      .map((p) => (p.tipoApoyo || 'No especificado').trim())
      .filter(Boolean);
    return Array.from(new Set(tipos)).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  get postulacionesFiltradas(): PostulacionItem[] {
    const tipo = this.normalizar(this.filtroTipoApoyo);
    if (!tipo) return this.postulaciones;
    return this.postulaciones.filter((p) => this.normalizar(p.tipoApoyo || 'No especificado') === tipo);
  }

  get postulacionSeleccionada(): PostulacionItem | null {
    if (this.postulacionSeleccionadaId == null) return null;
    return this.postulaciones.find((p) => p.id === this.postulacionSeleccionadaId) || null;
  }

  limpiarFiltroTipoApoyo(): void {
    this.filtroTipoApoyo = '';
  }

  seleccionarPostulacion(p: PostulacionItem): void {
    this.postulacionSeleccionadaId = p.id;
  }

  estaSeleccionada(p: PostulacionItem): boolean {
    return this.postulacionSeleccionadaId === p.id;
  }

  verDetalleSeleccionada(): void {
    const p = this.obtenerPostulacionSeleccionada();
    if (!p) return;
    this.verDetalle(p);
  }

  asignarEvaluadorSeleccionada(): void {
    const p = this.obtenerPostulacionSeleccionada();
    if (!p) return;
    this.asignarEvaluador(p);
  }

  aprobarSeleccionada(): void {
    const p = this.obtenerPostulacionSeleccionada();
    if (!p || p.estado === 'ACEPTADA') return;
    this.aprobar(p);
  }

  marcarRevisadaSeleccionada(): void {
    const p = this.obtenerPostulacionSeleccionada();
    if (!p || p.estado === 'REVISADA') return;
    this.marcarRevisada(p);
  }

  solicitarCorreccionesSeleccionada(): void {
    const p = this.obtenerPostulacionSeleccionada();
    if (!p) return;
    this.solicitarCorrecciones(p);
  }

  regresarPendienteSeleccionada(): void {
    const p = this.obtenerPostulacionSeleccionada();
    if (!p || p.estado === 'PENDIENTE') return;
    this.regresarPendiente(p);
  }

  rechazarSeleccionada(): void {
    const p = this.obtenerPostulacionSeleccionada();
    if (!p || p.estado === 'RECHAZADA') return;
    this.rechazar(p);
  }

  eliminarSeleccionada(): void {
    const p = this.obtenerPostulacionSeleccionada();
    if (!p) return;
    this.eliminar(p);
  }

  puedePasarASeleccion(p: PostulacionItem | null | undefined): boolean {
    const estado = (p?.estado || '').toUpperCase();
    return estado === 'REVISADA' || estado === 'ACEPTADA' || estado === 'RECHAZADA';
  }

  private obtenerPostulacionSeleccionada(): PostulacionItem | null {
    const p = this.postulacionSeleccionada;
    if (!p) {
      Swal.fire({
        icon: 'info',
        title: 'Selecciona una postulación',
        text: 'Primero selecciona una fila en la tabla para ejecutar una acción.',
        confirmButtonColor: '#800020'
      });
      return null;
    }
    return p;
  }

  verDetalle(p: PostulacionItem): void {
    const comp = p.compatibilidad ?? 0;
    const compClass = comp >= 70 ? 'swal-compat-high' : comp >= 40 ? 'swal-compat-medium' : 'swal-compat-low';

    const criterios = this.parseCriterios(p.criteriosJson);
    const criteriosHtml = criterios.length
      ? criterios.map(c => `<li><span class="swal-criterio-key">${this.escapeHtml(c.clave)}</span> ${this.escapeHtml(c.valor)}</li>`).join('')
      : '<li class="text-muted">Sin respuestas de criterios.</li>';

    const cvHtml = p.tieneCurriculum
      ? `
          <div class="swal-doc-adjunto d-flex align-items-center justify-content-between gap-2 mb-2">
            <span class="swal-doc-label">Currículum vitae ${p.curriculumNombreArchivo ? `(${this.escapeHtml(p.curriculumNombreArchivo)})` : ''}</span>
            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary swal-view-doc" data-doc-id="${p.curriculumDocumentoId}" data-filename="${this.escapeHtml(p.curriculumNombreArchivo || 'curriculum.pdf')}">
                <i class="fas fa-eye me-1"></i>Visualizar
              </button>
              <button type="button" class="btn btn-sm btn-outline-primary swal-dl-doc" data-doc-id="${p.curriculumDocumentoId}" data-filename="${this.escapeHtml(p.curriculumNombreArchivo || 'curriculum.pdf')}">
                <i class="fas fa-download me-1"></i>Descargar
              </button>
            </div>
          </div>
        `
      : '<span class="swal-badge swal-badge-neutral"><i class="fas fa-file me-1"></i>Sin CV adjunto</span>';

    const docsAdjuntos = (p as PostulacionItem).documentosAdjuntos || [];
    const adjuntosHtml = docsAdjuntos.length
      ? docsAdjuntos.map(d => `
          <div class="swal-doc-adjunto d-flex align-items-center justify-content-between gap-2 mb-2">
            <span class="swal-doc-label">${this.escapeHtml(d.clave.replace(/_/g, ' '))}</span>
            <div class="d-flex align-items-center gap-2">
              <button type="button" class="btn btn-sm btn-outline-secondary swal-view-doc" data-doc-id="${d.documentoId}" data-filename="${this.escapeHtml(d.nombreArchivo || 'documento')}">
                <i class="fas fa-eye me-1"></i>Visualizar
              </button>
              <button type="button" class="btn btn-sm btn-outline-primary swal-dl-doc" data-doc-id="${d.documentoId}" data-filename="${this.escapeHtml(d.nombreArchivo || 'documento')}">
                <i class="fas fa-download me-1"></i>Descargar
              </button>
            </div>
          </div>
        `).join('')
      : '';

    const estadoClass =
      p.estado === 'REVISADA' || p.estado === 'ACEPTADA'
        ? 'swal-estado-ok'
        : p.estado === 'RECHAZADA'
          ? 'swal-estado-no'
          : p.estado === 'CON_OBSERVACIONES'
            ? 'swal-estado-pend'
            : p.estado === 'SUBSANADA'
              ? 'swal-estado-info'
              : 'swal-estado-pend';
    const folio = p.folio || `SOL-${p.id}`;
    const tipoApoyo = p.tipoApoyo || 'No especificado';
    const tipoSolicitud = p.tipoSolicitud || 'NACIONAL';
    const fechaEvento = this.formatearFechaSimple(p.fechaEvento);

    Swal.fire({
      customClass: { popup: 'swal-detalle-postulacion' },
      title: `Solicitud ${this.escapeHtml(folio)}`,
      html: `
        <div class="swal-detalle-body">
          <div class="swal-grid-info">
            <div class="swal-info-item">
              <i class="fas fa-user swal-icon"></i>
              <div>
                <span class="swal-label">Nombre</span>
                <span class="swal-valor">${this.escapeHtml(p.nombre || '—')}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-envelope swal-icon"></i>
              <div>
                <span class="swal-label">Correo</span>
                <span class="swal-valor">${this.escapeHtml(p.correo || '—')}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-id-card swal-icon"></i>
              <div>
                <span class="swal-label">Cédula</span>
                <span class="swal-valor">${this.escapeHtml(p.cedula || '—')}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-fingerprint swal-icon"></i>
              <div>
                <span class="swal-label">CURP</span>
                <span class="swal-valor">${this.escapeHtml(p.curp || '—')}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-phone swal-icon"></i>
              <div>
                <span class="swal-label">Teléfono</span>
                <span class="swal-valor">${this.escapeHtml(p.telefono || '—')}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-hashtag swal-icon"></i>
              <div>
                <span class="swal-label">Folio</span>
                <span class="swal-valor">${this.escapeHtml(folio)}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-layer-group swal-icon"></i>
              <div>
                <span class="swal-label">Tipo de apoyo</span>
                <span class="swal-valor">${this.escapeHtml(tipoApoyo)}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-globe swal-icon"></i>
              <div>
                <span class="swal-label">Tipo de solicitud</span>
                <span class="swal-valor">${this.escapeHtml(tipoSolicitud)}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-calendar-day swal-icon"></i>
              <div>
                <span class="swal-label">Fecha del evento</span>
                <span class="swal-valor">${this.escapeHtml(fechaEvento)}</span>
              </div>
            </div>
            <div class="swal-info-item">
              <i class="fas fa-calendar swal-icon"></i>
              <div>
                <span class="swal-label">Fecha</span>
                <span class="swal-valor">${this.escapeHtml(this.formatearFecha(p.fechaCreacion))}</span>
              </div>
            </div>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-chart-line me-2"></i>Compatibilidad</div>
            <div class="swal-compat-wrap">
              <div class="swal-compat-bar">
                <div class="swal-compat-fill ${compClass}" style="width:${comp}%"></div>
              </div>
              <span class="swal-compat-valor ${compClass}">${comp}%</span>
            </div>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-tag me-2"></i>Estado</div>
            <span class="swal-estado-badge ${estadoClass}">${this.escapeHtml(p.estado || '—')}</span>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-diagram-project me-2"></i>Proyecto</div>
            <p class="swal-observaciones"><strong>${this.escapeHtml(p.tituloProyecto || '—')}</strong></p>
            <p class="swal-observaciones">${this.escapeHtml(p.descripcionProyecto || 'Sin descripción')}</p>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-comment-dots me-2"></i>Observaciones</div>
            <p class="swal-observaciones">${this.escapeHtml(p.observaciones || 'Sin observaciones')}</p>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-comments me-2"></i>Observaciones de revisión</div>
            <p class="swal-observaciones">${this.escapeHtml(p.observacionesRevision || 'Sin observaciones de revisión')}</p>
            <p class="swal-observaciones"><strong>Fecha límite de corrección:</strong> ${this.escapeHtml(this.formatearFecha(p.fechaLimiteCorreccion))}</p>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-user-check me-2"></i>Evaluador asignado</div>
            <p class="swal-observaciones">${this.escapeHtml(p.evaluadorEmail || 'Sin asignar')}</p>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-clipboard-check me-2"></i>Evaluacion</div>
            <p class="swal-observaciones"><strong>Resultado:</strong> ${this.escapeHtml(p.resultadoEvaluacion || 'Pendiente')}</p>
            <p class="swal-observaciones"><strong>Puntaje:</strong> ${this.escapeHtml(String(p.puntajeEvaluacion ?? '—'))}</p>
            <p class="swal-observaciones"><strong>Fecha:</strong> ${this.escapeHtml(this.formatearFecha(p.fechaEvaluacion))}</p>
            <p class="swal-observaciones"><strong>Comentarios:</strong> ${this.escapeHtml(p.comentariosEvaluacion || 'Sin comentarios')}</p>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-list-check me-2"></i>Criterios respondidos</div>
            <ul class="swal-criterios-lista">${criteriosHtml}</ul>
          </div>

          <div class="swal-seccion">
            <div class="swal-seccion-titulo"><i class="fas fa-paperclip me-2"></i>Documentos</div>
            <div class="swal-docs">${cvHtml}</div>
            ${adjuntosHtml ? `<div class="swal-adjuntos mt-2">${adjuntosHtml}</div>` : ''}
          </div>
        </div>
      `,
      width: 520,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      confirmButtonText: p.tieneCurriculum ? 'Visualizar CV' : 'Entendido',
      confirmButtonColor: '#7A1E48',
      cancelButtonColor: '#6c757d',
      buttonsStyling: true,
      didOpen: (popup) => {
        popup.querySelectorAll('.swal-view-doc').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-doc-id');
            const fn = btn.getAttribute('data-filename');
            if (id) this.visualizarDocumentoById(Number(id), fn || 'documento');
          });
        });
        popup.querySelectorAll('.swal-dl-doc').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-doc-id');
            const fn = btn.getAttribute('data-filename');
            if (id) this.descargarDocumentoById(Number(id), fn || 'documento');
          });
        });
      }
    }).then((res) => {
      if (res.isConfirmed && p.tieneCurriculum && p.curriculumDocumentoId) {
        this.visualizarDocumentoById(
          p.curriculumDocumentoId,
          p.curriculumNombreArchivo || `curriculum_postulacion_${p.id}.pdf`
        );
      }
    });
  }

  descargarDocumentoById(documentoId: number, nombreArchivo: string): void {
    this.http.get(`${this.apiBase}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombreArchivo || `documento_${documentoId}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      },
      error: () => {}
    });
  }

  visualizarDocumentoById(documentoId: number, nombreArchivo: string): void {
    this.http.get(`${this.apiBase}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (!w) {
          Swal.fire({
            icon: 'warning',
            title: 'No se pudo abrir la vista',
            text: `El navegador bloqueó la pestaña emergente para ${nombreArchivo}.`,
            confirmButtonColor: '#800020'
          });
        }
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'No se pudo visualizar el documento.',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  descargarCurriculum(p: PostulacionItem): void {
    if (!p.curriculumDocumentoId) return;
    this.http.get(`${this.apiBase}/documentos/${p.curriculumDocumentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = p.curriculumNombreArchivo || `curriculum_postulacion_${p.id}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'No se pudo descargar el CV.',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  private parseCriterios(raw: string | undefined): Array<{ clave: string; valor: string }> {
    if (!raw?.trim()) return [];
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(obj).map(([k, v]) => ({
        clave: k,
        valor: this.formatValorCriterio(v)
      }));
    } catch {
      return [{ clave: 'criteriosJson', valor: raw }];
    }
  }

  private formatValorCriterio(v: unknown): string {
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (v === null || v === undefined) return '—';
    return String(v);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  marcarRevisada(p: PostulacionItem): void {
    if (p.estado === 'REVISADA') return;
    Swal.fire({
      icon: 'question',
      title: '¿Marcar como revisada?',
      html: `La solicitud de <strong>${p.nombre || p.correo}</strong> pasará a estado <strong>REVISADA</strong>.`,
      showCancelButton: true,
      confirmButtonColor: '#800020',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/revisar`, {}).subscribe({
          next: () => {
            this.cargarPostulaciones();
            Swal.fire({ icon: 'success', title: 'Revisada', text: 'La solicitud quedó marcada como revisada.', confirmButtonColor: '#800020' });
          },
          error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo actualizar.', confirmButtonColor: '#800020' })
        });
      }
    });
  }

  aprobar(p: PostulacionItem): void {
    if (p.estado === 'ACEPTADA') return;
    Swal.fire({
      icon: 'question',
      title: '¿Aprobar postulación?',
      html: `La solicitud de <strong>${p.nombre || p.correo}</strong> pasará a estado <strong>ACEPTADA</strong>.`,
      showCancelButton: true,
      confirmButtonColor: '#198754',
      confirmButtonText: 'Aprobar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/aceptar`, {}).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Aprobada', text: 'La solicitud quedó aprobada.', confirmButtonColor: '#800020' });
        },
        error: (err) => Swal.fire({ icon: 'error', title: 'No se pudo aprobar', text: this.getErrorMessage(err, 'No se pudo aprobar la solicitud.'), confirmButtonColor: '#800020' })
      });
    });
  }

  solicitarCorrecciones(p: PostulacionItem): void {
    const ahora = new Date();
    const minPermitido = new Date(ahora.getTime() + this.plazoCorreccionHorasMin * 60 * 60 * 1000);
    const maxPermitido = new Date(ahora.getTime() + this.plazoCorreccionHorasMax * 60 * 60 * 1000);

    const horasDefault = this.calcularHorasRestantes(p.fechaLimiteCorreccion) || this.plazoCorreccionHorasDefault;
    const limiteDefault = new Date(ahora.getTime() + horasDefault * 60 * 60 * 1000);
    const limiteInicial = this.ajustarRangoFecha(limiteDefault, minPermitido, maxPermitido);

    const inicialLocal = this.toDatetimeLocalValue(limiteInicial);
    const minimoLocal = this.toDatetimeLocalValue(minPermitido);
    const maximoLocal = this.toDatetimeLocalValue(maxPermitido);
    const inicialFecha = inicialLocal.slice(0, 10);
    const inicialHora = inicialLocal.slice(11, 16);
    const minFecha = minimoLocal.slice(0, 10);
    const maxFecha = maximoLocal.slice(0, 10);
    const minHora = minimoLocal.slice(11, 16);
    const maxHora = maximoLocal.slice(11, 16);
    Swal.fire({
      title: 'Observaciones para corrección',
      html: `
        <div class="text-start">
          <label for="swal-obs" class="form-label small fw-semibold mb-1">Observaciones para ${this.escapeHtml(p.nombre || p.correo)}</label>
          <textarea id="swal-obs" class="swal2-textarea mt-0" maxlength="2000" placeholder="Describe qué debe corregir el postulante...">${this.escapeHtml(p.observacionesRevision || '')}</textarea>
          <label for="swal-limite-fecha" class="form-label small fw-semibold mb-1">Fecha límite de edición</label>
          <input id="swal-limite-fecha" type="date" class="swal2-input mt-0 mb-2" min="${minFecha}" max="${maxFecha}" value="${inicialFecha}" />
          <label for="swal-limite-hora" class="form-label small fw-semibold mb-1">Hora límite de edición</label>
          <input id="swal-limite-hora" type="time" class="swal2-input mt-0 mb-1" value="${inicialHora}" step="60" />
          <small class="text-muted d-block">Rango permitido: ${this.plazoCorreccionHorasMin} a ${this.plazoCorreccionHorasMax} horas desde ahora.</small>
          <small class="text-muted d-block">En día mínimo (${minFecha}) no puede ser antes de ${minHora}; en día máximo (${maxFecha}) no puede ser después de ${maxHora}.</small>
          <small class="text-muted d-block">Mínimo: ${this.formatearFecha(minPermitido.toISOString())} · Máximo: ${this.formatearFecha(maxPermitido.toISOString())}</small>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar observaciones',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const obsEl = document.getElementById('swal-obs') as HTMLTextAreaElement | null;
        const fechaEl = document.getElementById('swal-limite-fecha') as HTMLInputElement | null;
        const horaEl = document.getElementById('swal-limite-hora') as HTMLInputElement | null;
        const v = (obsEl?.value || '').trim();
        const fechaRaw = (fechaEl?.value || '').trim();
        const horaRaw = (horaEl?.value || '').trim();
        const limiteRaw = fechaRaw && horaRaw ? `${fechaRaw}T${horaRaw}` : '';
        if (!v) {
          Swal.showValidationMessage('Debes escribir observaciones');
          return false;
        }
        const limiteFecha = this.parseDatetimeLocal(limiteRaw);
        if (!limiteFecha) {
          Swal.showValidationMessage('Debes capturar una fecha y hora límite válidas');
          return false;
        }
        const diffMs = limiteFecha.getTime() - Date.now();
        if (diffMs <= 0) {
          Swal.showValidationMessage('La fecha y hora límite debe ser mayor a la actual');
          return false;
        }
        const horas = Math.ceil(diffMs / (1000 * 60 * 60));
        if (horas < this.plazoCorreccionHorasMin || horas > this.plazoCorreccionHorasMax) {
          Swal.showValidationMessage(`La fecha/hora seleccionada equivale a ${horas} horas. Debe estar entre ${this.plazoCorreccionHorasMin} y ${this.plazoCorreccionHorasMax} horas.`);
          return false;
        }
        return { observaciones: v, plazoHoras: Math.trunc(horas), fechaLimiteCorreccion: limiteRaw };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/observaciones`, {
        observaciones: res.value.observaciones,
        plazoHoras: res.value.plazoHoras,
        fechaLimiteCorreccion: res.value.fechaLimiteCorreccion
      }).subscribe({
        next: (resp) => {
          this.cargarPostulaciones();
          const limite = this.formatearFecha(resp?.fechaLimiteCorreccion);
          Swal.fire({
            icon: 'success',
            title: 'Con observaciones',
            text: `La solicitud fue marcada para corrección. Fecha límite: ${limite}.`,
            confirmButtonColor: '#800020'
          });
        },
        error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo guardar observaciones.', confirmButtonColor: '#800020' })
      });
    });
  }

  regresarPendiente(p: PostulacionItem): void {
    if (p.estado === 'PENDIENTE') return;
    Swal.fire({
      icon: 'question',
      title: '¿Regresar a pendiente?',
      html: `La solicitud de <strong>${p.nombre || p.correo}</strong> pasará a estado <strong>PENDIENTE</strong>.`,
      showCancelButton: true,
      confirmButtonColor: '#6c757d',
      confirmButtonText: 'Sí, regresar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;
      const url = `${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/pendiente`;
      this.http.post<any>(url, null).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Pendiente', text: 'La solicitud regresó a pendiente.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          if (err?.status === 404 || err?.status === 405) {
            this.http.patch<any>(url, {}).subscribe({
              next: () => {
                this.cargarPostulaciones();
                Swal.fire({ icon: 'success', title: 'Pendiente', text: 'La solicitud regresó a pendiente.', confirmButtonColor: '#800020' });
              },
              error: (err2) => Swal.fire({ icon: 'error', title: 'Error', text: this.getErrorMessage(err2, 'No se pudo actualizar.'), confirmButtonColor: '#800020' })
            });
            return;
          }
          Swal.fire({ icon: 'error', title: 'Error', text: this.getErrorMessage(err, 'No se pudo actualizar.'), confirmButtonColor: '#800020' });
        }
      });
    });
  }

  rechazar(p: PostulacionItem): void {
    if (p.estado === 'RECHAZADA') return;
    Swal.fire({
      icon: 'warning',
      title: '¿Rechazar postulación?',
      html: `Se rechazará la solicitud de <strong>${p.nombre || p.correo}</strong>. Puedes agregar motivo de rechazo.`,
      input: 'textarea',
      inputLabel: 'Motivo (opcional)',
      inputValue: p.observacionesRevision || '',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Rechazar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/rechazar`, {
          motivo: (res.value || '').toString().trim()
        }).subscribe({
          next: () => {
            this.cargarPostulaciones();
            Swal.fire({ icon: 'success', title: 'Rechazada', text: 'La solicitud fue rechazada.', confirmButtonColor: '#800020' });
          },
          error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo rechazar.', confirmButtonColor: '#800020' })
        });
      }
    });
  }

  eliminar(p: PostulacionItem): void {
    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar postulación?',
      html: `Se eliminará permanentemente la postulación de <strong>${p.nombre || p.correo}</strong>. Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.http.delete<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}`).subscribe({
          next: () => {
            this.cargarPostulaciones();
            Swal.fire({ icon: 'success', title: 'Eliminada', text: 'La postulación fue eliminada.', confirmButtonColor: '#800020' });
          },
          error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo eliminar.', confirmButtonColor: '#800020' })
        });
      }
    });
  }

  formatearFecha(s: string | null | undefined): string {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return s || '—';
    }
  }

  getEstadoBadgeClass(estado: string): string {
    if (estado === 'ACEPTADA' || estado === 'REVISADA') return 'bg-success';
    if (estado === 'RECHAZADA') return 'bg-danger';
    if (estado === 'CON_OBSERVACIONES') return 'bg-warning text-dark';
    if (estado === 'SUBSANADA') return 'bg-info text-dark';
    return 'bg-warning text-dark';
  }

  asignarEvaluador(p: PostulacionItem): void {
    const options: Record<string, string> = {};
    this.evaluadoresDisponibles.forEach((r) => {
      const email = (r.email || '').trim().toLowerCase();
      if (!email) return;
      options[email] = this.getLabelEvaluador(r);
    });
    const current = (p.evaluadorEmail || '').trim().toLowerCase();
    if (current && !options[current]) {
      options[current] = `${current} (asignado actualmente)`;
    }
    if (Object.keys(options).length === 0) {
      if (this.falloCargaEvaluadores) {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo cargar la lista',
          html: 'No fue posible obtener candidatos para evaluación.<br><small class="text-muted">Verifica que backend y frontend estén actualizados y reiniciados.</small>',
          confirmButtonColor: '#800020'
        });
        return;
      }
      Swal.fire({
        icon: 'warning',
        title: 'Sin personas elegibles',
      html: 'No hay personas disponibles para evaluar esta convocatoria.<br><small class="text-muted">Solo se muestran personas registradas activas que no participan como postulantes en esta misma convocatoria.</small>',
          confirmButtonColor: '#800020'
      });
      return;
    }
    const optionEntries = Object.entries(options);
    const renderOptionTags = (query: string): string => {
      const q = (query || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
      const filtered = optionEntries.filter(([email, label]) => {
        const emailNorm = (email || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        const labelNorm = (label || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return !q || emailNorm.includes(q) || labelNorm.includes(q);
      });
      if (filtered.length === 0) {
        return '<option value="" disabled selected>Sin coincidencias</option>';
      }
      const selectedEmail = filtered.some(([email]) => email === current) ? current : filtered[0][0];
      return filtered.map(([email, label]) => {
        const selected = email === selectedEmail ? ' selected' : '';
        return `<option value="${this.escapeHtml(email)}"${selected}>${this.escapeHtml(label)}</option>`;
      }).join('');
    };
    Swal.fire({
      title: 'Asignar evaluador',
      html: `
        <p class="small text-muted mb-2">Candidatos disponibles: <strong>${optionEntries.length}</strong></p>
        <p class="small text-muted mb-3">Solo se listan personas registradas activas que no están postuladas en esta convocatoria. Puedes buscar por nombre, correo o área de conocimiento.</p>
        <div class="text-start">
          <label for="swal-evaluador-search" class="form-label small fw-semibold mb-1">Buscar candidato</label>
          <input id="swal-evaluador-search" class="swal2-input mt-0 mb-2" placeholder="Filtra por nombre, correo o área" autocomplete="off">
          <label for="swal-evaluador-select" class="form-label small fw-semibold mb-1">Selecciona un candidato</label>
          <select id="swal-evaluador-select" class="swal2-select mt-0" size="7" style="display:block;width:100%;height:auto;max-height:16rem;">
            ${renderOptionTags('')}
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Asignar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        const searchInput = document.getElementById('swal-evaluador-search') as HTMLInputElement | null;
        const selectEl = document.getElementById('swal-evaluador-select') as HTMLSelectElement | null;
        if (!searchInput || !selectEl) return;
        searchInput.focus();
        searchInput.addEventListener('input', () => {
          const prevSelected = selectEl.value;
          selectEl.innerHTML = renderOptionTags(searchInput.value);
          if (prevSelected && Array.from(selectEl.options).some(opt => opt.value === prevSelected)) {
            selectEl.value = prevSelected;
          }
        });
      },
      preConfirm: () => {
        const selectEl = document.getElementById('swal-evaluador-select') as HTMLSelectElement | null;
        const v = (selectEl?.value || '').trim().toLowerCase();
        if (!v) {
          Swal.showValidationMessage('Debes seleccionar un evaluador');
          return false;
        }
        return v;
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/asignar-evaluador`, {
        email: res.value
      }).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Evaluador asignado', text: 'La solicitud ya tiene evaluador.', confirmButtonColor: '#800020' });
        },
        error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo asignar evaluador.', confirmButtonColor: '#800020' })
      });
    });
  }

  private getLabelEvaluador(r: RegistroEvaluadorOption): string {
    const nombreCompleto = [r.nombre, r.apellidoPaterno, r.apellidoMaterno]
      .filter(Boolean)
      .join(' ')
      .trim();
    const area = [r.areaNombre, r.campoNombre, r.disciplinaNombre]
      .filter((v) => !!v && String(v).trim().length > 0)
      .join(' / ')
      .trim();
    const email = r.email || 'sin-correo';
    const esEvaluador = !!r.esEvaluador || (Array.isArray(r.roles) && r.roles.includes('ROLE_EVALUADOR'));
    const areaChunk = area ? ` | Área: ${area}` : '';
    return `${nombreCompleto || '(Sin nombre)'} - ${email}${areaChunk}${esEvaluador ? ' [Evaluador]' : ''}`;
  }

  private filtrarNoPostulantes(items: RegistroEvaluadorOption[]): RegistroEvaluadorOption[] {
    const correosPostulantes = new Set(
      (this.postulaciones || [])
        .map((p) => this.normalizarEmail(p.correo))
        .filter((v) => !!v)
    );
    return items.filter((r) => {
      const email = this.normalizarEmail(r.email);
      return !!email && !correosPostulantes.has(email);
    });
  }

  private normalizarEmail(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
  }

  formatearFechaSimple(s: string | null | undefined): string {
    if (!s) return '—';
    try {
      const d = new Date(`${s}T00:00:00`);
      return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return s || '—';
    }
  }

  getCompatibilidadClass(porcentaje: number): string {
    if (porcentaje >= 70) return 'text-success fw-bold';
    if (porcentaje >= 40) return 'text-warning fw-bold';
    return 'text-secondary';
  }

  getCompatibilidadBarClass(porcentaje: number): string {
    if (porcentaje >= 70) return 'post-compat-fill-high';
    if (porcentaje >= 40) return 'post-compat-fill-medium';
    return 'post-compat-fill-low';
  }

  getInicial(p: PostulacionItem): string {
    const n = (p.nombre || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  getFotoUrl(p: PostulacionItem): string | SafeResourceUrl {
    return p.fotoUrl || '';
  }

  private cargarFoto(p: PostulacionItem): void {
    if (!p.fotoDocumentoId) return;
    this.http.get(`${this.apiBase}/documentos/${p.fotoDocumentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        p.fotoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        this.cdr.detectChanges();
      },
      error: () => { p.fotoUrl = null; this.cdr.detectChanges(); }
    });
  }

  exportarExcel(): void {
    const data = this.postulacionesFiltradas;
    const headers = ['ID', 'Folio', 'Tipo de solicitud', 'Tipo de apoyo', 'Fecha evento', 'Postulante', 'Correo', 'Evaluador', 'Resultado evaluación', 'Puntaje evaluación', 'Fecha evaluación', 'Cédula', 'CURP', 'Teléfono', 'Estado', 'Compatibilidad', 'Fecha alta'];
    const rows = data.map(p => [
      p.id,
      p.folio || `SOL-${p.id}`,
      p.tipoSolicitud || 'NACIONAL',
      p.tipoApoyo || 'No especificado',
      this.formatearFechaSimple(p.fechaEvento),
      p.nombre || '',
      p.correo || '',
      p.evaluadorEmail || '',
      p.resultadoEvaluacion || '',
      p.puntajeEvaluacion ?? '',
      this.formatearFecha(p.fechaEvaluacion),
      p.cedula || '',
      p.curp || '',
      p.telefono || '',
      p.estado || '',
      `${p.compatibilidad ?? 0}%`,
      this.formatearFecha(p.fechaCreacion)
    ]);
    exportRowsAsXlsx(
      headers,
      rows,
      `postulaciones_${this.convocatoriaTitulo.replace(/\W/g, '_')}_${this.timestamp()}.xlsx`,
      'Postulaciones'
    );
  }

  exportarPdf(): void {
    const data = this.postulacionesFiltradas;
    const rows = data.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${this.html(p.folio || `SOL-${p.id}`)}</td>
        <td>${this.html(p.tipoSolicitud || 'NACIONAL')}</td>
        <td>${this.html(p.tipoApoyo || 'No especificado')}</td>
        <td>${this.html(this.formatearFechaSimple(p.fechaEvento))}</td>
        <td>${this.html(p.nombre || '—')}</td>
        <td>${this.html(p.correo || '—')}</td>
        <td>${this.html(p.evaluadorEmail || '—')}</td>
        <td>${this.html(p.resultadoEvaluacion || '—')}</td>
        <td>${this.html(String(p.puntajeEvaluacion ?? '—'))}</td>
        <td>${this.html(this.formatearFecha(p.fechaEvaluacion))}</td>
        <td>${this.html(p.estado || '')}</td>
        <td>${p.compatibilidad ?? 0}%</td>
        <td>${this.html(this.formatearFecha(p.fechaCreacion))}</td>
      </tr>
    `).join('');
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Postulaciones - ${this.convocatoriaTitulo}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0 0 8px; color: #6a0032; }
    .meta { margin: 0 0 14px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>Postulaciones: ${this.html(this.convocatoriaTitulo)}</h1>
  <p class="meta">Generado: ${new Date().toLocaleString('es-MX')} | Total: ${data.length}</p>
  <table>
    <thead><tr><th>ID</th><th>Folio</th><th>Tipo solicitud</th><th>Tipo apoyo</th><th>Evento</th><th>Postulante</th><th>Correo</th><th>Evaluador</th><th>Resultado eval.</th><th>Puntaje eval.</th><th>Fecha eval.</th><th>Estado</th><th>Compat.</th><th>Fecha</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="14">Sin datos</td></tr>'}</tbody>
  </table>
</body>
</html>`;
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  private html(v: string): string {
    return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  private getErrorMessage(err: any, fallback: string): string {
    const message = err?.error?.message || err?.error?.error || err?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (typeof err?.status === 'number') return `${fallback} (HTTP ${err.status})`;
    return fallback;
  }

  private calcularHorasRestantes(fechaLimite: string | null | undefined): number | null {
    if (!fechaLimite) return null;
    const limite = new Date(fechaLimite);
    if (isNaN(limite.getTime())) return null;
    const diffMs = limite.getTime() - Date.now();
    if (diffMs <= 0) return null;
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
  }

  private aplicarReglasPlazoCorreccion(reglasRaw: string | null | undefined): void {
    const reglas = this.parseReglas(reglasRaw);
    const min = this.obtenerNumeroRegla(reglas, ['plazo_correccion_horas_min']);
    const max = this.obtenerNumeroRegla(reglas, ['plazo_correccion_horas_max']);
    const def = this.obtenerNumeroRegla(reglas, ['plazo_correccion_horas_default', 'plazo_correccion_horas']);

    if (Number.isFinite(min) && min! >= 1) {
      this.plazoCorreccionHorasMin = Math.trunc(min!);
    }
    if (Number.isFinite(max) && max! >= this.plazoCorreccionHorasMin) {
      this.plazoCorreccionHorasMax = Math.trunc(max!);
    }
    if (Number.isFinite(def)) {
      const candidato = Math.trunc(def!);
      this.plazoCorreccionHorasDefault = Math.min(this.plazoCorreccionHorasMax, Math.max(this.plazoCorreccionHorasMin, candidato));
    }
  }

  private parseReglas(raw: string | null | undefined): ReglaConfigurable[] {
    if (!raw?.trim()) return [];
    try {
      const arr = JSON.parse(raw) as ReglaConfigurable[];
      return (Array.isArray(arr) ? arr : [])
        .map((r) => ({
          clave: (r?.clave || '').trim(),
          valor: (r?.valor || '').trim(),
          descripcion: (r?.descripcion || '').trim()
        }))
        .filter((r) => !!r.clave && !!r.valor);
    } catch {
      return [];
    }
  }

  private obtenerNumeroRegla(reglas: ReglaConfigurable[], claves: string[]): number | null {
    const keys = new Set((claves || []).map((k) => this.normalizarReglaClave(k)));
    const regla = (reglas || []).find((r) => keys.has(this.normalizarReglaClave(r.clave)));
    if (!regla?.valor) return null;
    const n = Number(regla.valor);
    return Number.isFinite(n) ? n : null;
  }

  private normalizarReglaClave(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]+/g, '_')
      .trim();
  }

  private timestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${`${d.getMonth() + 1}`.padStart(2, '0')}${`${d.getDate()}`.padStart(2, '0')}_${`${d.getHours()}`.padStart(2, '0')}${`${d.getMinutes()}`.padStart(2, '0')}`;
  }

  private normalizar(v: string): string {
    return (v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private toDatetimeLocalValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hours = `${date.getHours()}`.padStart(2, '0');
    const minutes = `${date.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  private parseDatetimeLocal(value: string): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private ajustarRangoFecha(candidata: Date, min: Date, max: Date): Date {
    if (candidata.getTime() < min.getTime()) return min;
    if (candidata.getTime() > max.getTime()) return max;
    return candidata;
  }

  private descargarBlob(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }
}
