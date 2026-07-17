import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface EvaluadorPostulacionItem {
  id: number;
  folio?: string | null;
  nombre: string;
  correo: string;
  convocatoriaId?: number | null;
  convocatoriaTitulo?: string | null;
  tipoApoyo?: string;
  tipoSolicitud?: string;
  fechaEvento?: string | null;
  tituloProyecto?: string;
  descripcionProyecto?: string;
  observaciones?: string;
  observacionesRevision?: string | null;
  fechaRevision?: string | null;
  evaluadorEmail?: string | null;
  fechaAsignacionEvaluador?: string | null;
  resultadoEvaluacion?: 'APROBADA' | 'NO_APROBADA' | null;
  puntajeEvaluacion?: number | null;
  comentariosEvaluacion?: string | null;
  fechaEvaluacion?: string | null;
  cartaEvaluadorDocumentoId?: number | null;
  cartaEvaluadorNombreArchivo?: string | null;
  dictamenEvaluacionDocumentoId?: number | null;
  dictamenEvaluacionNombreArchivo?: string | null;
  constanciaEvaluadorDocumentoId?: number | null;
  constanciaEvaluadorNombreArchivo?: string | null;
  criteriosJson?: string;
  fechaCreacion: string;
  estado: string;
  cedula?: string;
  curp?: string;
  telefono?: string;
  tieneCurriculum: boolean;
  curriculumDocumentoId?: number | null;
  curriculumNombreArchivo?: string | null;
  fotoDocumentoId?: number | null;
  fotoUrl?: string | SafeResourceUrl | null;
  documentosAdjuntos?: Array<{ clave: string; documentoId: number; nombreArchivo: string }>;
}

@Component({
  selector: 'app-evaluador-postulaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './evaluador-postulaciones.component.html',
  styleUrls: ['./evaluador-postulaciones.component.css']
})
export class EvaluadorPostulacionesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly apiBase = environment.apiBaseUrl || 'http://localhost:8083';
  private readonly puntajeMaximoCache = new Map<number, number>();

  loading = true;
  error: string | null = null;
  postulaciones: EvaluadorPostulacionItem[] = [];

  ngOnInit(): void {
    this.cargarAsignadas();
  }

  cargarAsignadas(): void {
    this.loading = true;
    this.error = null;
    this.http.get<EvaluadorPostulacionItem[]>(`${environment.apiBaseUrl}/postulaciones/evaluador/asignadas`).subscribe({
      next: (data) => {
        this.postulaciones = data || [];
        this.postulaciones.filter(p => p.fotoDocumentoId).forEach(p => this.cargarFoto(p));
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las postulaciones asignadas.';
        this.loading = false;
      }
    });
  }

  verDetalle(p: EvaluadorPostulacionItem): void {
    const docsAdjuntos = p.documentosAdjuntos || [];
    const cartaFirmada = docsAdjuntos.find((d) => d.clave === 'carta_evaluador_firmada');
    const dictamenFirmado = docsAdjuntos.find((d) => d.clave === 'dictamen_evaluacion_firmado');
    const adjuntosHtml = docsAdjuntos.length
      ? docsAdjuntos.map(d => `
          <div class="swal-doc-adjunto d-flex align-items-center justify-content-between gap-2 mb-2">
            <span class="swal-doc-label">${this.escapeHtml(d.clave.replace(/_/g, ' '))}</span>
            <button type="button" class="btn btn-sm btn-outline-primary swal-dl-doc" data-doc-id="${d.documentoId}" data-filename="${this.escapeHtml(d.nombreArchivo || 'documento')}">
              <i class="fas fa-download me-1"></i>Descargar
            </button>
          </div>
        `).join('')
      : '<p class="text-muted mb-0">Sin adjuntos.</p>';

    const criterios = this.parseCriterios(p.criteriosJson);
    const criteriosHtml = criterios.length
      ? criterios.map(c => `<li><strong>${this.escapeHtml(c.clave)}:</strong> ${this.escapeHtml(c.valor)}</li>`).join('')
      : '<li class="text-muted">Sin criterios capturados.</li>';

    const docsEvaluacionHtml = `
      <div class="d-flex flex-wrap gap-2 mb-2">
        <button type="button" class="btn btn-sm btn-outline-primary swal-dl-eval" data-eval-kind="carta" ${p.cartaEvaluadorDocumentoId ? '' : 'disabled'}>Carta</button>
        <button type="button" class="btn btn-sm btn-outline-primary swal-dl-eval" data-eval-kind="dictamen" ${p.dictamenEvaluacionDocumentoId ? '' : 'disabled'}>Dictamen</button>
        <button type="button" class="btn btn-sm btn-outline-primary swal-dl-eval" data-eval-kind="constancia" ${p.constanciaEvaluadorDocumentoId ? '' : 'disabled'}>Constancia</button>
      </div>
      <div class="d-flex flex-wrap gap-2 mb-2">
        <button type="button" class="btn btn-sm btn-outline-success swal-up-eval" data-eval-upload="CARTA" ${p.cartaEvaluadorDocumentoId ? '' : 'disabled'}>Subir carta firmada</button>
        <button type="button" class="btn btn-sm btn-outline-success swal-up-eval" data-eval-upload="DICTAMEN" ${p.dictamenEvaluacionDocumentoId ? '' : 'disabled'}>Subir dictamen firmado</button>
      </div>
      <div class="d-flex flex-wrap gap-2 mb-2">
        <button type="button" class="btn btn-sm btn-outline-dark swal-dl-eval" data-eval-kind="carta_firmada" ${cartaFirmada ? '' : 'disabled'}>Carta firmada</button>
        <button type="button" class="btn btn-sm btn-outline-dark swal-dl-eval" data-eval-kind="dictamen_firmado" ${dictamenFirmado ? '' : 'disabled'}>Dictamen firmado</button>
      </div>
      <small class="text-muted d-block">Flujo: descargar, firmar y volver a subir en PDF.</small>
    `;

    Swal.fire({
      title: this.escapeHtml(p.folio || `SOL-${p.id}`),
      html: `
        <div class="text-start">
          <p class="mb-1"><strong>Convocatoria:</strong> ${this.escapeHtml(p.convocatoriaTitulo || '—')}</p>
          <p class="mb-1"><strong>Postulante:</strong> ${this.escapeHtml(p.nombre || '—')}</p>
          <p class="mb-1"><strong>Correo:</strong> ${this.escapeHtml(p.correo || '—')}</p>
          <p class="mb-1"><strong>Tipo de apoyo:</strong> ${this.escapeHtml(p.tipoApoyo || 'No especificado')}</p>
          <p class="mb-1"><strong>Tipo de solicitud:</strong> ${this.escapeHtml(p.tipoSolicitud || 'NACIONAL')}</p>
          <p class="mb-1"><strong>Fecha evento:</strong> ${this.escapeHtml(this.formatearFechaSimple(p.fechaEvento))}</p>
          <p class="mb-1"><strong>Estado:</strong> ${this.escapeHtml(p.estado || '—')}</p>
          <p class="mb-1"><strong>Resultado evaluación:</strong> ${this.escapeHtml(p.resultadoEvaluacion || 'Pendiente')}</p>
          <p class="mb-1"><strong>Puntaje evaluación:</strong> ${this.escapeHtml(String(p.puntajeEvaluacion ?? '—'))}</p>
          <p class="mb-1"><strong>Fecha evaluación:</strong> ${this.escapeHtml(this.formatearFecha(p.fechaEvaluacion))}</p>
          <hr />
          <p class="mb-1"><strong>Proyecto:</strong> ${this.escapeHtml(p.tituloProyecto || '—')}</p>
          <p class="mb-2">${this.escapeHtml(p.descripcionProyecto || 'Sin descripción')}</p>
          <p class="mb-1"><strong>Observaciones postulante:</strong></p>
          <p class="mb-2">${this.escapeHtml(p.observaciones || 'Sin observaciones')}</p>
          <p class="mb-1"><strong>Observaciones de revisión:</strong></p>
          <p class="mb-2">${this.escapeHtml(p.observacionesRevision || 'Sin observaciones de revisión')}</p>
          <p class="mb-1"><strong>Criterios:</strong></p>
          <ul class="mb-2">${criteriosHtml}</ul>
          <p class="mb-1"><strong>Documentación de evaluación:</strong></p>
          ${docsEvaluacionHtml}
          <p class="mb-1"><strong>Documentos adjuntos:</strong></p>
          <div>${adjuntosHtml}</div>
        </div>
      `,
      width: 700,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      confirmButtonText: p.tieneCurriculum ? 'Descargar CV' : 'Entendido',
      confirmButtonColor: '#7A1E48',
      didOpen: (popup) => {
        popup.querySelectorAll('.swal-dl-doc').forEach(btn => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-doc-id');
            const fn = btn.getAttribute('data-filename');
            if (id) this.descargarDocumentoById(Number(id), fn || 'documento');
          });
        });
        popup.querySelectorAll('.swal-dl-eval').forEach(btn => {
          btn.addEventListener('click', () => {
            const kind = btn.getAttribute('data-eval-kind');
            if (kind === 'carta') {
              this.descargarDocumentoById(p.cartaEvaluadorDocumentoId || 0, p.cartaEvaluadorNombreArchivo || `carta_evaluador_${p.id}.pdf`);
            } else if (kind === 'dictamen') {
              this.descargarDocumentoById(p.dictamenEvaluacionDocumentoId || 0, p.dictamenEvaluacionNombreArchivo || `dictamen_evaluacion_${p.id}.pdf`);
            } else if (kind === 'constancia') {
              this.descargarDocumentoById(p.constanciaEvaluadorDocumentoId || 0, p.constanciaEvaluadorNombreArchivo || `constancia_evaluador_${p.id}.pdf`);
            } else if (kind === 'carta_firmada' && cartaFirmada?.documentoId) {
              this.descargarDocumentoById(cartaFirmada.documentoId, cartaFirmada.nombreArchivo || `carta_evaluador_firmada_${p.id}.pdf`);
            } else if (kind === 'dictamen_firmado' && dictamenFirmado?.documentoId) {
              this.descargarDocumentoById(dictamenFirmado.documentoId, dictamenFirmado.nombreArchivo || `dictamen_evaluacion_firmado_${p.id}.pdf`);
            }
          });
        });
        popup.querySelectorAll('.swal-up-eval').forEach(btn => {
          btn.addEventListener('click', () => {
            const tipo = (btn.getAttribute('data-eval-upload') || '').trim().toUpperCase();
            if (tipo === 'CARTA' || tipo === 'DICTAMEN') {
              this.subirDocumentoFirmado(p, tipo as 'CARTA' | 'DICTAMEN');
            }
          });
        });
      }
    }).then((res) => {
      if (res.isConfirmed && p.tieneCurriculum && p.curriculumDocumentoId) {
        this.descargarDocumentoById(p.curriculumDocumentoId, p.curriculumNombreArchivo || `curriculum_postulacion_${p.id}.pdf`);
      }
    });
  }

  formatearFecha(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? iso : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso || '—';
    }
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

  getEstadoBadgeClass(estado: string): string {
    if (estado === 'ACEPTADA' || estado === 'REVISADA') return 'bg-success';
    if (estado === 'RECHAZADA') return 'bg-danger';
    if (estado === 'CON_OBSERVACIONES') return 'bg-warning text-dark';
    if (estado === 'SUBSANADA') return 'bg-info text-dark';
    return 'bg-secondary';
  }

  getResultadoBadgeClass(resultado?: string | null): string {
    if (resultado === 'APROBADA') return 'bg-success';
    if (resultado === 'NO_APROBADA') return 'bg-danger';
    return 'bg-secondary';
  }

  async evaluar(p: EvaluadorPostulacionItem): Promise<void> {
    const puntajeMax = await this.obtenerPuntajeMaximo(p.convocatoriaId);
    const puntajeActual = typeof p.puntajeEvaluacion === 'number' ? p.puntajeEvaluacion : '';
    const resultadoActual = p.resultadoEvaluacion || '';
    const comentariosActual = p.comentariosEvaluacion || '';
    Swal.fire({
      title: `Evaluar ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <label for="swal-resultado" class="form-label small fw-semibold mb-1">Resultado</label>
          <select id="swal-resultado" class="swal2-select mt-0 mb-2" style="display:block;width:100%;">
            <option value="">Selecciona...</option>
            <option value="APROBADA" ${resultadoActual === 'APROBADA' ? 'selected' : ''}>Aprobada</option>
            <option value="NO_APROBADA" ${resultadoActual === 'NO_APROBADA' ? 'selected' : ''}>No aprobada</option>
          </select>
          <label for="swal-puntaje" class="form-label small fw-semibold mb-1">Puntaje (0 a ${puntajeMax})</label>
          <input id="swal-puntaje" type="number" class="swal2-input mt-0 mb-2" min="0" max="${puntajeMax}" value="${puntajeActual}" />
          <label for="swal-comentarios" class="form-label small fw-semibold mb-1">Comentarios</label>
          <textarea id="swal-comentarios" class="swal2-textarea mt-0" maxlength="3000" placeholder="Comentarios de evaluacion...">${this.escapeHtml(comentariosActual)}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar evaluacion',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const resultadoEl = document.getElementById('swal-resultado') as HTMLSelectElement | null;
        const puntajeEl = document.getElementById('swal-puntaje') as HTMLInputElement | null;
        const comentariosEl = document.getElementById('swal-comentarios') as HTMLTextAreaElement | null;
        const resultado = (resultadoEl?.value || '').trim().toUpperCase();
        const puntaje = Number((puntajeEl?.value || '').trim());
        const comentarios = (comentariosEl?.value || '').trim();
        if (!resultado) {
          Swal.showValidationMessage('Debes seleccionar un resultado');
          return false;
        }
        if (!Number.isFinite(puntaje) || puntaje < 0 || puntaje > puntajeMax) {
          Swal.showValidationMessage(`El puntaje debe estar entre 0 y ${puntajeMax}`);
          return false;
        }
        return { resultado, puntaje, comentarios };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      this.http.post<any>(`${environment.apiBaseUrl}/postulaciones/${p.id}/evaluacion`, res.value).subscribe({
        next: () => {
          this.cargarAsignadas();
          Swal.fire({ icon: 'success', title: 'Evaluacion registrada', text: 'La evaluacion se guardo correctamente.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo registrar la evaluacion.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  getInicial(p: EvaluadorPostulacionItem): string {
    const n = (p.nombre || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  getFotoUrl(p: EvaluadorPostulacionItem): string | SafeResourceUrl {
    return p.fotoUrl || '';
  }

  private cargarFoto(p: EvaluadorPostulacionItem): void {
    if (!p.fotoDocumentoId) return;
    this.http.get(`${this.apiBase}/documentos/${p.fotoDocumentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        p.fotoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        this.cdr.detectChanges();
      },
      error: () => {
        p.fotoUrl = null;
        this.cdr.detectChanges();
      }
    });
  }

  private descargarDocumentoById(documentoId: number, nombreArchivo: string): void {
    if (!documentoId || documentoId <= 0) return;
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
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'No se pudo descargar el documento.',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  private subirDocumentoFirmado(p: EvaluadorPostulacionItem, tipo: 'CARTA' | 'DICTAMEN'): void {
    const etiqueta = tipo === 'CARTA' ? 'carta firmada' : 'dictamen firmado';
    Swal.fire({
      title: `Subir ${etiqueta}`,
      input: 'file',
      inputAttributes: {
        accept: '.pdf,application/pdf',
        'aria-label': `Selecciona ${etiqueta} en PDF`
      },
      showCancelButton: true,
      confirmButtonText: 'Subir',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: (value) => {
        const file = value as File | null;
        if (!file) {
          Swal.showValidationMessage('Debes seleccionar un archivo PDF');
          return false;
        }
        const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!esPdf) {
          Swal.showValidationMessage('Solo se permiten archivos PDF');
          return false;
        }
        if (file.size > 8 * 1024 * 1024) {
          Swal.showValidationMessage('El archivo no puede superar 8 MB');
          return false;
        }
        return file;
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      const file = res.value as File;
      const formData = new FormData();
      formData.append('file', file);
      this.http.post<any>(
        `${environment.apiBaseUrl}/postulaciones/${p.id}/evaluacion/documento-firmado?tipo=${encodeURIComponent(tipo)}`,
        formData
      ).subscribe({
        next: () => {
          this.cargarAsignadas();
          Swal.fire({
            icon: 'success',
            title: 'Documento firmado cargado',
            text: `Se cargó correctamente el ${etiqueta}.`,
            confirmButtonColor: '#800020'
          });
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: err?.error?.message || err?.error?.error || `No se pudo cargar el ${etiqueta}.`,
            confirmButtonColor: '#800020'
          });
        }
      });
    });
  }

  private parseCriterios(raw: string | undefined): Array<{ clave: string; valor: string }> {
    if (!raw?.trim()) return [];
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(obj).map(([k, v]) => ({ clave: k, valor: this.formatValorCriterio(v) }));
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
    return (value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private obtenerPuntajeMaximo(convocatoriaId?: number | null): Promise<number> {
    if (!convocatoriaId || !Number.isFinite(convocatoriaId)) {
      return Promise.resolve(100);
    }
    const convId = Number(convocatoriaId);
    const cached = this.puntajeMaximoCache.get(convId);
    if (cached && cached > 0) {
      return Promise.resolve(cached);
    }
    return new Promise((resolve) => {
      this.http.get<any>(`${environment.apiBaseUrl}/admin/convocatorias/${convId}`).subscribe({
        next: (c) => {
          const max = Number(c?.puntajeMaximoEvaluacion);
          const value = Number.isFinite(max) && max > 0 ? max : 100;
          this.puntajeMaximoCache.set(convId, value);
          resolve(value);
        },
        error: () => resolve(100)
      });
    });
  }
}
