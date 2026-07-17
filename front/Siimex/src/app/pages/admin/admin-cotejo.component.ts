import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface CotejoPostulacionItem {
  id: number;
  folio?: string | null;
  nombre: string;
  correo: string;
  estado: string;
  estadoCotejo?: 'APROBADA' | 'CON_OBSERVACIONES' | 'PENDIENTE' | null;
  observacionesCotejo?: string | null;
  fechaCotejo?: string | null;
}

@Component({
  selector: 'app-admin-cotejo',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-cotejo.component.html',
  styleUrls: ['./admin-cotejo.component.css']
})
export class AdminCotejoComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  convocatoriaId: number | null = null;
  convocatoriaTitulo = 'Convocatoria';
  loading = true;
  error: string | null = null;
  postulaciones: CotejoPostulacionItem[] = [];

  filtroTexto = '';
  filtroEstadoCotejo = '';

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
      next: (c) => { this.convocatoriaTitulo = c?.titulo || 'Convocatoria'; },
      error: () => { this.convocatoriaTitulo = 'Convocatoria'; }
    });
  }

  cargarPostulaciones(): void {
    if (!this.convocatoriaId) return;
    this.loading = true;
    this.error = null;
    this.http.get<CotejoPostulacionItem[]>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones`).subscribe({
      next: (data) => {
        this.postulaciones = data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las solicitudes para cotejo.';
        this.loading = false;
      }
    });
  }

  get postulacionesFiltradas(): CotejoPostulacionItem[] {
    const q = this.norm(this.filtroTexto);
    const estado = this.norm(this.filtroEstadoCotejo);
    return (this.postulaciones || []).filter((p) => {
      const okQ = !q || this.norm(`${p.folio || ''} ${p.nombre || ''} ${p.correo || ''}`).includes(q);
      const okEstado = !estado || this.norm(p.estadoCotejo || '') === estado;
      return okQ && okEstado;
    });
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroEstadoCotejo = '';
  }

  registrarCotejo(p: CotejoPostulacionItem): void {
    const estadoActual = p.estadoCotejo || '';
    const obsActual = p.observacionesCotejo || '';
    Swal.fire({
      title: `Cotejo ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <label for="swal-cotejo-estado" class="form-label small fw-semibold mb-1">Estado de cotejo</label>
          <select id="swal-cotejo-estado" class="swal2-select mt-0 mb-2" style="display:block;width:100%;">
            <option value="">Selecciona...</option>
            <option value="APROBADA" ${estadoActual === 'APROBADA' ? 'selected' : ''}>Aprobada</option>
            <option value="CON_OBSERVACIONES" ${estadoActual === 'CON_OBSERVACIONES' ? 'selected' : ''}>Con observaciones</option>
            <option value="PENDIENTE" ${estadoActual === 'PENDIENTE' ? 'selected' : ''}>Pendiente</option>
          </select>
          <label for="swal-cotejo-obs" class="form-label small fw-semibold mb-1">Observaciones</label>
          <textarea id="swal-cotejo-obs" class="swal2-textarea mt-0" maxlength="3000">${this.escapeHtml(obsActual)}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const estadoCotejo = (document.getElementById('swal-cotejo-estado') as HTMLSelectElement | null)?.value?.trim().toUpperCase() || '';
        const observacionesCotejo = (document.getElementById('swal-cotejo-obs') as HTMLTextAreaElement | null)?.value?.trim() || '';
        if (!estadoCotejo) {
          Swal.showValidationMessage('Debes seleccionar estado de cotejo');
          return false;
        }
        if (estadoCotejo === 'CON_OBSERVACIONES' && !observacionesCotejo) {
          Swal.showValidationMessage('Debes capturar observaciones');
          return false;
        }
        return { estadoCotejo, observacionesCotejo };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/cotejo`, res.value).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Cotejo actualizado', text: 'El resultado de cotejo se guardó correctamente.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo guardar el cotejo.', confirmButtonColor: '#800020' });
        }
      });
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

  getEstadoCotejoBadgeClass(estado?: string | null): string {
    if (estado === 'APROBADA') return 'bg-success';
    if (estado === 'CON_OBSERVACIONES') return 'bg-warning text-dark';
    if (estado === 'PENDIENTE') return 'bg-secondary';
    return 'bg-secondary';
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  private escapeHtml(value: string): string {
    return (value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
}
