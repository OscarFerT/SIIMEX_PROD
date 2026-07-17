import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface BancariaPostulacionItem {
  id: number;
  folio?: string | null;
  nombre: string;
  correo: string;
  estado: string;
  estadoComite?: 'APROBADA' | 'RECHAZADA' | 'PENDIENTE' | null;
  montoApoyoAsignado?: number | null;
  banco?: string | null;
  titularCuenta?: string | null;
  cuentaBancaria?: string | null;
  clabeInterbancaria?: string | null;
  medioNotificacion?: string | null;
  fechaActualizacionBancaria?: string | null;
  nombramientoDocumentoId?: number | null;
  estadoEntregaApoyo?: string | null;
  fechaEntregaApoyo?: string | null;
  observacionesEntregaApoyo?: string | null;
  reciboPagoDocumentoId?: number | null;
  reciboPagoNombreArchivo?: string | null;
  estadoReciboPago?: string | null;
  fechaReciboPago?: string | null;
  fechaValidacionReciboPago?: string | null;
  observacionesReciboPago?: string | null;
}

@Component({
  selector: 'app-admin-bancaria',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-bancaria.component.html',
  styleUrls: ['./admin-bancaria.component.css']
})
export class AdminBancariaComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  convocatoriaId: number | null = null;
  convocatoriaTitulo = 'Convocatoria';

  loading = true;
  error: string | null = null;
  postulaciones: BancariaPostulacionItem[] = [];

  filtroTexto = '';
  filtroCaptura = '';
  filtroEntrega = '';

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
    this.http.get<BancariaPostulacionItem[]>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones`).subscribe({
      next: (data) => {
        const items = (data || []).filter((p) => this.esAprobada(p));
        this.postulaciones = items;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las solicitudes aprobadas.';
        this.loading = false;
      }
    });
  }

  get postulacionesFiltradas(): BancariaPostulacionItem[] {
    const q = this.norm(this.filtroTexto);
    const cap = this.norm(this.filtroCaptura);
    const entrega = this.norm(this.filtroEntrega);
    return (this.postulaciones || []).filter((p) => {
      const captura = this.tieneBancaria(p) ? 'capturada' : 'pendiente';
      const entregaEstado = this.tieneApoyoEntregado(p) ? 'entregado' : 'pendiente';
      const okQ = !q || this.norm(`${p.folio || ''} ${p.nombre || ''} ${p.correo || ''}`).includes(q);
      const okCap = !cap || cap === captura;
      const okEntrega = !entrega || entrega === entregaEstado;
      return okQ && okCap && okEntrega;
    });
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroCaptura = '';
    this.filtroEntrega = '';
  }

  editarBancaria(p: BancariaPostulacionItem): void {
    Swal.fire({
      title: `Información bancaria ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <label for="swal-banco" class="form-label small fw-semibold mb-1">Banco</label>
          <input id="swal-banco" class="swal2-input mt-0 mb-2" maxlength="120" value="${this.escapeHtml(p.banco || '')}" />
          <label for="swal-titular" class="form-label small fw-semibold mb-1">Titular de cuenta</label>
          <input id="swal-titular" class="swal2-input mt-0 mb-2" maxlength="180" value="${this.escapeHtml(p.titularCuenta || '')}" />
          <label for="swal-cuenta" class="form-label small fw-semibold mb-1">Cuenta bancaria</label>
          <input id="swal-cuenta" class="swal2-input mt-0 mb-2" maxlength="34" value="${this.escapeHtml(p.cuentaBancaria || '')}" />
          <label for="swal-clabe" class="form-label small fw-semibold mb-1">CLABE</label>
          <input id="swal-clabe" class="swal2-input mt-0 mb-2" maxlength="18" value="${this.escapeHtml(p.clabeInterbancaria || '')}" />
          <label for="swal-medio" class="form-label small fw-semibold mb-1">Medio de notificación</label>
          <select id="swal-medio" class="swal2-select mt-0" style="display:block;width:100%;">
            <option value="">Selecciona...</option>
            <option value="CORREO" ${p.medioNotificacion === 'CORREO' ? 'selected' : ''}>Correo</option>
            <option value="TELEFONO" ${p.medioNotificacion === 'TELEFONO' ? 'selected' : ''}>Teléfono</option>
            <option value="AMBOS" ${p.medioNotificacion === 'AMBOS' ? 'selected' : ''}>Ambos</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const banco = (document.getElementById('swal-banco') as HTMLInputElement | null)?.value?.trim() || '';
        const titularCuenta = (document.getElementById('swal-titular') as HTMLInputElement | null)?.value?.trim() || '';
        const cuentaBancaria = (document.getElementById('swal-cuenta') as HTMLInputElement | null)?.value?.trim() || '';
        const clabeInterbancaria = (document.getElementById('swal-clabe') as HTMLInputElement | null)?.value?.trim() || '';
        const medioNotificacion = (document.getElementById('swal-medio') as HTMLSelectElement | null)?.value?.trim() || '';
        if (!banco || !titularCuenta || !cuentaBancaria || !clabeInterbancaria || !medioNotificacion) {
          Swal.showValidationMessage('Completa todos los campos bancarios');
          return false;
        }
        return { banco, titularCuenta, cuentaBancaria, clabeInterbancaria, medioNotificacion };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/bancaria`, res.value).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Guardado', text: 'La informacion bancaria fue actualizada.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo guardar la informacion bancaria.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  revisarRecibo(p: BancariaPostulacionItem): void {
    if (!p.reciboPagoDocumentoId) {
      Swal.fire({ icon: 'info', title: 'Sin recibo', text: 'La persona beneficiaria aún no carga recibo de pago.', confirmButtonColor: '#800020' });
      return;
    }
    Swal.fire({
      title: `Validar recibo ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <label for="swal-recibo-estado" class="form-label small fw-semibold mb-1">Resultado</label>
          <select id="swal-recibo-estado" class="swal2-select mt-0 mb-2" style="display:block;width:100%;">
            <option value="">Selecciona...</option>
            <option value="RECIBO_VALIDADO" ${p.estadoReciboPago === 'RECIBO_VALIDADO' ? 'selected' : ''}>Validado</option>
            <option value="RECIBO_RECHAZADO" ${p.estadoReciboPago === 'RECIBO_RECHAZADO' ? 'selected' : ''}>Rechazado</option>
          </select>
          <label for="swal-recibo-obs" class="form-label small fw-semibold mb-1">Observaciones</label>
          <textarea id="swal-recibo-obs" class="swal2-textarea mt-0" maxlength="3000">${this.escapeHtml(p.observacionesReciboPago || '')}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const estadoReciboPago = (document.getElementById('swal-recibo-estado') as HTMLSelectElement | null)?.value?.trim().toUpperCase() || '';
        const observacionesReciboPago = (document.getElementById('swal-recibo-obs') as HTMLTextAreaElement | null)?.value?.trim() || '';
        if (!estadoReciboPago) {
          Swal.showValidationMessage('Selecciona el resultado del recibo');
          return false;
        }
        return { estadoReciboPago, observacionesReciboPago };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/recibo-pago/validar`, res.value).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Recibo actualizado', text: 'La revisión del recibo fue guardada.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo validar el recibo.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  registrarEntregaApoyo(p: BancariaPostulacionItem): void {
    Swal.fire({
      title: `Registrar entrega ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <p class="small text-muted mb-2">Se registrará la entrega del apoyo económico y se habilitará la carga del recibo para la persona beneficiaria.</p>
          <label for="swal-entrega-obs" class="form-label small fw-semibold mb-1">Observaciones</label>
          <textarea id="swal-entrega-obs" class="swal2-textarea mt-0" maxlength="3000">${this.escapeHtml(p.observacionesEntregaApoyo || '')}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Registrar entrega',
      confirmButtonColor: '#198754',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const observacionesEntregaApoyo = (document.getElementById('swal-entrega-obs') as HTMLTextAreaElement | null)?.value?.trim() || '';
        return { observacionesEntregaApoyo };
      }
    }).then((res) => {
      if (!res.isConfirmed || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/apoyo/entregar`, res.value || {}).subscribe({
        next: () => {
          this.cargarPostulaciones();
          Swal.fire({ icon: 'success', title: 'Entrega registrada', text: 'La persona beneficiaria ya puede cargar el recibo de pago.', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || 'No se pudo registrar la entrega del apoyo.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  descargarDocumento(documentoId?: number | null, nombre = 'recibo_pago.pdf'): void {
    if (!documentoId) return;
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre || 'recibo_pago.pdf';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar el documento.', confirmButtonColor: '#800020' })
    });
  }

  tieneBancaria(p: BancariaPostulacionItem): boolean {
    return !!(p.banco && p.titularCuenta && p.cuentaBancaria && p.clabeInterbancaria && p.medioNotificacion);
  }

  tieneApoyoEntregado(p: BancariaPostulacionItem): boolean {
    return (p.estadoEntregaApoyo || '').toUpperCase() === 'APOYO_ENTREGADO';
  }

  puedeRegistrarEntrega(p: BancariaPostulacionItem): boolean {
    return this.tieneBancaria(p) && !!p.nombramientoDocumentoId && !this.tieneApoyoEntregado(p);
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

  private esAprobada(p: BancariaPostulacionItem): boolean {
    const estado = (p.estado || '').toUpperCase();
    const estadoComite = (p.estadoComite || '').toUpperCase();
    return estado === 'ACEPTADA' || estadoComite === 'APROBADA';
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  private escapeHtml(value: string): string {
    return (value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  }
}
