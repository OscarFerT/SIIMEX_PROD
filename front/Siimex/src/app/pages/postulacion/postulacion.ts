import { Component, AfterViewInit, Inject, ViewEncapsulation, OnInit } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

export interface CriterioFormulario {
  clave: string;
  etiqueta: string;
  tipo: 'texto' | 'numero' | 'select' | 'checkbox' | 'textarea';
  opciones?: string[];
  peso: number;
  requerido: boolean;
}

export interface RequisitoDocumento {
  clave: string;
  etiqueta: string;
  requerido: boolean;
}

export interface FormatoConvocatoria {
  id: number;
  convocatoriaId?: number;
  nombre: string;
  descripcion?: string | null;
  nombreArchivo: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  fechaSubida?: string | null;
}

export interface Convocatoria {
  id: number;
  titulo: string;
  folioPrefijo?: string | null;
  criteriosFormulario?: string | null;
  requisitosDocumentos?: string | null;
  tiposApoyo?: string | null;
  reglasConfigurables?: string | null;
  formatos?: FormatoConvocatoria[];
  diasMinAnticipacion?: number | null;
  diasMaxAnticipacion?: number | null;
  avisoPrivacidadObligatorio?: boolean;
  avisoPrivacidadTexto?: string | null;
  avisoPrivacidadUrl?: string | null;
  [key: string]: unknown;
}

interface ReglaConfigurable {
  clave: string;
  valor: string;
  descripcion?: string;
}

interface MiPostulacionDetalle {
  id: number;
  estado: string;
  cedula?: string | null;
  curp?: string | null;
  correo?: string | null;
  telefono?: string | null;
  tipoApoyo?: string | null;
  tipoSolicitud?: string | null;
  fechaEvento?: string | null;
  tituloProyecto?: string | null;
  descripcionProyecto?: string | null;
  observacionesRevision?: string | null;
  fechaRevision?: string | null;
  fechaLimiteCorreccion?: string | null;
  observaciones?: string | null;
  criteriosJson?: string | null;
  estadoComite?: string | null;
  montoApoyoAsignado?: number | null;
  observacionesComite?: string | null;
  fechaComite?: string | null;
  banco?: string | null;
  titularCuenta?: string | null;
  cuentaBancaria?: string | null;
  clabeInterbancaria?: string | null;
  medioNotificacion?: string | null;
  fechaActualizacionBancaria?: string | null;
  estadoEntregaApoyo?: string | null;
  fechaEntregaApoyo?: string | null;
  observacionesEntregaApoyo?: string | null;
  estadoCotejo?: string | null;
  observacionesCotejo?: string | null;
  fechaCotejo?: string | null;
  estadoInforme?: string | null;
  informesRequeridos?: string | null;
  requiereInformeParcial?: boolean;
  requiereInformeFinal?: boolean;
  fechaLimiteInformeParcial?: string | null;
  fechaLimiteInformeFinal?: string | null;
  fechaInformeParcial?: string | null;
  fechaInformeFinal?: string | null;
  observacionesInforme?: string | null;
  motivoIncumplimientoInforme?: string | null;
  informeParcialDocumentoId?: number | null;
  informeParcialNombreArchivo?: string | null;
  informeFinalDocumentoId?: number | null;
  informeFinalNombreArchivo?: string | null;
  estadoRenuncia?: string | null;
  motivoRenuncia?: string | null;
  fechaSolicitudRenuncia?: string | null;
  fechaResolucionRenuncia?: string | null;
  observacionesRenuncia?: string | null;
  avisoPrivacidadAceptado?: boolean;
  fechaAceptacionAvisoPrivacidad?: string | null;
  cartaEvaluadorDocumentoId?: number | null;
  cartaEvaluadorNombreArchivo?: string | null;
  dictamenEvaluacionDocumentoId?: number | null;
  dictamenEvaluacionNombreArchivo?: string | null;
  constanciaEvaluadorDocumentoId?: number | null;
  constanciaEvaluadorNombreArchivo?: string | null;
  oficioAprobacionDocumentoId?: number | null;
  oficioAprobacionNombreArchivo?: string | null;
  fechaOficioAprobacion?: string | null;
  nombramientoDocumentoId?: number | null;
  nombramientoNombreArchivo?: string | null;
  fechaNombramiento?: string | null;
  reciboPagoDocumentoId?: number | null;
  reciboPagoNombreArchivo?: string | null;
  estadoReciboPago?: string | null;
  fechaReciboPago?: string | null;
  fechaValidacionReciboPago?: string | null;
  observacionesReciboPago?: string | null;
}

@Component({
  selector: 'app-postulacion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './postulacion.html',
  styleUrls: ['./postulacion.css'],
  encapsulation: ViewEncapsulation.None
})
export class PostulacionComponent implements OnInit, AfterViewInit {
  private readonly apiBase = environment.apiBaseUrl || 'http://localhost:8083';
  convocatoriaId: string | null = null;
  convocatoria: Convocatoria | null = null;
  criterios: CriterioFormulario[] = [];
  requisitosDocs: RequisitoDocumento[] = [];
  formatosConvocatoria: FormatoConvocatoria[] = [];
  tiposApoyoDisponibles: string[] = [];
  reglasConfigurables: ReglaConfigurable[] = [];
  loadingConv = true;
  errorConv: string | null = null;
  estadoPostulacionPendiente: { id?: number; estado: string; fecha: string } | null = null;
  miPostulacion: MiPostulacionDetalle | null = null;
  modoEdicion = false;
  plazoCorreccionVencido = false;
  horasRestantesCorreccion: number | null = null;
  private vistaInicializada = false;
  private datosPerfil: { curp?: string; email?: string; telefono?: string; cedulaProfesional?: string } | null = null;
  subiendoInformeParcial = false;
  subiendoInformeFinal = false;
  subiendoReciboPago = false;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private doc: Document,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.cleanupFloatingOverlays();
    this.cargarDatosPerfil();

    this.convocatoriaId = this.route.snapshot.paramMap.get('convocatoriaId');
    this.modoEdicion = this.route.snapshot.queryParamMap.get('editar') === '1';
    this.cargarEstadoPendienteLocal();
    if (this.convocatoriaId) {
      this.http.get<Convocatoria>(`${this.apiBase}/convocatorias/${this.convocatoriaId}`).subscribe({
        next: (c) => {
          this.convocatoria = c;
          this.criterios = this.parseCriterios(c.criteriosFormulario);
          this.requisitosDocs = this.parseRequisitosDocs(c.requisitosDocumentos);
          this.formatosConvocatoria = Array.isArray(c.formatos) ? c.formatos : [];
          this.cargarFormatosConvocatoria();
          this.tiposApoyoDisponibles = this.parseTiposApoyo(c.tiposApoyo);
          this.reglasConfigurables = this.parseReglasConfigurables(c.reglasConfigurables);
          this.cargarMiPostulacion();
          this.loadingConv = false;
        },
        error: () => {
          this.errorConv = 'No se pudo cargar la convocatoria.';
          this.loadingConv = false;
        }
      });
    } else {
      this.loadingConv = false;
    }
  }

  private parseCriterios(json: string | null | undefined): CriterioFormulario[] {
    if (!json?.trim()) return [];
    try {
      const arr = JSON.parse(json) as CriterioFormulario[];
      return Array.isArray(arr) ? arr.filter(c => c.clave && c.etiqueta) : [];
    } catch {
      return [];
    }
  }

  private parseRequisitosDocs(json: string | null | undefined): RequisitoDocumento[] {
    if (!json?.trim()) return [];
    try {
      const arr = JSON.parse(json) as RequisitoDocumento[];
      return Array.isArray(arr) ? arr.filter(r => r.clave && r.etiqueta) : [];
    } catch {
      return [];
    }
  }

  private cargarFormatosConvocatoria(): void {
    if (!this.convocatoriaId) return;
    this.http.get<FormatoConvocatoria[]>(`${this.apiBase}/convocatorias/${this.convocatoriaId}/formatos`).subscribe({
      next: (formatos) => this.formatosConvocatoria = formatos || [],
      error: () => this.formatosConvocatoria = this.formatosConvocatoria || []
    });
  }

  private parseTiposApoyo(json: string | null | undefined): string[] {
    if (!json?.trim()) return [];
    try {
      const arr = JSON.parse(json) as string[];
      const vistos = new Set<string>();
      const out: string[] = [];
      (Array.isArray(arr) ? arr : []).forEach((x) => {
        const v = (x || '').trim();
        if (!v) return;
        const k = v.toLowerCase();
        if (vistos.has(k)) return;
        vistos.add(k);
        out.push(v);
      });
      return out;
    } catch {
      return [];
    }
  }

  private parseReglasConfigurables(json: string | null | undefined): ReglaConfigurable[] {
    if (!json?.trim()) return [];
    try {
      const arr = JSON.parse(json) as ReglaConfigurable[];
      const out: ReglaConfigurable[] = [];
      (Array.isArray(arr) ? arr : []).forEach((x) => {
        const clave = (x?.clave || '').trim();
        const valor = (x?.valor || '').trim();
        const descripcion = (x?.descripcion || '').trim();
        if (!clave || !valor) return;
        out.push({ clave, valor, descripcion });
      });
      return out;
    } catch {
      return [];
    }
  }

  getInputName(c: CriterioFormulario): string {
    return 'criterio_' + c.clave;
  }

  isSelect(c: CriterioFormulario): boolean { return c.tipo === 'select'; }
  isCheckbox(c: CriterioFormulario): boolean { return c.tipo === 'checkbox'; }
  isTextarea(c: CriterioFormulario): boolean { return c.tipo === 'textarea'; }
  isNumero(c: CriterioFormulario): boolean { return c.tipo === 'numero'; }

  ngAfterViewInit(): void {
    // Ejecuta DOM-only solo en navegador (evita "document is not defined")
    if (!isPlatformBrowser(this.platformId)) return;
    this.cleanupFloatingOverlays();
    this.vistaInicializada = true;
    this.aplicarValoresMiPostulacionEnFormulario();
    this.aplicarDatosPerfilEnFormulario();

    const form = this.doc.getElementById('postulacionForm') as HTMLFormElement | null;
    if (!form) return;

    const submitBtn   = this.doc.getElementById('submitBtn') as HTMLButtonElement | null;
    const cvInput     = this.doc.getElementById('cv') as HTMLInputElement | null;
    const cvAlert     = this.doc.getElementById('cvAlert') as HTMLElement | null;
    const formMessage = this.doc.getElementById('formMessage') as HTMLElement | null;

    // CURP en mayúsculas y sin espacios
    const curp = this.doc.getElementById('curp') as HTMLInputElement | null;
    curp?.addEventListener('input', () => {
      curp.value = curp.value.toUpperCase().replace(/\s+/g,'');
    });

    // Teléfono: limpia caracteres no permitidos
    const tel = this.doc.getElementById('telefono') as HTMLInputElement | null;
    tel?.addEventListener('input', () => {
      tel.value = tel.value.replace(/[^\d()+\-\s]/g,'').replace(/\s{2,}/g,' ');
      const telOk = /^[0-9()+\-\s]{7,20}$/.test(tel.value.trim());
      tel.setCustomValidity(telOk ? '' : 'Teléfono inválido');
    });

    // Archivo: 5MB + nombre sin caracteres raros
    cvInput?.addEventListener('change', () => {
      if (!cvInput.files?.length) return;
      const f = cvInput.files[0];
      const pdfOk = this.isPdfFile(f);
      const nameOk = /^[\w\-. ]+$/.test(f.name);
      const sizeOk = f.size <= 5 * 1024 * 1024;

      let msg = '';
      if (!pdfOk) msg += 'Solo se permiten archivos PDF. ';
      if (!sizeOk) msg += 'El archivo supera 5 MB. ';
      if (!nameOk) msg += 'Evita caracteres especiales en el nombre.';

      if (cvAlert){
        cvAlert.style.display = msg ? 'block' : 'none';
        cvAlert.textContent = msg;
      }
      if (!pdfOk || !sizeOk || !nameOk){
        cvInput.value = '';
        cvInput.classList.add('is-invalid');
      } else {
        cvInput.classList.remove('is-invalid');
      }
    });

    // Validación de correos coincidentes
    const correo = this.doc.getElementById('correo') as HTMLInputElement | null;
    const correoConfirm = this.doc.getElementById('correoConfirm') as HTMLInputElement | null;
    
    const validateEmailMatch = () => {
      if (correo && correoConfirm && correo.value && correoConfirm.value) {
        if (correo.value !== correoConfirm.value) {
          correoConfirm.setCustomValidity('Los correos no coinciden');
          correoConfirm.classList.add('is-invalid');
        } else {
          correoConfirm.setCustomValidity('');
          correoConfirm.classList.remove('is-invalid');
        }
      }
    };

    correo?.addEventListener('input', validateEmailMatch);
    correoConfirm?.addEventListener('input', validateEmailMatch);

    // Submit UX
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (this.miPostulacion && !this.modoEdicion) {
        this.showMessage(
          formMessage,
          `Tu solicitud ya fue registrada con estado ${this.miPostulacion.estado}.`,
          false
        );
        return;
      }
      if (this.miPostulacion?.estado === 'CON_OBSERVACIONES' && this.plazoCorreccionVencido) {
        this.showMessage(
          formMessage,
          'El plazo para corregir esta solicitud ya venció. Contacta al administrador.',
          false
        );
        return;
      }

      // Validar correos antes de submit
      validateEmailMatch();

      form.classList.add('was-validated');

      if (!form.checkValidity()){
        const firstInvalid = form.querySelector('.form-control:invalid') as HTMLElement | null;
        firstInvalid?.scrollIntoView({ behavior:'smooth', block:'center' });
        firstInvalid?.focus({ preventScroll:true });
        this.showMessage(formMessage, 'Revisa los campos marcados en rojo.', false);
        return;
      }

      if (submitBtn && this.convocatoriaId){
        const original = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enviando...';

        if (!this.tiposApoyoDisponibles.length) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          this.showMessage(formMessage, 'La convocatoria no tiene tipos de apoyo configurados. Solicita al administrador configurarlos.', false);
          return;
        }

        const criteriosData: Record<string, unknown> = {};
        this.criterios.forEach(cr => {
          const el = form.elements.namedItem(this.getInputName(cr)) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
          if (el) {
            if (cr.tipo === 'checkbox') {
              criteriosData[cr.clave] = (el as HTMLInputElement).checked;
            } else {
              criteriosData[cr.clave] = el.value;
            }
          }
        });

        const cvInput = form.elements.namedItem('cv') as HTMLInputElement;
        const cvFile = cvInput?.files?.[0];
        if (!cvFile && !this.modoEdicion) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          this.showMessage(formMessage, 'Debes adjuntar tu currículum en PDF.', false);
          return;
        }
        if (cvFile && !this.isPdfFile(cvFile)) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          this.showMessage(formMessage, 'El currículum debe estar en formato PDF.', false);
          return;
        }

        const fd = new FormData();
        const fechaEvento = (form.elements.namedItem('fechaEvento') as HTMLInputElement)?.value || '';
        if (!this.fechaEventoEnRango(fechaEvento)) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          this.showMessage(formMessage, `La fecha del evento debe estar entre ${this.diasMinAnticipacion} y ${this.diasMaxAnticipacion} días a partir de hoy.`, false);
          return;
        }
        fd.append('convocatoriaId', this.convocatoriaId);
        fd.append('cedula', (form.elements.namedItem('cedula') as HTMLInputElement)?.value || '');
        fd.append('curp', (form.elements.namedItem('curp') as HTMLInputElement)?.value || '');
        fd.append('correo', (form.elements.namedItem('correo') as HTMLInputElement)?.value || '');
        fd.append('telefono', (form.elements.namedItem('telefono') as HTMLInputElement)?.value || '');
        const tipoApoyo = (form.elements.namedItem('tipoApoyo') as HTMLSelectElement)?.value || '';
        if (!tipoApoyo) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          this.showMessage(formMessage, 'Debes seleccionar un tipo de apoyo.', false);
          return;
        }
        fd.append('tipoApoyo', tipoApoyo);
        fd.append('tipoSolicitud', (form.elements.namedItem('tipoSolicitud') as HTMLSelectElement)?.value || '');
        fd.append('fechaEvento', fechaEvento);
        fd.append('tituloProyecto', (form.elements.namedItem('tituloProyecto') as HTMLInputElement)?.value || '');
        fd.append('descripcionProyecto', (form.elements.namedItem('descripcionProyecto') as HTMLTextAreaElement)?.value || '');
        fd.append('observaciones', (form.elements.namedItem('observaciones') as HTMLTextAreaElement)?.value || '');
        fd.append('criteriosJson', Object.keys(criteriosData).length ? JSON.stringify(criteriosData) : '');
        const aceptaAvisoPrivacidad = (form.elements.namedItem('aceptaAvisoPrivacidad') as HTMLInputElement | null)?.checked;
        fd.append('aceptaAvisoPrivacidad', aceptaAvisoPrivacidad ? 'true' : 'false');
        if (cvFile) {
          fd.append('cv', cvFile);
        }
        for (const r of this.requisitosDocs) {
          const el = form.elements.namedItem('doc_' + r.clave) as HTMLInputElement;
          const file = el?.files?.[0];
          if (!file) continue;
          if (!this.isFormatoSolicitudFile(file)) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
            this.showMessage(formMessage, `El documento "${r.etiqueta}" debe estar en formato PDF, Word o Excel.`, false);
            return;
          }
          if (file.size > 10 * 1024 * 1024) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
            this.showMessage(formMessage, `El documento "${r.etiqueta}" no puede superar 10 MB.`, false);
            return;
          }
          fd.append('doc_' + r.clave, file);
        }

        const request$ = this.modoEdicion && this.miPostulacion?.id
          ? this.http.patch<{ id?: number; message?: string; estado?: string }>(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}`, fd)
          : this.http.post<{ id?: number; message?: string; estado?: string }>(`${this.apiBase}/postulaciones`, fd);

        request$.subscribe({
          next: (res) => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
            if (!this.modoEdicion) {
              form.reset();
              form.classList.remove('was-validated');
              cvInput.value = '';
              this.requisitosDocs.forEach(r => {
                const el = form.elements.namedItem('doc_' + r.clave) as HTMLInputElement;
                if (el) el.value = '';
              });
            }
            this.marcarPendienteLocal(res?.id || this.miPostulacion?.id);
            this.showMessage(formMessage, this.modoEdicion ? 'Postulación actualizada.' : 'Postulación enviada.', true);
            const estadoFinal = res?.estado || (this.modoEdicion ? 'SUBSANADA' : 'PENDIENTE');
            Swal.fire({
              icon: 'success',
              title: this.modoEdicion ? 'Postulación actualizada' : 'Postulación enviada',
              html: `Tu solicitud quedó con estado <b>${estadoFinal}</b> para revisión administrativa.`,
              confirmButtonText: 'Entendido',
              confirmButtonColor: '#8B1538'
            });
            this.modoEdicion = false;
            this.cargarMiPostulacion();
            formMessage?.scrollIntoView({ behavior:'smooth', block:'center' });
          },
          error: (err) => {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
            const msg = err?.error?.error || err?.error?.message || 'No se pudo enviar. Intenta de nuevo.';
            this.showMessage(formMessage, msg, false);
            formMessage?.scrollIntoView({ behavior:'smooth', block:'center' });
          }
        });
      }
    }, { passive:false });
  }

  private showMessage(el: HTMLElement | null, msg: string, ok: boolean){
    if (!el) return;
    el.style.display = 'block';
    el.textContent = msg;
    el.className = ok ? 'form-message success' : 'form-message error';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }

  private isPdfFile(file: File | null | undefined): boolean {
    if (!file) return false;
    const mime = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    return mime.includes('pdf') || name.endsWith('.pdf');
  }

  private isFormatoSolicitudFile(file: File | null | undefined): boolean {
    if (!file) return false;
    const name = (file.name || '').toLowerCase();
    const mime = (file.type || '').toLowerCase();
    return this.isPdfFile(file)
      || name.endsWith('.doc')
      || name.endsWith('.docx')
      || name.endsWith('.xls')
      || name.endsWith('.xlsx')
      || mime.includes('word')
      || mime.includes('excel')
      || mime.includes('spreadsheet');
  }

  /**
   * Evita que un backdrop/modal/offcanvas "colgado" de otra vista
   * bloquee interacción en esta pantalla (inputs no escribibles).
   */
  private cleanupFloatingOverlays(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.doc.querySelectorAll('.modal-backdrop, .offcanvas-backdrop').forEach((el) => el.remove());
    this.doc.querySelectorAll('.offcanvas.show, .modal.show').forEach((el) => el.classList.remove('show'));

    const body = this.doc.body;
    body.classList.remove('modal-open');
    body.style.removeProperty('overflow');
    body.style.removeProperty('padding-right');
  }

  private cargarMiPostulacion(): void {
    if (!this.convocatoriaId) return;
    this.http.get<MiPostulacionDetalle>(`${this.apiBase}/postulaciones/mias/convocatoria/${this.convocatoriaId}`).subscribe({
      next: (data) => {
        this.miPostulacion = data;
        if ((!this.tiposApoyoDisponibles || this.tiposApoyoDisponibles.length === 0) && data?.tipoApoyo) {
          this.tiposApoyoDisponibles = [data.tipoApoyo];
        }
        if (data?.estado === 'PENDIENTE') {
          this.estadoPostulacionPendiente = {
            id: data.id,
            estado: data.estado,
            fecha: new Date().toISOString()
          };
        }
        this.actualizarEstadoPlazoCorreccion(data);
        if (data?.estado === 'CON_OBSERVACIONES') {
          this.modoEdicion = !this.plazoCorreccionVencido;
        }
        this.aplicarValoresMiPostulacionEnFormulario();
      },
      error: () => {
        this.miPostulacion = null;
        this.plazoCorreccionVencido = false;
        this.horasRestantesCorreccion = null;
      }
    });
  }

  get fechaLimiteCorreccionTexto(): string {
    const raw = this.miPostulacion?.fechaLimiteCorreccion;
    if (!raw) return 'No definida';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get mensajeTiempoCorreccion(): string {
    if (this.horasRestantesCorreccion == null) return 'El plazo será definido por administración.';
    if (this.plazoCorreccionVencido) return 'El plazo de corrección venció.';
    if (this.horasRestantesCorreccion < 24) return `Te quedan ${this.horasRestantesCorreccion} hora(s) para editar.`;
    const dias = Math.ceil(this.horasRestantesCorreccion / 24);
    return `Te quedan ${dias} día(s) para editar.`;
  }

  private actualizarEstadoPlazoCorreccion(data: MiPostulacionDetalle | null): void {
    this.plazoCorreccionVencido = false;
    this.horasRestantesCorreccion = null;
    if (!data || data.estado !== 'CON_OBSERVACIONES' || !data.fechaLimiteCorreccion) {
      return;
    }
    const limite = new Date(data.fechaLimiteCorreccion);
    if (isNaN(limite.getTime())) return;
    const diffMs = limite.getTime() - Date.now();
    this.horasRestantesCorreccion = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
    this.plazoCorreccionVencido = diffMs <= 0;
  }

  private aplicarValoresMiPostulacionEnFormulario(): void {
    if (!this.vistaInicializada || !isPlatformBrowser(this.platformId) || !this.miPostulacion) return;

    const form = this.doc.getElementById('postulacionForm') as HTMLFormElement | null;
    if (!form) return;

    const setValue = (name: string, value?: string | null) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (!el || value == null) return;
      if (el instanceof HTMLSelectElement) {
        const existing = Array.from(el.options).some((opt) => opt.value === value);
        if (!existing && value.trim()) {
          const opt = this.doc.createElement('option');
          opt.value = value;
          opt.textContent = value;
          el.appendChild(opt);
        }
      }
      el.value = value;
    };

    setValue('cedula', this.miPostulacion.cedula);
    setValue('curp', this.miPostulacion.curp);
    setValue('correo', this.miPostulacion.correo);
    setValue('correoConfirm', this.miPostulacion.correo);
    setValue('telefono', this.miPostulacion.telefono);
    setValue('tipoApoyo', this.miPostulacion.tipoApoyo);
    setValue('tipoSolicitud', this.miPostulacion.tipoSolicitud);
    setValue('fechaEvento', this.miPostulacion.fechaEvento);
    setValue('tituloProyecto', this.miPostulacion.tituloProyecto);
    setValue('descripcionProyecto', this.miPostulacion.descripcionProyecto);
    setValue('observaciones', this.miPostulacion.observaciones);
    const avisoEl = form.elements.namedItem('aceptaAvisoPrivacidad') as HTMLInputElement | null;
    if (avisoEl) {
      avisoEl.checked = this.miPostulacion.avisoPrivacidadAceptado === true;
    }

    if (this.miPostulacion.criteriosJson) {
      try {
        const criteriosGuardados = JSON.parse(this.miPostulacion.criteriosJson) as Record<string, unknown>;
        this.criterios.forEach((cr) => {
          const el = form.elements.namedItem(this.getInputName(cr)) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
          if (!el) return;
          const value = criteriosGuardados[cr.clave];
          if (cr.tipo === 'checkbox') {
            (el as HTMLInputElement).checked = Boolean(value);
          } else if (value != null) {
            el.value = String(value);
          }
        });
      } catch {
      }
    }
  }

  private cargarDatosPerfil(): void {
    this.http.get<{ curp?: string; email?: string; telefono?: string; cedulaProfesional?: string }>(`${this.apiBase}/usuarios/me`).subscribe({
      next: (perfil) => {
        this.datosPerfil = perfil;
        this.aplicarDatosPerfilEnFormulario();
      },
      error: () => {}
    });
  }

  private aplicarDatosPerfilEnFormulario(): void {
    if (!this.vistaInicializada || !isPlatformBrowser(this.platformId) || !this.datosPerfil) return;
    if (this.miPostulacion) return;

    const form = this.doc.getElementById('postulacionForm') as HTMLFormElement | null;
    if (!form) return;

    const setIfEmpty = (name: string, value?: string | null) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | null;
      if (el && !el.value && value) el.value = value;
    };

    setIfEmpty('curp', this.datosPerfil.curp);
    setIfEmpty('correo', this.datosPerfil.email);
    setIfEmpty('correoConfirm', this.datosPerfil.email);
    setIfEmpty('telefono', this.datosPerfil.telefono);
    setIfEmpty('cedula', this.datosPerfil.cedulaProfesional);
  }

  private getEstadoLocalKey(): string | null {
    if (!this.convocatoriaId) return null;
    return `postulacion_estado_conv_${this.convocatoriaId}`;
  }

  private cargarEstadoPendienteLocal(): void {
    const key = this.getEstadoLocalKey();
    if (!key || !isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { id?: number; estado: string; fecha: string };
      if (parsed?.estado === 'PENDIENTE') {
        this.estadoPostulacionPendiente = parsed;
      }
    } catch {
      this.estadoPostulacionPendiente = null;
    }
  }

  private marcarPendienteLocal(postulacionId?: number): void {
    const key = this.getEstadoLocalKey();
    if (!key || !isPlatformBrowser(this.platformId)) return;
    const payload = {
      id: postulacionId,
      estado: 'PENDIENTE',
      fecha: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(payload));
    this.estadoPostulacionPendiente = payload;
  }

  private fechaEventoEnRango(fechaISO: string): boolean {
    if (!fechaISO) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEvento = new Date(`${fechaISO}T00:00:00`);
    if (Number.isNaN(fechaEvento.getTime())) return false;
    const ms = fechaEvento.getTime() - hoy.getTime();
    const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
    return dias >= this.diasMinAnticipacion && dias <= this.diasMaxAnticipacion;
  }

  get diasMinAnticipacion(): number {
    const value = Number(this.convocatoria?.diasMinAnticipacion);
    return Number.isFinite(value) && value >= 0 ? value : 20;
  }

  get diasMaxAnticipacion(): number {
    const value = Number(this.convocatoria?.diasMaxAnticipacion);
    if (Number.isFinite(value) && value >= 0) {
      return Math.max(this.diasMinAnticipacion, value);
    }
    return 60;
  }

  get avisoPrivacidadObligatorio(): boolean {
    return !!this.convocatoria?.avisoPrivacidadObligatorio;
  }

  get puedeCapturarBancaria(): boolean {
    if (!this.miPostulacion) return false;
    const estado = (this.miPostulacion.estado || '').toUpperCase();
    const estadoComite = (this.miPostulacion.estadoComite || '').toUpperCase();
    return estado === 'ACEPTADA' || estadoComite === 'APROBADA';
  }

  get tieneBancariaCapturada(): boolean {
    const p = this.miPostulacion;
    if (!p) return false;
    return !!(p.banco && p.titularCuenta && p.cuentaBancaria && p.clabeInterbancaria && p.medioNotificacion);
  }

  get fechaActualizacionBancariaTexto(): string {
    const raw = this.miPostulacion?.fechaActualizacionBancaria;
    if (!raw) return 'No registrada';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  get fechaOficioAprobacionTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaOficioAprobacion);
  }

  get fechaNombramientoTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaNombramiento);
  }

  get fechaReciboPagoTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaReciboPago);
  }

  get fechaValidacionReciboPagoTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaValidacionReciboPago);
  }

  get fechaEntregaApoyoTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaEntregaApoyo);
  }

  get apoyoEntregado(): boolean {
    return (this.miPostulacion?.estadoEntregaApoyo || '').toUpperCase() === 'APOYO_ENTREGADO';
  }

  get puedeCargarReciboPago(): boolean {
    return this.puedeCapturarBancaria && !!this.miPostulacion?.nombramientoDocumentoId && this.apoyoEntregado;
  }

  abrirModalBancaria(): void {
    if (!this.miPostulacion?.id) return;
    if (!this.puedeCapturarBancaria) {
      Swal.fire({
        icon: 'info',
        title: 'Aún no disponible',
        text: 'La información bancaria solo se habilita para solicitudes aprobadas.',
        confirmButtonColor: '#8B1538'
      });
      return;
    }
    Swal.fire({
      title: this.tieneBancariaCapturada ? 'Editar información bancaria' : 'Capturar información bancaria',
      html: `
        <div class="text-start">
          <label for="swal-banco" class="form-label small fw-semibold mb-1">Banco</label>
          <input id="swal-banco" class="swal2-input mt-0 mb-2" maxlength="120" value="${(this.miPostulacion.banco || '').replace(/"/g, '&quot;')}" />
          <label for="swal-titular" class="form-label small fw-semibold mb-1">Titular de cuenta</label>
          <input id="swal-titular" class="swal2-input mt-0 mb-2" maxlength="180" value="${(this.miPostulacion.titularCuenta || '').replace(/"/g, '&quot;')}" />
          <label for="swal-cuenta" class="form-label small fw-semibold mb-1">Cuenta bancaria</label>
          <input id="swal-cuenta" class="swal2-input mt-0 mb-2" maxlength="34" value="${(this.miPostulacion.cuentaBancaria || '').replace(/"/g, '&quot;')}" />
          <label for="swal-clabe" class="form-label small fw-semibold mb-1">CLABE</label>
          <input id="swal-clabe" class="swal2-input mt-0 mb-2" maxlength="18" value="${(this.miPostulacion.clabeInterbancaria || '').replace(/"/g, '&quot;')}" />
          <label for="swal-medio" class="form-label small fw-semibold mb-1">Medio de notificación</label>
          <select id="swal-medio" class="swal2-select mt-0" style="display:block;width:100%;">
            <option value="">Selecciona...</option>
            <option value="CORREO" ${(this.miPostulacion.medioNotificacion || '') === 'CORREO' ? 'selected' : ''}>Correo</option>
            <option value="TELEFONO" ${(this.miPostulacion.medioNotificacion || '') === 'TELEFONO' ? 'selected' : ''}>Teléfono</option>
            <option value="AMBOS" ${(this.miPostulacion.medioNotificacion || '') === 'AMBOS' ? 'selected' : ''}>Ambos</option>
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#8B1538',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const banco = (this.doc.getElementById('swal-banco') as HTMLInputElement | null)?.value?.trim() || '';
        const titularCuenta = (this.doc.getElementById('swal-titular') as HTMLInputElement | null)?.value?.trim() || '';
        const cuentaBancaria = (this.doc.getElementById('swal-cuenta') as HTMLInputElement | null)?.value?.trim() || '';
        const clabeInterbancaria = (this.doc.getElementById('swal-clabe') as HTMLInputElement | null)?.value?.trim() || '';
        const medioNotificacion = (this.doc.getElementById('swal-medio') as HTMLSelectElement | null)?.value?.trim() || '';
        if (!banco || !titularCuenta || !cuentaBancaria || !clabeInterbancaria || !medioNotificacion) {
          Swal.showValidationMessage('Completa todos los campos bancarios');
          return false;
        }
        return { banco, titularCuenta, cuentaBancaria, clabeInterbancaria, medioNotificacion };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.miPostulacion?.id) return;
      this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/bancaria`, res.value).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Información bancaria guardada',
            text: 'Tus datos bancarios se actualizaron correctamente.',
            confirmButtonColor: '#8B1538'
          });
          this.cargarMiPostulacion();
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo guardar',
            text: err?.error?.error || err?.error?.message || 'Ocurrió un error al guardar la información bancaria.',
            confirmButtonColor: '#8B1538'
          });
        }
      });
    });
  }

  get puedeGestionarInformes(): boolean {
    if (!this.puedeCapturarBancaria) return false;
    return this.requiereInformeParcial || this.requiereInformeFinal;
  }

  get requiereInformeParcial(): boolean {
    if (this.miPostulacion?.requiereInformeParcial != null) {
      return !!this.miPostulacion.requiereInformeParcial;
    }
    const tipo = (this.miPostulacion?.informesRequeridos || '').toUpperCase();
    if (tipo === 'PARCIAL' || tipo === 'AMBOS') return true;
    if (tipo === 'FINAL' || tipo === 'NINGUNO') return false;
    return true;
  }

  get requiereInformeFinal(): boolean {
    if (this.miPostulacion?.requiereInformeFinal != null) {
      return !!this.miPostulacion.requiereInformeFinal;
    }
    const tipo = (this.miPostulacion?.informesRequeridos || '').toUpperCase();
    if (tipo === 'FINAL' || tipo === 'AMBOS') return true;
    if (tipo === 'PARCIAL' || tipo === 'NINGUNO') return false;
    return true;
  }

  get puedeSolicitarRenuncia(): boolean {
    if (!this.miPostulacion) return false;
    const estadoRenuncia = (this.miPostulacion.estadoRenuncia || '').toUpperCase();
    if (estadoRenuncia === 'SOLICITADA' || estadoRenuncia === 'ACEPTADA') return false;
    return this.puedeCapturarBancaria;
  }

  get fechaSolicitudRenunciaTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaSolicitudRenuncia);
  }

  get fechaResolucionRenunciaTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaResolucionRenuncia);
  }

  solicitarRenunciaApoyo(): void {
    if (!this.miPostulacion?.id || !this.puedeSolicitarRenuncia) return;
    Swal.fire({
      title: 'Solicitar renuncia del apoyo',
      html: `
        <div class="text-start">
          <label for="swal-renuncia-motivo" class="form-label small fw-semibold mb-1">Motivo de renuncia</label>
          <textarea id="swal-renuncia-motivo" class="swal2-textarea mt-0" maxlength="3000" placeholder="Describe el motivo de tu renuncia..."></textarea>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Enviar solicitud',
      confirmButtonColor: '#8B1538',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const motivoRenuncia = (this.doc.getElementById('swal-renuncia-motivo') as HTMLTextAreaElement | null)?.value?.trim() || '';
        if (!motivoRenuncia) {
          Swal.showValidationMessage('Debes capturar el motivo de renuncia');
          return false;
        }
        return { motivoRenuncia };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.miPostulacion?.id) return;
      this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/renuncia`, res.value).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Renuncia enviada',
            text: 'Tu solicitud de renuncia fue enviada para revisión administrativa.',
            confirmButtonColor: '#8B1538'
          });
          this.cargarMiPostulacion();
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo enviar',
            text: err?.error?.error || err?.error?.message || 'Ocurrió un error al enviar la renuncia.',
            confirmButtonColor: '#8B1538'
          });
        }
      });
    });
  }

  get fechaLimiteInformeParcialTexto(): string {
    if (!this.requiereInformeParcial) return 'No requerido';
    return this.formatearFechaSimple(this.miPostulacion?.fechaLimiteInformeParcial);
  }

  get fechaLimiteInformeFinalTexto(): string {
    if (!this.requiereInformeFinal) return 'No requerido';
    return this.formatearFechaSimple(this.miPostulacion?.fechaLimiteInformeFinal);
  }

  get estadoInformeTexto(): string {
    return this.miPostulacion?.estadoInforme || 'Sin configurar';
  }

  seleccionarArchivoInformeParcial(input: HTMLInputElement): void {
    if (!this.puedeGestionarInformes || !this.miPostulacion?.id) return;
    input.click();
  }

  seleccionarArchivoInformeFinal(input: HTMLInputElement): void {
    if (!this.puedeGestionarInformes || !this.miPostulacion?.id) return;
    input.click();
  }

  seleccionarArchivoReciboPago(input: HTMLInputElement): void {
    if (!this.puedeCargarReciboPago || !this.miPostulacion?.id) return;
    input.click();
  }

  onInformeParcialSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.miPostulacion?.id) return;
    if (!this.requiereInformeParcial) {
      Swal.fire('No requerido', 'Esta convocatoria no solicita informe parcial.', 'info');
      input.value = '';
      return;
    }
    if (!this.isPdfFile(file)) {
      Swal.fire('Archivo inválido', 'El informe parcial debe ser PDF.', 'warning');
      input.value = '';
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    this.subiendoInformeParcial = true;
    this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/informes/parcial`, fd).subscribe({
      next: () => {
        this.subiendoInformeParcial = false;
        input.value = '';
        Swal.fire({ icon: 'success', title: 'Informe parcial cargado', text: 'Tu informe parcial se cargó correctamente.', confirmButtonColor: '#8B1538' });
        this.cargarMiPostulacion();
      },
      error: (err) => {
        this.subiendoInformeParcial = false;
        input.value = '';
        Swal.fire({ icon: 'error', title: 'No se pudo subir', text: err?.error?.error || err?.error?.message || 'Error al subir el informe parcial.', confirmButtonColor: '#8B1538' });
      }
    });
  }

  onInformeFinalSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.miPostulacion?.id) return;
    if (!this.requiereInformeFinal) {
      Swal.fire('No requerido', 'Esta convocatoria no solicita informe final.', 'info');
      input.value = '';
      return;
    }
    if (!this.isPdfFile(file)) {
      Swal.fire('Archivo inválido', 'El informe final debe ser PDF.', 'warning');
      input.value = '';
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    this.subiendoInformeFinal = true;
    this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/informes/final`, fd).subscribe({
      next: () => {
        this.subiendoInformeFinal = false;
        input.value = '';
        Swal.fire({ icon: 'success', title: 'Informe final cargado', text: 'Tu informe final se cargó correctamente.', confirmButtonColor: '#8B1538' });
        this.cargarMiPostulacion();
      },
      error: (err) => {
        this.subiendoInformeFinal = false;
        input.value = '';
        Swal.fire({ icon: 'error', title: 'No se pudo subir', text: err?.error?.error || err?.error?.message || 'Error al subir el informe final.', confirmButtonColor: '#8B1538' });
      }
    });
  }

  onReciboPagoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.miPostulacion?.id) return;
    if (!this.puedeCargarReciboPago) {
      Swal.fire('No disponible', 'El recibo se habilita cuando tu nombramiento haya sido emitido y COMECYT registre la entrega del apoyo económico.', 'info');
      input.value = '';
      return;
    }
    if (!this.isPdfFile(file)) {
      Swal.fire('Archivo inválido', 'El recibo de pago debe ser PDF.', 'warning');
      input.value = '';
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    this.subiendoReciboPago = true;
    this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/recibo-pago`, fd).subscribe({
      next: () => {
        this.subiendoReciboPago = false;
        input.value = '';
        Swal.fire({ icon: 'success', title: 'Recibo cargado', text: 'Tu recibo de pago se cargó correctamente.', confirmButtonColor: '#8B1538' });
        this.cargarMiPostulacion();
      },
      error: (err) => {
        this.subiendoReciboPago = false;
        input.value = '';
        Swal.fire({ icon: 'error', title: 'No se pudo subir', text: err?.error?.error || err?.error?.message || 'Error al subir el recibo de pago.', confirmButtonColor: '#8B1538' });
      }
    });
  }

  descargarDocumento(documentoId?: number | null): void {
    if (!documentoId) return;
    window.open(`${this.apiBase}/documentos/${documentoId}`, '_blank');
  }

  descargarFormatoConvocatoria(formato: FormatoConvocatoria): void {
    const convocatoriaId = this.convocatoriaId || formato.convocatoriaId;
    if (!convocatoriaId || !formato?.id) return;
    window.open(`${this.apiBase}/convocatorias/${convocatoriaId}/formatos/${formato.id}`, '_blank');
  }

  formatearPeso(bytes: number | null | undefined): string {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private formatearFechaSimple(raw: string | null | undefined): string {
    if (!raw) return 'No definida';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  private formatearFechaSimpleConHora(raw: string | null | undefined): string {
    if (!raw) return 'No definida';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
