import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface RenunciaItem {
  id: number;
  folio?: string | null;
  nombre: string;
  correo: string;
  estado?: string | null;
  estadoComite?: string | null;
  montoApoyoAsignado?: number | null;
  estadoRenuncia?: 'SOLICITADA' | 'ACEPTADA' | 'RECHAZADA' | null;
  motivoRenuncia?: string | null;
  fechaSolicitudRenuncia?: string | null;
  fechaResolucionRenuncia?: string | null;
  observacionesRenuncia?: string | null;
}

@Component({
  selector: 'app-admin-renuncias',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-renuncias.component.html',
  styleUrls: ['./admin-renuncias.component.css']
})
export class AdminRenunciasComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  convocatoriaId: number | null = null;
  convocatoriaTitulo = 'Convocatoria';
  loading = true;
  error: string | null = null;
  postulaciones: RenunciaItem[] = [];

  total = 0;
  solicitadas = 0;
  aceptadas = 0;
  rechazadas = 0;

  filtroTexto = '';
  filtroEstadoRenuncia = '';

  ngOnInit(): void {
    const rawId = Number(this.route.snapshot.paramMap.get('id'));
    this.convocatoriaId = Number.isFinite(rawId) && rawId > 0 ? rawId : null;
    if (!this.convocatoriaId) {
      this.error = 'Convocatoria inválida.';
      this.loading = false;
      return;
    }
    this.cargarConvocatoria();
    this.cargarRenuncias();
  }

  cargarConvocatoria(): void {
    if (!this.convocatoriaId) return;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}`).subscribe({
      next: (c) => { this.convocatoriaTitulo = c?.titulo || 'Convocatoria'; },
      error: () => { this.convocatoriaTitulo = 'Convocatoria'; }
    });
  }

  cargarRenuncias(): void {
    if (!this.convocatoriaId) return;
    this.loading = true;
    this.error = null;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/renuncias`).subscribe({
      next: (data) => {
        this.total = Number(data?.total || 0);
        this.solicitadas = Number(data?.solicitadas || 0);
        this.aceptadas = Number(data?.aceptadas || 0);
        this.rechazadas = Number(data?.rechazadas || 0);
        this.postulaciones = (data?.registros || []) as RenunciaItem[];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las renuncias.';
        this.loading = false;
      }
    });
  }

  get postulacionesFiltradas(): RenunciaItem[] {
    const q = this.norm(this.filtroTexto);
    const estado = this.norm(this.filtroEstadoRenuncia);
    return (this.postulaciones || []).filter((p) => {
      const okQ = !q || this.norm(`${p.folio || ''} ${p.nombre || ''} ${p.correo || ''} ${p.motivoRenuncia || ''}`).includes(q);
      const okEstado = !estado || this.norm(p.estadoRenuncia || '') === estado;
      return okQ && okEstado;
    });
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroEstadoRenuncia = '';
  }

  resolverRenuncia(p: RenunciaItem): void {
    if (!this.convocatoriaId) return;
    if (p.estadoRenuncia !== 'SOLICITADA') {
      Swal.fire({ icon: 'info', title: 'Sin pendiente', text: 'Esta renuncia ya fue resuelta.', confirmButtonColor: '#800020' });
      return;
    }
    Swal.fire({
      title: `Resolver renuncia ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <label for="swal-renuncia-estado" class="form-label small fw-semibold mb-1">Resultado</label>
          <select id="swal-renuncia-estado" class="swal2-select mt-0 mb-2" style="display:block;width:100%;">
            <option value="">Selecciona...</option>
            <option value="ACEPTADA">Aceptar renuncia</option>
            <option value="RECHAZADA">Rechazar renuncia</option>
          </select>
          <label for="swal-renuncia-obs" class="form-label small fw-semibold mb-1">Observaciones</label>
          <textarea id="swal-renuncia-obs" class="swal2-textarea mt-0" maxlength="3000" placeholder="Opcional"></textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar resolución',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const estadoRenuncia = (document.getElementById('swal-renuncia-estado') as HTMLSelectElement | null)?.value?.trim().toUpperCase() || '';
        const observacionesRenuncia = (document.getElementById('swal-renuncia-obs') as HTMLTextAreaElement | null)?.value?.trim() || '';
        if (!estadoRenuncia) {
          Swal.showValidationMessage('Debes seleccionar el resultado de la renuncia');
          return false;
        }
        return { estadoRenuncia, observacionesRenuncia };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/renuncia/resolver`, res.value).subscribe({
        next: () => {
          this.cargarRenuncias();
          Swal.fire({ icon: 'success', title: 'Renuncia resuelta', text: 'Se guardó la resolución de renuncia.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo resolver la renuncia.', confirmButtonColor: '#800020' });
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

  getEstadoBadgeClass(estado?: string | null): string {
    if (estado === 'ACEPTADA') return 'bg-success';
    if (estado === 'RECHAZADA') return 'bg-danger';
    if (estado === 'SOLICITADA') return 'bg-warning text-dark';
    return 'bg-secondary';
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  private escapeHtml(value: string): string {
    return (value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
}
