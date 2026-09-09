import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

type ModuloOperativo = 'seguro-medico' | 'aceptacion' | 'constancias' | 'status-academico';

interface EstadoOption {
  value: string;
  label: string;
}

interface ModuloConfig {
  modulo: ModuloOperativo;
  titulo: string;
  subtitulo: string;
  icono: string;
  endpoint: string;
  estadoCampo?: keyof SeguimientoPostulacion;
  fechaCampo?: keyof SeguimientoPostulacion;
  observacionesCampo?: keyof SeguimientoPostulacion;
  estados?: EstadoOption[];
}

interface SeguimientoPostulacion {
  id: number;
  folio?: string | null;
  nombre?: string | null;
  correo?: string | null;
  estado?: string | null;
  estadoComite?: string | null;
  tipoApoyo?: string | null;
  fechaCreacion?: string | null;
  estadoSeguroMedico?: string | null;
  fechaSeguroMedico?: string | null;
  observacionesSeguroMedico?: string | null;
  numeroSeguroMedico?: string | null;
  seguroMedicoDocumentoId?: number | null;
  seguroMedicoNombreArchivo?: string | null;
  fechaAceptacionPostulacion?: string | null;
  observacionesAceptacion?: string | null;
  estadoConstanciaFinal?: string | null;
  constanciaFinalDocumentoId?: number | null;
  constanciaFinalNombreArchivo?: string | null;
  fechaConstanciaFinal?: string | null;
  cartaCierreDocumentoId?: number | null;
  cartaCierreNombreArchivo?: string | null;
  fechaCartaCierre?: string | null;
  observacionesConstanciaFinal?: string | null;
  estadoStatusAcademico?: string | null;
  fechaStatusAcademico?: string | null;
  observacionesStatusAcademico?: string | null;
  informacionStatusAcademico?: string | null;
  statusAcademicoDocumentoId?: number | null;
  statusAcademicoNombreArchivo?: string | null;
}

interface ModuloResponse {
  total?: number;
  aceptadas?: number;
  pendientes?: number;
  rechazadas?: number;
  registros?: SeguimientoPostulacion[];
}

const CONFIGS: Record<ModuloOperativo, ModuloConfig> = {
  'seguro-medico': {
    modulo: 'seguro-medico',
    titulo: 'Seguro médico',
    subtitulo: 'Controla el seguimiento del seguro médico de las personas registradas en la convocatoria.',
    icono: 'fa-kit-medical',
    endpoint: 'seguro-medico',
    estadoCampo: 'estadoSeguroMedico',
    fechaCampo: 'fechaSeguroMedico',
    observacionesCampo: 'observacionesSeguroMedico',
    estados: [
      { value: 'PENDIENTE', label: 'Pendiente' },
      { value: 'SOLICITADO', label: 'Solicitado' },
      { value: 'ENTREGADO', label: 'Entregado' },
      { value: 'VALIDADO', label: 'Validado' },
      { value: 'NO_APLICA', label: 'No aplica' }
    ]
  },
  aceptacion: {
    modulo: 'aceptacion',
    titulo: 'Aceptación',
    subtitulo: 'Formaliza la aceptación y permite enviar o reenviar el correo con el documento configurado.',
    icono: 'fa-envelope-circle-check',
    endpoint: 'aceptacion',
    fechaCampo: 'fechaAceptacionPostulacion',
    observacionesCampo: 'observacionesAceptacion'
  },
  constancias: {
    modulo: 'constancias',
    titulo: 'Constancias y cierre final',
    subtitulo: 'Genera constancias finales o cartas de cierre para personas aceptadas al finalizar el proceso.',
    icono: 'fa-certificate',
    endpoint: 'constancias',
    estadoCampo: 'estadoConstanciaFinal',
    fechaCampo: 'fechaConstanciaFinal',
    observacionesCampo: 'observacionesConstanciaFinal',
    estados: [
      { value: 'PENDIENTE', label: 'Pendiente' },
      { value: 'EN_PROCESO', label: 'En proceso' },
      { value: 'CONSTANCIA_EMITIDA', label: 'Constancia emitida' },
      { value: 'CARTA_EMITIDA', label: 'Carta emitida' },
      { value: 'COMPLETO', label: 'Completo' },
      { value: 'NO_APLICA', label: 'No aplica' }
    ]
  },
  'status-academico': {
    modulo: 'status-academico',
    titulo: 'Actualización de estatus académico',
    subtitulo: 'Da seguimiento a la actualización o validación del estatus académico por persona registrada.',
    icono: 'fa-graduation-cap',
    endpoint: 'status-academico',
    estadoCampo: 'estadoStatusAcademico',
    fechaCampo: 'fechaStatusAcademico',
    observacionesCampo: 'observacionesStatusAcademico',
    estados: [
      { value: 'PENDIENTE', label: 'Pendiente' },
      { value: 'SOLICITADO', label: 'Solicitado' },
      { value: 'ACTUALIZADO', label: 'Actualizado' },
      { value: 'VALIDADO', label: 'Validado' },
      { value: 'OBSERVADO', label: 'Observado' },
      { value: 'NO_APLICA', label: 'No aplica' }
    ]
  }
};

@Component({
  selector: 'app-admin-modulo-seguimiento',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './admin-modulo-seguimiento.component.html',
  styleUrls: ['./admin-modulo-seguimiento.component.css']
})
export class AdminModuloSeguimientoComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  convocatoriaId: number | null = null;
  convocatoriaTitulo = 'Convocatoria';
  config: ModuloConfig = CONFIGS['seguro-medico'];

  loading = true;
  error: string | null = null;
  registros: SeguimientoPostulacion[] = [];
  stats = { total: 0, aceptadas: 0, pendientes: 0, rechazadas: 0 };

  filtroTexto = '';
  filtroEstado = '';

  ngOnInit(): void {
    const rawId = Number(this.route.snapshot.paramMap.get('id'));
    this.convocatoriaId = Number.isFinite(rawId) && rawId > 0 ? rawId : null;
    const modulo = (this.route.snapshot.data['moduloOperativo'] || 'seguro-medico') as ModuloOperativo;
    this.config = CONFIGS[modulo] || CONFIGS['seguro-medico'];
    if (!this.convocatoriaId) {
      this.error = 'Convocatoria inválida.';
      this.loading = false;
      return;
    }
    this.cargarConvocatoria();
    this.cargarRegistros();
  }

  cargarConvocatoria(): void {
    if (!this.convocatoriaId) return;
    this.http.get<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}`).subscribe({
      next: (c) => { this.convocatoriaTitulo = c?.titulo || 'Convocatoria'; },
      error: () => { this.convocatoriaTitulo = 'Convocatoria'; }
    });
  }

  cargarRegistros(): void {
    if (!this.convocatoriaId) return;
    this.loading = true;
    this.error = null;
    this.http.get<ModuloResponse>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${this.config.endpoint}`).subscribe({
      next: (data) => {
        this.registros = data?.registros || [];
        this.stats = {
          total: data?.total ?? this.registros.length,
          aceptadas: data?.aceptadas ?? 0,
          pendientes: data?.pendientes ?? 0,
          rechazadas: data?.rechazadas ?? 0
        };
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || `No se pudo cargar el módulo de ${this.config.titulo}.`;
        this.registros = [];
        this.loading = false;
      }
    });
  }

  get registrosFiltrados(): SeguimientoPostulacion[] {
    const q = this.norm(this.filtroTexto);
    const estado = this.norm(this.filtroEstado);
    return (this.registros || []).filter((p) => {
      const estadoModulo = this.norm(this.estadoModulo(p));
      const okQ = !q || this.norm(`${p.folio || ''} ${p.nombre || ''} ${p.correo || ''} ${p.tipoApoyo || ''}`).includes(q);
      const okEstado = !estado || estadoModulo === estado;
      return okQ && okEstado;
    });
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroEstado = '';
  }

  estadoModulo(p: SeguimientoPostulacion): string {
    if (this.config.modulo === 'aceptacion') return p.estado || 'PENDIENTE';
    const campo = this.config.estadoCampo;
    return (campo ? String(p[campo] || '') : '') || 'PENDIENTE';
  }

  fechaModulo(p: SeguimientoPostulacion): string | null {
    const campo = this.config.fechaCampo;
    return campo ? String(p[campo] || '') : null;
  }

  observacionesModulo(p: SeguimientoPostulacion): string | null {
    const campo = this.config.observacionesCampo;
    return campo ? String(p[campo] || '') : null;
  }

  editarSeguimiento(p: SeguimientoPostulacion): void {
    if (!this.config.estados?.length || !this.config.estadoCampo || !this.config.observacionesCampo) return;
    const estadoActual = this.estadoModulo(p);
    const opciones = this.config.estados.map((e) => `<option value="${e.value}" ${e.value === estadoActual ? 'selected' : ''}>${this.escapeHtml(e.label)}</option>`).join('');
    Swal.fire({
      title: `${this.escapeHtml(this.config.titulo)} ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <label for="swal-estado" class="form-label small fw-semibold mb-1">Estatus</label>
          <select id="swal-estado" class="swal2-select mt-0 mb-2" style="display:block;width:100%;">${opciones}</select>
          ${this.seguroMedicoExtraHtml(p)}
          <label for="swal-observaciones" class="form-label small fw-semibold mb-1">Observaciones</label>
          <textarea id="swal-observaciones" class="swal2-textarea mt-0" maxlength="3000">${this.escapeHtml(this.observacionesModulo(p) || '')}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const estado = (document.getElementById('swal-estado') as HTMLSelectElement | null)?.value || '';
        const observaciones = (document.getElementById('swal-observaciones') as HTMLTextAreaElement | null)?.value?.trim() || '';
        const numeroSeguroMedico = (document.getElementById('swal-numero-seguro-medico') as HTMLInputElement | null)?.value?.trim() || '';
        const evidenciaSeguroMedico = (document.getElementById('swal-evidencia-seguro-medico') as HTMLInputElement | null)?.files?.[0] || null;
        if (evidenciaSeguroMedico && evidenciaSeguroMedico.type !== 'application/pdf' && !evidenciaSeguroMedico.name.toLowerCase().endsWith('.pdf')) {
          Swal.showValidationMessage('La evidencia debe ser un archivo PDF');
          return false;
        }
        if (!estado) {
          Swal.showValidationMessage('Selecciona un estatus');
          return false;
        }
        return { estado, observaciones, numeroSeguroMedico, evidenciaSeguroMedico };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      const url = `${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/${this.config.endpoint}`;
      const endpoint = this.config.modulo === 'constancias' ? `${url}/seguimiento` : url;
      let body: Record<string, string> | FormData = {};
      if (this.config.modulo === 'seguro-medico') {
        const fd = new FormData();
        fd.append(String(this.config.estadoCampo), res.value.estado);
        fd.append(String(this.config.observacionesCampo), res.value.observaciones || '');
        fd.append('numeroSeguroMedico', res.value.numeroSeguroMedico || '');
        if (res.value.evidenciaSeguroMedico) fd.append('evidenciaSeguroMedico', res.value.evidenciaSeguroMedico);
        body = fd;
      } else {
        body[String(this.config.estadoCampo)] = res.value.estado;
        body[String(this.config.observacionesCampo)] = res.value.observaciones;
      }
      this.http.post<any>(endpoint, body).subscribe({
        next: () => {
          this.cargarRegistros();
          Swal.fire({ icon: 'success', title: 'Guardado', text: 'El seguimiento fue actualizado.', confirmButtonColor: '#800020' });
        },
        error: (err) => this.mostrarError(err, 'No se pudo guardar el seguimiento.')
      });
    });
  }

  private seguroMedicoExtraHtml(p: SeguimientoPostulacion): string {
    if (this.config.modulo !== 'seguro-medico') return '';
    const evidencia = p.seguroMedicoDocumentoId
      ? `<div class="small text-muted mb-2"><i class="fas fa-paperclip me-1"></i>Evidencia actual: ${this.escapeHtml(p.seguroMedicoNombreArchivo || 'seguro_medico.pdf')}</div>`
      : '<div class="small text-muted mb-2">Sin evidencia cargada.</div>';
    return `
          <label for="swal-numero-seguro-medico" class="form-label small fw-semibold mb-1">Número de seguro médico</label>
          <input id="swal-numero-seguro-medico" class="swal2-input mt-0 mb-2" maxlength="100" value="${this.escapeHtml(p.numeroSeguroMedico || '')}" placeholder="Número de póliza, afiliación o referencia" />
          <label for="swal-evidencia-seguro-medico" class="form-label small fw-semibold mb-1">Documento de evidencia (PDF)</label>
          ${evidencia}
          <input id="swal-evidencia-seguro-medico" type="file" class="form-control form-control-sm mb-2" accept=".pdf,application/pdf" />`;
  }
  aceptarYEnviar(p: SeguimientoPostulacion): void {
    if (!this.convocatoriaId) return;
    const aceptada = this.esAceptada(p);
    const endpoint = aceptada ? 'aceptacion/reenviar' : 'aceptar';
    const folio = this.escapeHtml(p.folio || `SOL-${p.id}`);
    const solicitante = this.escapeHtml(p.nombre || p.correo || 'Solicitante');

    Swal.fire({
      icon: 'question',
      title: aceptada ? 'Reenviar aceptación' : 'Aceptar y enviar',
      width: 680,
      html: `
        <div class="text-start">
          <p class="small text-muted mb-3">
            Se enviará el correo de aceptación a <strong>${solicitante}</strong> para la solicitud <strong>${folio}</strong>.
          </p>
          <label for="swal-mensaje-aceptacion" class="form-label small fw-semibold mb-1">Mensaje del correo</label>
          <textarea id="swal-mensaje-aceptacion" class="swal2-textarea mt-0" maxlength="4000" placeholder="Escribe el mensaje que recibirá la persona solicitante.">${this.escapeHtml(p.observacionesAceptacion || '')}</textarea>
          <label for="swal-documento-aceptacion" class="form-label small fw-semibold mb-1">Documento específico para adjuntar</label>
          <input id="swal-documento-aceptacion" type="file" class="form-control form-control-sm mb-2" accept=".pdf,.docx,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" />
          <div class="small text-muted">
            Formatos permitidos: PDF, DOCX o XLSX. Si no adjuntas archivo, se usará el documento de aceptación configurado en la convocatoria cuando exista.
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: aceptada ? 'Reenviar correo' : 'Aceptar y enviar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        const mensajeCorreo = (document.getElementById('swal-mensaje-aceptacion') as HTMLTextAreaElement | null)?.value?.trim() || '';
        const documentoAceptacion = (document.getElementById('swal-documento-aceptacion') as HTMLInputElement | null)?.files?.[0] || null;
        if (documentoAceptacion) {
          const nombre = documentoAceptacion.name.toLowerCase();
          const extensionValida = nombre.endsWith('.pdf') || nombre.endsWith('.docx') || nombre.endsWith('.xlsx');
          if (!extensionValida) {
            Swal.showValidationMessage('El documento debe ser PDF, DOCX o XLSX');
            return false;
          }
        }
        return { mensajeCorreo, documentoAceptacion };
      }
    }).then((res) => {
      if (!res.isConfirmed || !this.convocatoriaId) return;
      const fd = new FormData();
      fd.append('mensajeCorreo', res.value?.mensajeCorreo || '');
      if (res.value?.documentoAceptacion) {
        fd.append('documentoAceptacion', res.value.documentoAceptacion);
      }
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/${endpoint}`, fd).subscribe({
        next: () => {
          this.cargarRegistros();
          Swal.fire({
            icon: 'success',
            title: 'Listo',
            text: aceptada ? 'Correo de aceptación reenviado.' : 'Solicitud aceptada y correo enviado.',
            confirmButtonColor: '#800020'
          });
        },
        error: (err) => this.mostrarError(err, 'No se pudo completar la aceptación.')
      });
    });
  }
  generarDocumento(p: SeguimientoPostulacion, tipo: 'CONSTANCIA' | 'CARTA_CIERRE'): void {
    if (!this.convocatoriaId) return;
    const titulo = tipo === 'CARTA_CIERRE' ? 'Generar carta de cierre' : 'Generar constancia final';
    Swal.fire({
      title: `${titulo} ${this.escapeHtml(p.folio || `SOL-${p.id}`)}`,
      html: `
        <div class="text-start">
          <p class="small text-muted mb-2">Se generará un PDF, se notificará a la persona y se enviará por correo.</p>
          <label for="swal-observaciones" class="form-label small fw-semibold mb-1">Observaciones</label>
          <textarea id="swal-observaciones" class="swal2-textarea mt-0" maxlength="3000">${this.escapeHtml(p.observacionesConstanciaFinal || '')}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Generar',
      confirmButtonColor: '#198754',
      cancelButtonText: 'Cancelar',
      preConfirm: () => ({
        tipo,
        observacionesConstanciaFinal: (document.getElementById('swal-observaciones') as HTMLTextAreaElement | null)?.value?.trim() || ''
      })
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.convocatoriaId) return;
      this.http.post<any>(`${environment.apiBaseUrl}/admin/convocatorias/${this.convocatoriaId}/postulaciones/${p.id}/constancias/generar`, res.value).subscribe({
        next: () => {
          this.cargarRegistros();
          Swal.fire({ icon: 'success', title: 'Documento generado', text: 'El documento final fue generado y notificado.', confirmButtonColor: '#800020' });
        },
        error: (err) => this.mostrarError(err, 'No se pudo generar el documento final.')
      });
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

  esAceptada(p: SeguimientoPostulacion): boolean {
    return this.norm(p.estado || '') === 'aceptada';
  }

  badgeClass(estado: string | null | undefined): string {
    const e = this.norm(estado || '');
    if (['aceptada', 'aprobada', 'validado', 'actualizado', 'completo', 'constancia_emitida', 'carta_emitida', 'entregado'].includes(e)) return 'bg-success';
    if (['rechazada', 'cancelada', 'observado'].includes(e)) return 'bg-danger';
    if (['con_observaciones', 'en_proceso', 'solicitado'].includes(e)) return 'bg-warning text-dark';
    return 'bg-secondary';
  }

  formatearFecha(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  }

  etiquetaEstado(value?: string | null): string {
    if (!value) return 'Pendiente';
    const match = this.config.estados?.find((e) => e.value === value);
    return match?.label || value.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());
  }

  private mostrarError(err: any, fallback: string): void {
    Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || err?.error?.error || fallback, confirmButtonColor: '#800020' });
  }

  private norm(value: string): string {
    return (value || '').toString().trim().toLowerCase();
  }

  private escapeHtml(value: string): string {
    return (value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}






