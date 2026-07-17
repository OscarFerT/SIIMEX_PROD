import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface InformePostulacionItem {
  id: number;
  folio?: string | null;
  nombre: string;
  correo: string;
  estado: string;
  estadoComite?: string | null;
  estadoInforme?: string | null;
  fechaLimiteInformeParcial?: string | null;
  fechaLimiteInformeFinal?: string | null;
  fechaInformeParcial?: string | null;
  fechaInformeFinal?: string | null;
  informeParcialDocumentoId?: number | null;
  informeParcialNombreArchivo?: string | null;
  informeFinalDocumentoId?: number | null;
  informeFinalNombreArchivo?: string | null;
  observacionesInforme?: string | null;
  motivoIncumplimientoInforme?: string | null;
}

interface ReglaConfigurable {
  clave: string;
  valor: string;
  descripcion?: string;
}

@Component({
  selector: 'app-admin-informes',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-informes.component.html',
  styleUrls: ['./admin-informes.component.css']
})
export class AdminInformesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  convocatoriaId: number | null = null;
  convocatoriaTitulo = 'Convocatoria';
  informesRequeridos: 'NINGUNO' | 'PARCIAL' | 'FINAL' | 'AMBOS' = 'AMBOS';
  loading = true;
  error: string | null = null;
  postulaciones: InformePostulacionItem[] = [];

  filtroTexto = '';
  filtroEstadoInforme = '';

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
        this.informesRequeridos = this.resolverInformesRequeridos(c?.reglasConfigurables);
      },
      error: () => {
        this.convocatoriaTitulo = 'Convocatoria';
        this.informesRequeridos = 'AMBOS';
      }
    });
  }

  cargarPostulaciones(): void {
    if (!this.convocatoriaId) return;
    this.loading = true;
    this.error = null;
    this.http.get<InformePostulacionItem[]>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones`).subscribe({
      next: (data) => {
        this.postulaciones = (data || []).filter((p) => this.esAprobada(p));
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las solicitudes para informes.';
        this.loading = false;
      }
    });
  }

  ejecutarReglasAutomaticas(): void {
    if (!this.convocatoriaId) return;
    this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/informes/ejecutar-reglas`, {}).subscribe({
      next: (res) => {
        this.cargarPostulaciones();
        Swal.fire({
          icon: 'success',
          title: 'Reglas ejecutadas',
          text: `Solicitudes actualizadas: ${res?.actualizadas ?? 0}`,
          confirmButtonColor: '#800020'
        });
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudieron ejecutar las reglas automáticas.', confirmButtonColor: '#800020' });
      }
    });
  }

  get postulacionesFiltradas(): InformePostulacionItem[] {
    const q = this.norm(this.filtroTexto);
    const estado = this.norm(this.filtroEstadoInforme);
    return (this.postulaciones || []).filter((p) => {
      const okQ = !q || this.norm(`${p.folio || ''} ${p.nombre || ''} ${p.correo || ''}`).includes(q);
      const okEstado = !estado || this.norm(p.estadoInforme || '') === estado;
      return okQ && okEstado;
    });
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroEstadoInforme = '';
  }

  configurarFechas(p: InformePostulacionItem): void {
    if (!this.requiereInformeParcial && !this.requiereInformeFinal) {
      Swal.fire({
        icon: 'info',
        title: 'Sin informes requeridos',
        text: 'Esta convocatoria está configurada para no solicitar informes.',
        confirmButtonColor: '#800020'
      });
      return;
    }
    const parcialActual = p.fechaLimiteInformeParcial ? p.fechaLimiteInformeParcial.slice(0, 10) : '';
    const finalActual = p.fechaLimiteInformeFinal ? p.fechaLimiteInformeFinal.slice(0, 10) : '';
    const obsActual = p.observacionesInforme || '';
    const requiereParcial = this.requiereInformeParcial;
    const requiereFinal = this.requiereInformeFinal;
    Swal.fire({
      title: `Configurar informes ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          ${requiereParcial ? `
            <label for="swal-inf-parcial" class="form-label small fw-semibold mb-1">Fecha límite informe parcial</label>
            <input id="swal-inf-parcial" type="date" class="swal2-input mt-0 mb-2" value="${parcialActual}" />
          ` : ''}
          ${requiereFinal ? `
            <label for="swal-inf-final" class="form-label small fw-semibold mb-1">Fecha límite informe final</label>
            <input id="swal-inf-final" type="date" class="swal2-input mt-0 mb-2" value="${finalActual}" />
          ` : ''}
          <label for="swal-inf-obs" class="form-label small fw-semibold mb-1">Observaciones</label>
          <textarea id="swal-inf-obs" class="swal2-textarea mt-0" maxlength="3000">${this.escapeHtml(obsActual)}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const fechaLimiteInformeParcial = (document.getElementById('swal-inf-parcial') as HTMLInputElement | null)?.value?.trim() || '';
        const fechaLimiteInformeFinal = (document.getElementById('swal-inf-final') as HTMLInputElement | null)?.value?.trim() || '';
        const observacionesInforme = (document.getElementById('swal-inf-obs') as HTMLTextAreaElement | null)?.value?.trim() || '';
        if (requiereParcial && !fechaLimiteInformeParcial) {
          Swal.showValidationMessage('Debes capturar la fecha límite del informe parcial');
          return false;
        }
        if (requiereFinal && !fechaLimiteInformeFinal) {
          Swal.showValidationMessage('Debes capturar la fecha límite del informe final');
          return false;
        }
        if (requiereParcial && requiereFinal && fechaLimiteInformeFinal < fechaLimiteInformeParcial) {
          Swal.showValidationMessage('La fecha final no puede ser menor que la parcial');
          return false;
        }
        return {
          fechaLimiteInformeParcial: requiereParcial ? fechaLimiteInformeParcial : null,
          fechaLimiteInformeFinal: requiereFinal ? fechaLimiteInformeFinal : null,
          observacionesInforme
        };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/informes/configurar`, res.value).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Fechas configuradas', text: 'La configuración de informes fue guardada.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo configurar informes.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  marcarIncumplimiento(p: InformePostulacionItem): void {
    Swal.fire({
      title: 'Marcar incumplimiento',
      text: `Se cancelará el apoyo de ${p.folio || `SOL-${p.id}`} por incumplimiento de informes.`,
      input: 'textarea',
      inputLabel: 'Motivo',
      inputPlaceholder: 'Describe el motivo de incumplimiento...',
      showCancelButton: true,
      confirmButtonText: 'Confirmar',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar',
      preConfirm: (value) => {
        const motivo = (value || '').toString().trim();
        if (!motivo) {
          Swal.showValidationMessage('Debes capturar el motivo');
          return false;
        }
        return { motivo };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/informes/incumplimiento`, res.value).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Incumplimiento registrado', text: 'La solicitud fue marcada por incumplimiento.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo registrar incumplimiento.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  abrirDocumento(documentoId?: number | null): void {
    if (!documentoId) return;
    window.open(`${environment.apiBaseUrl}/documentos/${documentoId}`, '_blank');
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

  getEstadoInformeBadgeClass(estado?: string | null): string {
    const e = (estado || '').toUpperCase();
    if (e === 'NO_REQUIERE') return 'bg-secondary';
    if (e === 'COMPLETO') return 'bg-success';
    if (e === 'PARCIAL_RECIBIDO') return 'bg-info text-dark';
    if (e === 'INCUMPLIDO') return 'bg-danger';
    if (e === 'PENDIENTE') return 'bg-warning text-dark';
    return 'bg-secondary';
  }

  private esAprobada(p: InformePostulacionItem): boolean {
    const estado = (p.estado || '').toUpperCase();
    const estadoComite = (p.estadoComite || '').toUpperCase();
    return estado === 'ACEPTADA' || estadoComite === 'APROBADA' || estado === 'CANCELADA';
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  private escapeHtml(value: string): string {
    return (value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }

  get requiereInformeParcial(): boolean {
    return this.informesRequeridos === 'PARCIAL' || this.informesRequeridos === 'AMBOS';
  }

  get requiereInformeFinal(): boolean {
    return this.informesRequeridos === 'FINAL' || this.informesRequeridos === 'AMBOS';
  }

  private resolverInformesRequeridos(reglasRaw: string | null | undefined): 'NINGUNO' | 'PARCIAL' | 'FINAL' | 'AMBOS' {
    const reglas = this.parseReglas(reglasRaw);
    const reglaPrincipal = this.buscarRegla(reglas, ['informes_requeridos', 'tipo_informes_requeridos', 'cantidad_informes_requeridos']);
    if (reglaPrincipal) {
      return this.parseTipoInformes(reglaPrincipal.valor);
    }

    const parcial = this.buscarRegla(reglas, ['requiere_informe_parcial', 'informe_parcial_requerido']);
    const final = this.buscarRegla(reglas, ['requiere_informe_final', 'informe_final_requerido']);
    if (!parcial && !final) return 'AMBOS';

    const requiereParcial = parcial ? this.parseBooleano(parcial.valor) : false;
    const requiereFinal = final ? this.parseBooleano(final.valor) : false;
    if (requiereParcial && requiereFinal) return 'AMBOS';
    if (requiereParcial) return 'PARCIAL';
    if (requiereFinal) return 'FINAL';
    return 'NINGUNO';
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

  private buscarRegla(reglas: ReglaConfigurable[], claves: string[]): ReglaConfigurable | null {
    const keys = new Set((claves || []).map((k) => this.normalizarClave(k)).filter(Boolean));
    for (const regla of reglas || []) {
      if (keys.has(this.normalizarClave(regla.clave))) return regla;
    }
    return null;
  }

  private parseBooleano(raw: string | null | undefined): boolean {
    const v = (raw || '').trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'si' || v === 'sí' || v === 'yes' || v === 'on';
  }

  private parseTipoInformes(raw: string | null | undefined): 'NINGUNO' | 'PARCIAL' | 'FINAL' | 'AMBOS' {
    const v = this.normalizarClave(raw || '');
    if (!v) return 'AMBOS';
    if (v === 'ninguno' || v === 'sin_informes' || v === 'no_aplica' || v === '0' || v === 'no') return 'NINGUNO';
    if (v === 'parcial' || v === 'solo_parcial' || v === '1') return 'PARCIAL';
    if (v === 'final' || v === 'solo_final') return 'FINAL';
    return 'AMBOS';
  }

  private normalizarClave(v: string): string {
    return (v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s-]+/g, '_')
      .trim();
  }
}
