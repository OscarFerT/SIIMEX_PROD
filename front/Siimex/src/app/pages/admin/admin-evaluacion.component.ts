import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';

interface EvaluacionPostulacionItem {
  id: number;
  folio?: string | null;
  nombre: string;
  correo: string;
  tipoApoyo?: string | null;
  tipoSolicitud?: string | null;
  fechaEvento?: string | null;
  tituloProyecto?: string | null;
  estado: string;
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
  fechaCreacion?: string | null;
}

@Component({
  selector: 'app-admin-evaluacion',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-evaluacion.component.html',
  styleUrls: ['./admin-evaluacion.component.css']
})
export class AdminEvaluacionComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  convocatoriaId: number | null = null;
  convocatoriaTitulo = 'Convocatoria';
  puntajeMaximoEvaluacion = 100;

  loading = true;
  error: string | null = null;
  postulaciones: EvaluacionPostulacionItem[] = [];

  filtroFolio = '';
  filtroSolicitante = '';
  filtroProyecto = '';
  filtroTipoApoyo = '';
  filtroEstado = '';

  ngOnInit(): void {
    const rawId = Number(this.route.snapshot.paramMap.get('id'));
    this.convocatoriaId = Number.isFinite(rawId) && rawId > 0 ? rawId : null;
    if (!this.convocatoriaId) {
      this.error = 'Convocatoria invalida.';
      this.loading = false;
      return;
    }
    this.cargarConvocatoria();
    this.cargarPostulaciones();
  }

  cargarConvocatoria(): void {
    if (!this.convocatoriaId) return;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}`).subscribe({
      next: (c) => {
        this.convocatoriaTitulo = c?.titulo || 'Convocatoria';
        const max = Number(c?.puntajeMaximoEvaluacion);
        this.puntajeMaximoEvaluacion = Number.isFinite(max) && max > 0 ? max : 100;
      },
      error: () => {
        this.convocatoriaTitulo = 'Convocatoria';
        this.puntajeMaximoEvaluacion = 100;
      }
    });
  }

  cargarPostulaciones(): void {
    if (!this.convocatoriaId) return;
    this.loading = true;
    this.error = null;
    this.http.get<EvaluacionPostulacionItem[]>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones`).subscribe({
      next: (data) => {
        this.postulaciones = data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las solicitudes para evaluacion.';
        this.loading = false;
      }
    });
  }

  get tiposApoyoDisponibles(): string[] {
    return Array.from(new Set(
      (this.postulaciones || [])
        .map((p) => (p.tipoApoyo || 'No especificado').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  get estadosDisponibles(): string[] {
    return Array.from(new Set(
      (this.postulaciones || [])
        .map((p) => (p.estado || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  }

  get postulacionesFiltradas(): EvaluacionPostulacionItem[] {
    const folio = this.norm(this.filtroFolio);
    const solicitante = this.norm(this.filtroSolicitante);
    const proyecto = this.norm(this.filtroProyecto);
    const tipoApoyo = this.norm(this.filtroTipoApoyo);
    const estado = this.norm(this.filtroEstado);
    return (this.postulaciones || []).filter((p) => {
      const okFolio = !folio || this.norm(p.folio || `SOL-${p.id}`).includes(folio);
      const okSolicitante = !solicitante || this.norm(`${p.nombre || ''} ${p.correo || ''}`).includes(solicitante);
      const okProyecto = !proyecto || this.norm(p.tituloProyecto || '').includes(proyecto);
      const okTipoApoyo = !tipoApoyo || this.norm(p.tipoApoyo || 'No especificado') === tipoApoyo;
      const okEstado = !estado || this.norm(p.estado || '') === estado;
      return okFolio && okSolicitante && okProyecto && okTipoApoyo && okEstado;
    });
  }

  limpiarFiltros(): void {
    this.filtroFolio = '';
    this.filtroSolicitante = '';
    this.filtroProyecto = '';
    this.filtroTipoApoyo = '';
    this.filtroEstado = '';
  }

  evaluar(p: EvaluacionPostulacionItem): void {
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
          <label for="swal-puntaje" class="form-label small fw-semibold mb-1">Puntaje (0 a ${this.puntajeMaximoEvaluacion})</label>
          <input id="swal-puntaje" type="number" class="swal2-input mt-0 mb-2" min="0" max="${this.puntajeMaximoEvaluacion}" value="${puntajeActual}" />
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
        if (!Number.isFinite(puntaje) || puntaje < 0 || puntaje > this.puntajeMaximoEvaluacion) {
          Swal.showValidationMessage(`El puntaje debe estar entre 0 y ${this.puntajeMaximoEvaluacion}`);
          return false;
        }
        return { resultado, puntaje, comentarios };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/evaluacion`, res.value).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Evaluacion registrada', text: 'La evaluacion se guardo correctamente.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo registrar la evaluacion.', confirmButtonColor: '#800020' });
        }
      });
    });
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

  puedeEvaluar(p: EvaluacionPostulacionItem | null | undefined): boolean {
    const estado = (p?.estado || '').toUpperCase();
    return estado === 'REVISADA' || estado === 'ACEPTADA' || estado === 'RECHAZADA';
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

  formatearFecha(s: string | null | undefined): string {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return s || '—';
    }
  }

  exportarExcel(): void {
    const data = this.postulacionesFiltradas;
    const headers = ['ID', 'Folio', 'Solicitante', 'Correo', 'Proyecto', 'Tipo apoyo', 'Estado solicitud', 'Evaluador', 'Fecha invitacion', 'Resultado evaluacion', 'Puntaje', 'Fecha evaluacion'];
    const rows = data.map((p) => [
      p.id,
      p.folio || `SOL-${p.id}`,
      p.nombre || '',
      p.correo || '',
      p.tituloProyecto || '',
      p.tipoApoyo || 'No especificado',
      p.estado || '',
      p.evaluadorEmail || '',
      this.formatearFecha(p.fechaAsignacionEvaluador),
      p.resultadoEvaluacion || '',
      p.puntajeEvaluacion ?? '',
      this.formatearFecha(p.fechaEvaluacion)
    ]);
    exportRowsAsXlsx(
      headers,
      rows,
      `evaluacion_${this.convocatoriaTitulo.replace(/\W/g, '_')}_${this.timestamp()}.xlsx`,
      'Evaluacion'
    );
  }

  exportarPdf(): void {
    const data = this.postulacionesFiltradas;
    const rows = data.map((p) => `
      <tr>
        <td>${p.id}</td>
        <td>${this.html(p.folio || `SOL-${p.id}`)}</td>
        <td>${this.html(p.nombre || '—')}</td>
        <td>${this.html(p.correo || '—')}</td>
        <td>${this.html(p.tituloProyecto || '—')}</td>
        <td>${this.html(p.tipoApoyo || 'No especificado')}</td>
        <td>${this.html(p.estado || '—')}</td>
        <td>${this.html(p.evaluadorEmail || '—')}</td>
        <td>${this.html(this.formatearFecha(p.fechaAsignacionEvaluador))}</td>
        <td>${this.html(p.resultadoEvaluacion || '—')}</td>
        <td>${this.html(String(p.puntajeEvaluacion ?? '—'))}</td>
        <td>${this.html(this.formatearFecha(p.fechaEvaluacion))}</td>
      </tr>
    `).join('');
    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Evaluacion - ${this.convocatoriaTitulo}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0 0 8px; color: #6a0032; }
    .meta { margin: 0 0 14px; color: #555; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th, td { border: 1px solid #ccc; padding: 6px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>Evaluacion: ${this.html(this.convocatoriaTitulo)}</h1>
  <p class="meta">Generado: ${new Date().toLocaleString('es-MX')} | Total: ${data.length}</p>
  <table>
    <thead><tr><th>ID</th><th>Folio</th><th>Solicitante</th><th>Correo</th><th>Proyecto</th><th>Tipo apoyo</th><th>Estado</th><th>Evaluador</th><th>Invitacion</th><th>Resultado</th><th>Puntaje</th><th>Fecha evaluacion</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="12">Sin datos</td></tr>'}</tbody>
  </table>
</body>
</html>`;
    const win = window.open('', '_blank', 'width=1400,height=900');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  verDocumentosEvaluacion(p: EvaluacionPostulacionItem): void {
    const html = `
      <div class="text-start">
        <p class="small mb-2">Folio: <strong>${this.html(p.folio || `SOL-${p.id}`)}</strong></p>
        <div class="d-grid gap-2">
          <button id="swal-doc-carta" class="btn btn-outline-primary btn-sm" ${p.cartaEvaluadorDocumentoId ? '' : 'disabled'}>
            Descargar carta de evaluación
          </button>
          <button id="swal-doc-dictamen" class="btn btn-outline-primary btn-sm" ${p.dictamenEvaluacionDocumentoId ? '' : 'disabled'}>
            Descargar dictamen
          </button>
          <button id="swal-doc-constancia" class="btn btn-outline-primary btn-sm" ${p.constanciaEvaluadorDocumentoId ? '' : 'disabled'}>
            Descargar constancia
          </button>
        </div>
      </div>
    `;
    Swal.fire({
      title: 'Documentos de evaluación',
      html,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        const carta = document.getElementById('swal-doc-carta');
        const dictamen = document.getElementById('swal-doc-dictamen');
        const constancia = document.getElementById('swal-doc-constancia');
        carta?.addEventListener('click', () => this.descargarDocumento(p.cartaEvaluadorDocumentoId, p.cartaEvaluadorNombreArchivo || `carta_evaluador_${p.id}.pdf`));
        dictamen?.addEventListener('click', () => this.descargarDocumento(p.dictamenEvaluacionDocumentoId, p.dictamenEvaluacionNombreArchivo || `dictamen_evaluacion_${p.id}.pdf`));
        constancia?.addEventListener('click', () => this.descargarDocumento(p.constanciaEvaluadorDocumentoId, p.constanciaEvaluadorNombreArchivo || `constancia_evaluador_${p.id}.pdf`));
      }
    });
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  private escapeHtml(value: string): string {
    return (value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  private html(v: string): string {
    return (v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  private timestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${`${d.getMonth() + 1}`.padStart(2, '0')}${`${d.getDate()}`.padStart(2, '0')}_${`${d.getHours()}`.padStart(2, '0')}${`${d.getMinutes()}`.padStart(2, '0')}`;
  }

  private descargarBlob(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  private descargarDocumento(documentoId?: number | null, nombreArchivo?: string): void {
    if (!documentoId) return;
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.descargarBlob(blob, nombreArchivo || `documento_${documentoId}.pdf`),
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo descargar el documento.', confirmButtonColor: '#800020' });
      }
    });
  }
}
