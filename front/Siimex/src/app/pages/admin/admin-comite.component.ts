import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface ComitePostulacionItem {
  id: number;
  folio?: string | null;
  nombre: string;
  correo: string;
  tituloProyecto?: string | null;
  tipoApoyo?: string | null;
  estado: string;
  resultadoEvaluacion?: 'APROBADA' | 'NO_APROBADA' | null;
  puntajeEvaluacion?: number | null;
  estadoComite?: 'APROBADA' | 'RECHAZADA' | 'PENDIENTE' | null;
  montoApoyoAsignado?: number | null;
  observacionesComite?: string | null;
  fechaComite?: string | null;
  oficioAprobacionDocumentoId?: number | null;
  oficioAprobacionNombreArchivo?: string | null;
  fechaOficioAprobacion?: string | null;
  nombramientoDocumentoId?: number | null;
  nombramientoNombreArchivo?: string | null;
  fechaNombramiento?: string | null;
}

@Component({
  selector: 'app-admin-comite',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-comite.component.html',
  styleUrls: ['./admin-comite.component.css']
})
export class AdminComiteComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  convocatoriaId: number | null = null;
  convocatoriaTitulo = 'Convocatoria';

  loading = true;
  error: string | null = null;
  postulaciones: ComitePostulacionItem[] = [];
  totalComite = 0;
  aprobadasComite = 0;
  rechazadasComite = 0;
  pendientesComite = 0;
  montoTotalAprobado = 0;

  filtroFolio = '';
  filtroSolicitante = '';
  filtroResultado = '';
  filtroEstadoComite = '';

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
    this.cargarResumenComite();
  }

  cargarConvocatoria(): void {
    if (!this.convocatoriaId) return;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}`).subscribe({
      next: (c) => { this.convocatoriaTitulo = c?.titulo || 'Convocatoria'; },
      error: () => { this.convocatoriaTitulo = 'Convocatoria'; }
    });
  }

  cargarPostulaciones(): void {
    if (!this.convocatoriaId) return;
    this.loading = true;
    this.error = null;
    this.http.get<ComitePostulacionItem[]>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones`).subscribe({
      next: (data) => {
        this.postulaciones = data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las solicitudes para comite.';
        this.loading = false;
      }
    });
  }

  cargarResumenComite(): void {
    if (!this.convocatoriaId) return;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/comite/listas`).subscribe({
      next: (data) => {
        this.totalComite = Number(data?.total || 0);
        this.aprobadasComite = Number(data?.aprobadas || 0);
        this.rechazadasComite = Number(data?.rechazadas || 0);
        this.pendientesComite = Number(data?.pendientes || 0);
        this.montoTotalAprobado = Number(data?.montoTotalAprobado || 0);
      },
      error: () => {
        this.totalComite = 0;
        this.aprobadasComite = 0;
        this.rechazadasComite = 0;
        this.pendientesComite = 0;
        this.montoTotalAprobado = 0;
      }
    });
  }

  get postulacionesFiltradas(): ComitePostulacionItem[] {
    const folio = this.norm(this.filtroFolio);
    const solicitante = this.norm(this.filtroSolicitante);
    const resultado = this.norm(this.filtroResultado);
    const estadoComite = this.norm(this.filtroEstadoComite);
    return (this.postulaciones || []).filter((p) => {
      const okFolio = !folio || this.norm(p.folio || `SOL-${p.id}`).includes(folio);
      const okSolicitante = !solicitante || this.norm(`${p.nombre || ''} ${p.correo || ''}`).includes(solicitante);
      const okResultado = !resultado || this.norm(p.resultadoEvaluacion || '') === resultado;
      const okEstadoComite = !estadoComite || this.norm(p.estadoComite || '') === estadoComite;
      return okFolio && okSolicitante && okResultado && okEstadoComite;
    });
  }

  limpiarFiltros(): void {
    this.filtroFolio = '';
    this.filtroSolicitante = '';
    this.filtroResultado = '';
    this.filtroEstadoComite = '';
  }

  dictaminar(p: ComitePostulacionItem): void {
    const estadoActual = p.estadoComite || '';
    const montoActual = p.montoApoyoAsignado ?? '';
    const obsActual = p.observacionesComite || '';
    Swal.fire({
      title: `Dictamen de comite ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <label for="swal-comite-estado" class="form-label small fw-semibold mb-1">Estado de comite</label>
          <select id="swal-comite-estado" class="swal2-select mt-0 mb-2" style="display:block;width:100%;">
            <option value="">Selecciona...</option>
            <option value="APROBADA" ${estadoActual === 'APROBADA' ? 'selected' : ''}>Aprobada</option>
            <option value="RECHAZADA" ${estadoActual === 'RECHAZADA' ? 'selected' : ''}>Rechazada</option>
            <option value="PENDIENTE" ${estadoActual === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
          </select>
          <label for="swal-comite-monto" class="form-label small fw-semibold mb-1">Monto de apoyo (solo aprobada)</label>
          <input id="swal-comite-monto" type="number" class="swal2-input mt-0 mb-2" min="0" step="0.01" value="${montoActual}" />
          <label for="swal-comite-obs" class="form-label small fw-semibold mb-1">Observaciones</label>
          <textarea id="swal-comite-obs" class="swal2-textarea mt-0" maxlength="3000">${this.escapeHtml(obsActual)}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar dictamen',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const estadoEl = document.getElementById('swal-comite-estado') as HTMLSelectElement | null;
        const montoEl = document.getElementById('swal-comite-monto') as HTMLInputElement | null;
        const obsEl = document.getElementById('swal-comite-obs') as HTMLTextAreaElement | null;
        const estadoComite = (estadoEl?.value || '').trim().toUpperCase();
        const montoRaw = (montoEl?.value || '').trim();
        const observacionesComite = (obsEl?.value || '').trim();
        if (!estadoComite) {
          Swal.showValidationMessage('Debes seleccionar estado de comite');
          return false;
        }
        const monto = montoRaw ? Number(montoRaw) : null;
        if (estadoComite === 'APROBADA' && (!Number.isFinite(monto) || (monto as number) <= 0)) {
          Swal.showValidationMessage('Para aprobar debes capturar un monto mayor a 0');
          return false;
        }
        return {
          estadoComite,
          montoApoyoAsignado: estadoComite === 'APROBADA' ? monto : null,
          observacionesComite
        };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/comite`, res.value).subscribe({
        next: () => {
          this.cargarPostulaciones();
          this.cargarResumenComite();
          Swal.fire({ icon: 'success', title: 'Dictamen guardado', text: 'La decision de comite se guardo correctamente.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo guardar el dictamen.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  emitirOficio(p: ComitePostulacionItem): void {
    if (!this.convocatoriaId) return;
    this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/oficio-aprobacion`, {}).subscribe({
      next: () => {
        this.cargarPostulaciones();
        Swal.fire({ icon: 'success', title: 'Oficio emitido', text: 'El oficio de aprobación fue generado.', confirmButtonColor: '#800020' });
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo emitir el oficio.', confirmButtonColor: '#800020' });
      }
    });
  }

  emitirNombramiento(p: ComitePostulacionItem): void {
    if (!this.convocatoriaId) return;
    this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/nombramiento`, {}).subscribe({
      next: () => {
        this.cargarPostulaciones();
        Swal.fire({ icon: 'success', title: 'Nombramiento emitido', text: 'El nombramiento fue generado.', confirmButtonColor: '#800020' });
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo emitir el nombramiento.', confirmButtonColor: '#800020' });
      }
    });
  }

  descargarDocumento(documentoId?: number | null, nombre = 'documento.pdf'): void {
    if (!documentoId) return;
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre || 'documento.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar el documento.', confirmButtonColor: '#800020' })
    });
  }

  esAprobadaComite(p: ComitePostulacionItem): boolean {
    return (p.estadoComite || '').toUpperCase() === 'APROBADA' || (p.estado || '').toUpperCase() === 'ACEPTADA';
  }

  puedeDictaminar(p: ComitePostulacionItem | null | undefined): boolean {
    const estado = (p?.estado || '').toUpperCase();
    return estado === 'REVISADA' || estado === 'ACEPTADA' || estado === 'RECHAZADA';
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

  getResultadoBadgeClass(resultado?: string | null): string {
    if (resultado === 'APROBADA') return 'bg-success';
    if (resultado === 'NO_APROBADA') return 'bg-danger';
    return 'bg-secondary';
  }

  getEstadoComiteBadgeClass(estado?: string | null): string {
    if (estado === 'APROBADA') return 'bg-success';
    if (estado === 'RECHAZADA') return 'bg-danger';
    if (estado === 'PENDIENTE') return 'bg-warning text-dark';
    return 'bg-secondary';
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  private escapeHtml(value: string): string {
    return (value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
}
