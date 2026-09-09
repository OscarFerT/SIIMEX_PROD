import { Component, AfterViewInit, Inject, ViewEncapsulation, OnInit, OnDestroy } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';
import { PdfLimiteService } from '../../core/pdf-limite.service';

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

interface ArchivoSeleccionado {
  file: File;
  previewUrl: string;
}

interface DocumentoAdjuntoPostulacion {
  clave?: string | null;
  documentoId?: number | null;
  nombreArchivo?: string | null;
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
  diasMinAnticipacionHabilitado?: boolean | null;
  diasMaxAnticipacion?: number | null;
  diasMaxAnticipacionHabilitado?: boolean | null;
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
  estadoCuentaDocumentoId?: number | null;
  estadoCuentaNombreArchivo?: string | null;
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
  renunciaDocumentoId?: number | null;
  renunciaNombreArchivo?: string | null;
  avisoPrivacidadAceptado?: boolean;
  fechaAceptacionAvisoPrivacidad?: string | null;
  curriculumDocumentoId?: number | null;
  curriculumNombreArchivo?: string | null;
  documentosAdjuntos?: DocumentoAdjuntoPostulacion[] | null;
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
  estadoSeguroMedico?: string | null;
  fechaSeguroMedico?: string | null;
  numeroSeguroMedico?: string | null;
  seguroMedicoDocumentoId?: number | null;
  seguroMedicoNombreArchivo?: string | null;
  observacionesSeguroMedico?: string | null;
  estadoStatusAcademico?: string | null;
  fechaStatusAcademico?: string | null;
  observacionesStatusAcademico?: string | null;
  informacionStatusAcademico?: string | null;
  statusAcademicoDocumentoId?: number | null;
  statusAcademicoNombreArchivo?: string | null;
}

@Component({
  selector: 'app-postulacion',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './postulacion.html',
  styleUrls: ['./postulacion.css'],
  encapsulation: ViewEncapsulation.None
})
export class PostulacionComponent implements OnInit, AfterViewInit, OnDestroy {
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
  estadoBorradorPostulacion: { fecha: string; archivos: string[] } | null = null;
  miPostulacion: MiPostulacionDetalle | null = null;
  modoEdicion = false;
  plazoCorreccionVencido = false;
  horasRestantesCorreccion: number | null = null;
  private vistaInicializada = false;
  private cargaMiPostulacionTerminada = false;
  private autosaveBorradorConfigurado = false;
  private borradorRestaurado = false;
  private borradorSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private beforeUnloadBorradorHandler: (() => void) | null = null;
  private datosPerfil: { curp?: string; email?: string; telefono?: string; cedulaProfesional?: string } | null = null;
  subiendoInformeParcial = false;
  subiendoInformeFinal = false;
  subiendoReciboPago = false;
  subiendoSeguroMedico = false;
  subiendoStatusAcademico = false;
  pdfLimitMbByKey: Record<string, number> = {};
  archivosSeleccionados: Record<string, ArchivoSeleccionado> = {};

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private doc: Document,
    private route: ActivatedRoute,
    private http: HttpClient,
    private pdfLimiteService: PdfLimiteService
  ) {}

  ngOnInit(): void {
    this.cleanupFloatingOverlays();
    this.cargarLimitesPdf();
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

  get tipoSolicitudActivo(): boolean {
    const regla = this.buscarReglaConfigurable([
      'tipo_solicitud_activo',
      'tipo_solicitud_habilitado',
      'solicitar_tipo_solicitud'
    ]);
    return regla ? this.resolverBooleanoRegla(regla.valor, true) : true;
  }

  
  get fechaEventoActivo(): boolean {
    const regla = this.buscarReglaConfigurable([
      'fecha_evento_activa',
      'fecha_evento_habilitada',
      'solicitar_fecha_evento'
    ]);
    return regla ? this.resolverBooleanoRegla(regla.valor, true) : true;
  }
  private buscarReglaConfigurable(claves: string[]): ReglaConfigurable | null {
    const buscadas = new Set((claves || []).map((clave) => this.normalizarClaveRegla(clave)).filter(Boolean));
    if (!buscadas.size) return null;
    return (this.reglasConfigurables || []).find((regla) => buscadas.has(this.normalizarClaveRegla(regla.clave))) || null;
  }

  private normalizarClaveRegla(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  }

  private resolverBooleanoRegla(value: string | null | undefined, fallback: boolean): boolean {
    if (value == null) return fallback;
    const v = String(value).trim().toLowerCase();
    if (!v) return fallback;
    if (['true', '1', 'si', 'sí', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    return fallback;
  }
  get informacionProyectoActiva(): boolean {
    const regla = this.buscarReglaConfigurable([
      'informacion_proyecto_activa',
      'proyecto_info_activo',
      'solicitar_informacion_proyecto'
    ]);
    return regla ? this.resolverBooleanoRegla(regla.valor, true) : true;
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
    this.configurarAutosaveBorrador(form);
    this.programarRestauracionBorrador();

    const submitBtn   = this.doc.getElementById('submitBtn') as HTMLButtonElement | null;
    const cvInput     = this.doc.getElementById('cv') as HTMLInputElement | null;
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
    form.addEventListener('submit', async (event) => {
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
        const firstInvalid = form.querySelector('input:invalid, select:invalid, textarea:invalid') as HTMLElement | null;
        firstInvalid?.scrollIntoView({ behavior:'smooth', block:'center' });
        firstInvalid?.focus({ preventScroll:true });
        this.showMessage(formMessage, this.getInvalidFieldMessage(form), false);
        return;
      }

      const confirmaBloqueo = await this.confirmarEnvioYBloqueoFormulario();
      if (!confirmaBloqueo) return;

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
        if (cvFile && !this.validarTamanoPdf(cvFile, 'postulacion.curriculum', 'El currículum', cvInput)) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          return;
        }

        const fd = new FormData();
        const fechaEvento = this.fechaEventoActivo ? ((form.elements.namedItem('fechaEvento') as HTMLInputElement)?.value || '') : '';
        if (this.fechaEventoActivo && !this.fechaEventoEnRango(fechaEvento)) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          this.showMessage(formMessage, this.mensajeRangoFechaEvento(), false);
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
        const tipoSolicitud = this.tipoSolicitudActivo ? ((form.elements.namedItem('tipoSolicitud') as HTMLSelectElement)?.value || '') : '';
        fd.append('tipoSolicitud', tipoSolicitud);
        fd.append('fechaEvento', fechaEvento);
        const tituloProyecto = this.informacionProyectoActiva ? ((form.elements.namedItem('tituloProyecto') as HTMLInputElement)?.value || '') : '';
        const descripcionProyecto = this.informacionProyectoActiva ? ((form.elements.namedItem('descripcionProyecto') as HTMLTextAreaElement)?.value || '') : '';
        fd.append('tituloProyecto', tituloProyecto);
        fd.append('descripcionProyecto', descripcionProyecto);
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
          if (!this.validarTamanoPdf(file, 'postulacion.documentos', `El documento "${r.etiqueta}"`, el)) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = original;
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
              this.quitarArchivoSeleccionado('cv', cvInput, false);
              this.requisitosDocs.forEach(r => {
                const el = form.elements.namedItem('doc_' + r.clave) as HTMLInputElement;
                this.quitarArchivoSeleccionado('doc_' + r.clave, el, false);
              });
            }
            this.limpiarBorradorPostulacion();

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

  private async confirmarEnvioYBloqueoFormulario(): Promise<boolean> {
    const esCorreccion = this.modoEdicion;
    const result = await Swal.fire({
      icon: 'warning',
      title: esCorreccion ? '¿Enviar correcciones?' : '¿Enviar postulación?',
      html: esCorreccion
        ? 'Al enviar tus correcciones, el formulario volverá a quedar bloqueado hasta que COMECYT lo revise nuevamente.'
        : 'Al enviar tu postulación, los datos y documentos quedarán bloqueados. Solo podrás editarlos si COMECYT activa observaciones/correcciones.',
      showCancelButton: true,
      confirmButtonText: esCorreccion ? 'Sí, enviar correcciones' : 'Sí, enviar y bloquear',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#8B1538'
    });
    return result.isConfirmed;
  }
  ngOnDestroy(): void {
    if (this.borradorSaveTimer) {
      clearTimeout(this.borradorSaveTimer);
      this.borradorSaveTimer = null;
    }
    if (isPlatformBrowser(this.platformId) && this.beforeUnloadBorradorHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadBorradorHandler);
      this.beforeUnloadBorradorHandler = null;
    }
    Object.values(this.archivosSeleccionados).forEach((archivo) => URL.revokeObjectURL(archivo.previewUrl));
    this.archivosSeleccionados = {};
  }

  private getInvalidFieldMessage(form: HTMLFormElement): string {
    const firstInvalid = form.querySelector('input:invalid, select:invalid, textarea:invalid') as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!firstInvalid) return 'Revisa los campos marcados en rojo.';
    const label = this.getFieldLabel(firstInvalid);
    return label ? `Falta completar: ${label}. Revisa el campo marcado en rojo.` : 'Revisa los campos marcados en rojo.';
  }

  private getFieldLabel(control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
    if (control.id) {
      const label = this.doc.querySelector(`label[for="${control.id}"]`);
      const text = label?.textContent?.replace('*', '').trim();
      if (text) return text;
    }
    const name = control.name || control.id || '';
    const labels: Record<string, string> = {
      cedula: 'Número de cédula profesional',
      curp: 'CURP',
      correo: 'Correo electrónico',
      correoConfirm: 'Confirmar correo electrónico',
      telefono: 'Teléfono',
      tipoApoyo: 'Tipo de apoyo',
      tipoSolicitud: 'Tipo de solicitud',
      fechaEvento: 'Fecha del evento',
      cv: 'Currículum en PDF'
    };
    if (labels[name]) return labels[name];
    if (name.startsWith('doc_')) return 'Documento requerido';
    if (name.startsWith('criterio_')) return 'Criterio de compatibilidad';
    return name;
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

  private cargarLimitesPdf(): void {
    this.pdfLimiteService.obtenerMapaLimites().subscribe((limites) => {
      this.pdfLimitMbByKey = limites;
    });
  }

  getPdfLimitMb(key: string): number {
    return Number(this.pdfLimitMbByKey[key]) || 2;
  }

  getArchivoSeleccionado(key: string): ArchivoSeleccionado | null {
    return this.archivosSeleccionados[key] || null;
  }

  getDocumentoAdjuntoExistente(clave: string): DocumentoAdjuntoPostulacion | null {
    const buscada = this.normalizarClaveDocumento(clave);
    return (this.miPostulacion?.documentosAdjuntos || []).find((doc) =>
      this.normalizarClaveDocumento(doc.clave) === buscada
    ) || null;
  }

  getDocumentoAdjuntoId(doc: DocumentoAdjuntoPostulacion | null | undefined): number | null {
    return doc?.documentoId ?? null;
  }

  getDocumentoAdjuntoNombre(doc: DocumentoAdjuntoPostulacion | null | undefined, fallback: string): string {
    return doc?.nombreArchivo?.trim() || fallback || 'Documento cargado';
  }

  get curriculumExistenteId(): number | null {
    return this.miPostulacion?.curriculumDocumentoId ?? null;
  }

  get curriculumExistenteNombre(): string {
    return this.miPostulacion?.curriculumNombreArchivo?.trim() || 'Currículum cargado';
  }

  private normalizarClaveDocumento(valor: string | null | undefined): string {
    return (valor || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  onDocumentoRequeridoSeleccionado(event: Event, requisito: RequisitoDocumento): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const key = 'doc_' + requisito.clave;
    if (!file) {
      this.quitarArchivoSeleccionado(key, input, false);
      return;
    }
    if (!this.isFormatoSolicitudFile(file)) {
      Swal.fire('Archivo inválido', `El documento "${requisito.etiqueta}" debe estar en formato PDF, Word o Excel.`, 'warning');
      this.quitarArchivoSeleccionado(key, input, false);
      return;
    }
    if (!this.validarTamanoPdf(file, 'postulacion.documentos', `El documento "${requisito.etiqueta}"`, input)) {
      this.quitarArchivoSeleccionado(key, input, false);
      return;
    }
    this.guardarArchivoSeleccionado(key, file);
    input.classList.remove('is-invalid');
  }

  onCurriculumSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const alert = this.doc.getElementById('cvAlert') as HTMLElement | null;
    if (!file) {
      this.quitarArchivoSeleccionado('cv', input, false);
      this.setCvAlert(alert, '');
      return;
    }

    const maxCvMb = this.getPdfLimitMb('postulacion.curriculum');
    const nameOk = /^[\w\-. ]+$/.test(file.name);
    let msg = '';
    if (!this.isPdfFile(file)) msg += 'Solo se permiten archivos PDF. ';
    if (file.size > maxCvMb * 1024 * 1024) msg += `El archivo supera ${maxCvMb} MB. `;
    if (!nameOk) msg += 'Evita caracteres especiales en el nombre.';

    this.setCvAlert(alert, msg);
    if (msg) {
      this.quitarArchivoSeleccionado('cv', input, false);
      input.classList.add('is-invalid');
      return;
    }

    this.guardarArchivoSeleccionado('cv', file);
    input.classList.remove('is-invalid');
  }

  puedePrevisualizarArchivo(key: string): boolean {
    return this.isPdfFile(this.archivosSeleccionados[key]?.file);
  }

  visualizarArchivoSeleccionado(key: string): void {
    const archivo = this.archivosSeleccionados[key];
    if (!archivo || !isPlatformBrowser(this.platformId)) return;
    if (!this.isPdfFile(archivo.file)) {
      Swal.fire({
        icon: 'info',
        title: 'Vista previa no disponible',
        text: 'La previsualización desde el navegador solo está disponible para archivos PDF. Puedes enviar Word o Excel, pero no siempre se pueden abrir en vista previa.',
        confirmButtonColor: '#8B1538'
      });
      return;
    }
    this.abrirPreviewPdf(archivo.previewUrl, archivo.file.name || 'documento.pdf', archivo.file.name || 'documento.pdf');
  }


  private abrirPreviewPdf(url: string, nombreArchivo: string, downloadName: string): void {
    const win = window.open('', '_blank');
    if (!win) {
      Swal.fire({
        icon: 'warning',
        title: 'Ventana bloqueada',
        text: 'Permite ventanas emergentes para ver la previsualización del documento.',
        confirmButtonColor: '#8B1538'
      });
      return;
    }

    win.document.title = nombreArchivo || 'Vista previa';
    win.document.body.style.margin = '0';
    win.document.body.style.background = '#2f2f35';
    win.document.body.style.fontFamily = 'Arial, sans-serif';
    const topbar = win.document.createElement('div');
    topbar.style.cssText = 'height:52px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;background:#1f2025;color:#fff;border-bottom:1px solid #44464f';
    const title = win.document.createElement('div');
    title.textContent = nombreArchivo || 'Vista previa';
    title.style.cssText = 'font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    const download = win.document.createElement('a');
    download.href = url;
    download.download = downloadName || nombreArchivo || 'documento.pdf';
    download.textContent = 'Descargar PDF';
    download.style.cssText = 'background:#8B1538;color:#fff;text-decoration:none;border-radius:8px;padding:8px 12px;font-size:13px;font-weight:700;white-space:nowrap';
    topbar.appendChild(title);
    topbar.appendChild(download);
    const iframe = win.document.createElement('iframe');
    iframe.src = url + '#toolbar=1&navpanes=0&view=FitH';
    iframe.title = 'Vista previa de ' + (nombreArchivo || 'documento.pdf');
    iframe.style.cssText = 'border:0;display:block;width:100vw;height:calc(100vh - 52px);background:#fff';
    win.document.body.textContent = '';
    win.document.body.appendChild(topbar);
    win.document.body.appendChild(iframe);
  }

  quitarArchivoSeleccionado(key: string, inputOrId?: HTMLInputElement | string | null, mostrarAviso = true): void {
    const archivo = this.archivosSeleccionados[key];
    if (archivo) {
      URL.revokeObjectURL(archivo.previewUrl);
      delete this.archivosSeleccionados[key];
    }
    const input = typeof inputOrId === 'string'
      ? this.doc.getElementById(inputOrId) as HTMLInputElement | null
      : inputOrId;
    if (input) {
      input.value = '';
      input.classList.remove('is-invalid');
    }
    if (key === 'cv') {
      this.setCvAlert(this.doc.getElementById('cvAlert') as HTMLElement | null, '');
    }
    if (mostrarAviso) {
      Swal.fire({
        icon: 'info',
        title: 'Archivo quitado',
        text: 'Puedes seleccionar otro archivo cuando quieras.',
        timer: 1600,
        showConfirmButton: false
      });
    }
  }

  private guardarArchivoSeleccionado(key: string, file: File): void {
    const anterior = this.archivosSeleccionados[key];
    if (anterior) URL.revokeObjectURL(anterior.previewUrl);
    const previewBlob = this.isPdfFile(file)
      ? new Blob([file], { type: 'application/pdf' })
      : file;
    this.archivosSeleccionados[key] = {
      file,
      previewUrl: URL.createObjectURL(previewBlob)
    };
  }

  private setCvAlert(alert: HTMLElement | null, msg: string): void {
    if (!alert) return;
    alert.style.display = msg ? 'block' : 'none';
    alert.textContent = msg;
  }

  private validarTamanoPdf(file: File, limiteKey: string, etiqueta: string, input?: HTMLInputElement | null): boolean {
    const maxMb = this.getPdfLimitMb(limiteKey);
    if (file.size <= maxMb * 1024 * 1024) {
      return true;
    }
    if (input) {
      input.value = '';
    }
    Swal.fire('Archivo muy grande', etiqueta + ' no puede superar ' + maxMb + ' MB.', 'warning');
    return false;
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
        this.cargaMiPostulacionTerminada = true;
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
        this.programarRestauracionBorrador();
      },
      error: () => {
        this.miPostulacion = null;
        this.cargaMiPostulacionTerminada = true;
        this.plazoCorreccionVencido = false;
        this.horasRestantesCorreccion = null;
        this.aplicarDatosPerfilEnFormulario();
        this.programarRestauracionBorrador();
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
    this.configurarAutosaveBorrador(form);
    this.programarRestauracionBorrador();

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
    this.configurarAutosaveBorrador(form);
    this.programarRestauracionBorrador();

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

  private getBorradorKey(): string | null {
    if (!this.convocatoriaId) return null;
    const scope = this.modoEdicion && this.miPostulacion?.id ? `edicion_${this.miPostulacion.id}` : 'nuevo';
    return `postulacion_borrador_conv_${this.convocatoriaId}_${scope}`;
  }

  private configurarAutosaveBorrador(form: HTMLFormElement): void {
    if (this.autosaveBorradorConfigurado || !isPlatformBrowser(this.platformId)) return;
    this.autosaveBorradorConfigurado = true;
    const guardar = () => this.programarGuardadoBorrador(form);
    form.addEventListener('input', guardar);
    form.addEventListener('change', guardar);
    this.beforeUnloadBorradorHandler = () => this.guardarBorradorPostulacion(form);
    window.addEventListener('beforeunload', this.beforeUnloadBorradorHandler);
  }

  private programarGuardadoBorrador(form: HTMLFormElement): void {
    if (this.borradorSaveTimer) clearTimeout(this.borradorSaveTimer);
    this.borradorSaveTimer = setTimeout(() => {
      this.guardarBorradorPostulacion(form);
      this.borradorSaveTimer = null;
    }, 500);
  }

  private guardarBorradorPostulacion(form: HTMLFormElement): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.miPostulacion && !this.modoEdicion) return;
    const key = this.getBorradorKey();
    if (!key) return;

    const campos: Record<string, string | boolean> = {};
    const archivos: string[] = [];
    Array.from(form.elements).forEach((control) => {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) return;
      const name = control.name || control.id;
      if (!name) return;
      if (control instanceof HTMLInputElement) {
        if (['button', 'submit', 'reset', 'hidden'].includes(control.type)) return;
        if (control.type === 'file') {
          const file = control.files?.[0];
          if (file?.name) archivos.push(file.name);
          return;
        }
        if (control.type === 'checkbox') {
          campos[name] = control.checked;
          return;
        }
      }
      campos[name] = control.value || '';
    });

    const tieneCampos = Object.values(campos).some((value) => typeof value === 'boolean' ? value : value.trim().length > 0);
    if (!tieneCampos && !archivos.length) {
      localStorage.removeItem(key);
      this.estadoBorradorPostulacion = null;
      return;
    }

    const payload = { fecha: new Date().toISOString(), campos, archivos };
    localStorage.setItem(key, JSON.stringify(payload));
    this.estadoBorradorPostulacion = { fecha: payload.fecha, archivos };
  }

  private programarRestauracionBorrador(): void {
    if (!isPlatformBrowser(this.platformId) || this.borradorRestaurado) return;
    setTimeout(() => this.restaurarBorradorPostulacionEnFormulario(), 0);
  }

  private restaurarBorradorPostulacionEnFormulario(): void {
    if (!isPlatformBrowser(this.platformId) || this.borradorRestaurado || this.loadingConv || !this.cargaMiPostulacionTerminada) return;
    const form = this.doc.getElementById('postulacionForm') as HTMLFormElement | null;
    if (!form) return;
    const key = this.getBorradorKey();
    if (!key) return;
    if (this.miPostulacion && !this.modoEdicion) {
      localStorage.removeItem(key);
      this.estadoBorradorPostulacion = null;
      this.borradorRestaurado = true;
      return;
    }

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { fecha?: string; campos?: Record<string, string | boolean>; archivos?: string[] };
      const campos = parsed?.campos || {};
      Object.entries(campos).forEach(([name, value]) => {
        const control = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!control || control instanceof HTMLButtonElement || control instanceof HTMLFieldSetElement) return;
        if (control instanceof HTMLInputElement && control.type === 'file') return;
        if (control instanceof HTMLInputElement && control.type === 'checkbox') {
          control.checked = value === true || value === 'true';
          return;
        }
        if (control instanceof HTMLSelectElement && typeof value === 'string') {
          const existe = Array.from(control.options).some((opt) => opt.value === value);
          if (!existe && value.trim()) {
            const opt = this.doc.createElement('option');
            opt.value = value;
            opt.textContent = value;
            control.appendChild(opt);
          }
        }
        control.value = value == null ? '' : String(value);
      });
      this.estadoBorradorPostulacion = { fecha: parsed.fecha || new Date().toISOString(), archivos: parsed.archivos || [] };
      this.borradorRestaurado = true;
    } catch {
      localStorage.removeItem(key);
      this.estadoBorradorPostulacion = null;
    }
  }

  private limpiarBorradorPostulacion(): void {
    const key = this.getBorradorKey();
    if (key && isPlatformBrowser(this.platformId)) localStorage.removeItem(key);
    this.estadoBorradorPostulacion = null;
    this.borradorRestaurado = true;
  }

  descartarBorradorPostulacion(): void {
    const form = this.doc.getElementById('postulacionForm') as HTMLFormElement | null;
    this.limpiarBorradorPostulacion();
    if (form) {
      form.reset();
      form.classList.remove('was-validated');
      this.aplicarValoresMiPostulacionEnFormulario();
      this.aplicarDatosPerfilEnFormulario();
    }
    Swal.fire({
      icon: 'info',
      title: 'Borrador descartado',
      text: 'Se eliminó la información guardada localmente para esta postulación.',
      confirmButtonColor: '#8B1538'
    });
  }

  formatearFechaBorrador(fecha?: string | null): string {
    if (!fecha) return 'recientemente';
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return 'recientemente';
    return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private fechaEventoEnRango(fechaISO: string): boolean {
    if (!this.fechaEventoActivo) return true;
    if (!fechaISO) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaEvento = new Date(`${fechaISO}T00:00:00`);
    if (Number.isNaN(fechaEvento.getTime())) return false;
    const ms = fechaEvento.getTime() - hoy.getTime();
    const dias = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (this.diasMinAnticipacionHabilitado && dias < this.diasMinAnticipacion) return false;
    if (this.diasMaxAnticipacionHabilitado && dias > this.diasMaxAnticipacion) return false;
    return true;
  }

  get diasMinAnticipacionHabilitado(): boolean {
    return this.convocatoria?.diasMinAnticipacionHabilitado !== false;
  }

  get diasMaxAnticipacionHabilitado(): boolean {
    return this.convocatoria?.diasMaxAnticipacionHabilitado !== false;
  }

  get diasMinAnticipacion(): number {
    const value = Number(this.convocatoria?.diasMinAnticipacion);
    return Number.isFinite(value) && value >= 0 ? value : 20;
  }

  get diasMaxAnticipacion(): number {
    const value = Number(this.convocatoria?.diasMaxAnticipacion);
    if (Number.isFinite(value) && value >= 0) {
      return this.diasMinAnticipacionHabilitado ? Math.max(this.diasMinAnticipacion, value) : value;
    }
    return 60;
  }

  mensajeRangoFechaEvento(): string {
    if (this.diasMinAnticipacionHabilitado && this.diasMaxAnticipacionHabilitado) {
      return `La fecha del evento debe estar entre ${this.diasMinAnticipacion} y ${this.diasMaxAnticipacion} días a partir de hoy.`;
    }
    if (this.diasMinAnticipacionHabilitado) {
      return `La fecha del evento debe tener al menos ${this.diasMinAnticipacion} días de anticipación.`;
    }
    if (this.diasMaxAnticipacionHabilitado) {
      return `La fecha del evento no puede exceder ${this.diasMaxAnticipacion} días a partir de hoy.`;
    }
    return 'La fecha del evento no es válida.';
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
    return !!(p.banco && p.titularCuenta && p.cuentaBancaria && p.clabeInterbancaria && p.estadoCuentaDocumentoId);
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

  get montoApoyoTexto(): string {
    const monto = this.miPostulacion?.montoApoyoAsignado;
    return monto === null || monto === undefined ? 'No asignado' : `$${Number(monto).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  get formularioPostulacionBloqueado(): boolean {
    return !!this.miPostulacion && !this.modoEdicion;
  }

  get reciboPagoBloqueadoPorCarga(): boolean {
    if (!this.miPostulacion?.reciboPagoDocumentoId) return false;
    return (this.miPostulacion.estadoReciboPago || '').toUpperCase() !== 'RECIBO_RECHAZADO';
  }

  get mensajeBloqueoReciboPago(): string {
    if (this.reciboPagoBloqueadoPorCarga) {
      return 'El recibo ya fue cargado y queda bloqueado hasta que COMECYT lo revise. Si es rechazado, podrás reemplazarlo.';
    }
    return 'Se habilita cuando tu solicitud esté aprobada, el nombramiento haya sido emitido y COMECYT registre la entrega del apoyo económico.';
  }

  get apoyoEntregado(): boolean {
    return (this.miPostulacion?.estadoEntregaApoyo || '').toUpperCase() === 'APOYO_ENTREGADO';
  }

  get puedeCargarReciboPago(): boolean {
    return this.puedeCapturarBancaria && !!this.miPostulacion?.nombramientoDocumentoId && this.apoyoEntregado && !this.reciboPagoBloqueadoPorCarga;
  }

  get seguroMedicoActivo(): boolean {
    const regla = this.buscarReglaConfigurable([
      'modulo_seguro_medico_activo',
      'modulo_seguro_medico',
      'requiere_seguro_medico'
    ]);
    return regla ? this.resolverBooleanoRegla(regla.valor, true) : true;
  }

  get fechaSeguroMedicoTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaSeguroMedico);
  }

  get solicitudAceptadaParaModulos(): boolean {
    const estado = (this.miPostulacion?.estado || '').toUpperCase();
    const estadoComite = (this.miPostulacion?.estadoComite || '').toUpperCase();
    return estado === 'ACEPTADA' || estadoComite === 'APROBADA';
  }

  get puedeCargarSeguroMedico(): boolean {
    return !!this.miPostulacion?.id && this.seguroMedicoActivo && this.solicitudAceptadaParaModulos;
  }

  seleccionarArchivoSeguroMedico(input: HTMLInputElement, numeroSeguroMedico: string): void {
    if (!this.puedeCargarSeguroMedico || !this.miPostulacion?.id) return;
    if (!numeroSeguroMedico?.trim()) {
      Swal.fire('Dato requerido', 'Captura el número de seguro médico antes de adjuntar la evidencia.', 'info');
      return;
    }
    input.click();
  }

  onSeguroMedicoSeleccionado(event: Event, numeroSeguroMedico: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.miPostulacion?.id) return;
    const numero = numeroSeguroMedico?.trim() || '';
    if (!numero) {
      Swal.fire('Dato requerido', 'Captura el número de seguro médico antes de adjuntar la evidencia.', 'info');
      input.value = '';
      return;
    }
    if (!this.isPdfFile(file)) {
      Swal.fire('Archivo inválido', 'La evidencia de seguro médico debe ser PDF.', 'warning');
      input.value = '';
      return;
    }
    if (!this.validarTamanoPdf(file, 'postulacion.documentos', 'La evidencia de seguro médico', input)) {
      return;
    }
    const fd = new FormData();
    fd.append('numeroSeguroMedico', numero);
    fd.append('file', file);
    this.subiendoSeguroMedico = true;
    this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/seguro-medico`, fd).subscribe({
      next: () => {
        this.subiendoSeguroMedico = false;
        input.value = '';
        Swal.fire({ icon: 'success', title: 'Seguro médico cargado', text: 'Tu evidencia de seguro médico se cargó correctamente.', confirmButtonColor: '#8B1538' });
        this.cargarMiPostulacion();
      },
      error: (err) => {
        this.subiendoSeguroMedico = false;
        input.value = '';
        Swal.fire({ icon: 'error', title: 'No se pudo subir', text: err?.error?.error || err?.error?.message || 'Error al subir el seguro médico.', confirmButtonColor: '#8B1538' });
      }
    });
  }


  get statusAcademicoActivo(): boolean {
    const regla = this.buscarReglaConfigurable([
      'modulo_status_academico_activo',
      'modulo_status_academico',
      'requiere_status_academico',
      'modulo_estatus_academico_activo',
      'modulo_estatus_academico',
      'requiere_estatus_academico'
    ]);
    return regla ? this.resolverBooleanoRegla(regla.valor, true) : true;
  }

  get fechaStatusAcademicoTexto(): string {
    return this.formatearFechaSimpleConHora(this.miPostulacion?.fechaStatusAcademico);
  }

  get puedeActualizarStatusAcademico(): boolean {
    return !!this.miPostulacion?.id && this.statusAcademicoActivo && this.solicitudAceptadaParaModulos;
  }

  guardarStatusAcademico(informacionStatusAcademico: string, input: HTMLInputElement): void {
    if (!this.puedeActualizarStatusAcademico || !this.miPostulacion?.id) return;
    const informacion = informacionStatusAcademico?.trim() || '';
    if (!informacion) {
      Swal.fire('Dato requerido', 'Describe la actualización de tu estatus académico.', 'info');
      return;
    }
    const file = input.files?.[0] || null;
    if (file && !this.isPdfFile(file)) {
      Swal.fire('Archivo inválido', 'La evidencia de estatus académico debe ser PDF.', 'warning');
      input.value = '';
      return;
    }
    if (file && !this.validarTamanoPdf(file, 'postulacion.documentos', 'La evidencia de estatus académico', input)) {
      return;
    }
    const fd = new FormData();
    fd.append('informacionStatusAcademico', informacion);
    if (file) fd.append('file', file);
    this.subiendoStatusAcademico = true;
    this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/status-academico`, fd).subscribe({
      next: () => {
        this.subiendoStatusAcademico = false;
        input.value = '';
        Swal.fire({ icon: 'success', title: 'Estatus académico actualizado', text: 'Tu información fue enviada correctamente.', confirmButtonColor: '#8B1538' });
        this.cargarMiPostulacion();
      },
      error: (err) => {
        this.subiendoStatusAcademico = false;
        Swal.fire({ icon: 'error', title: 'No se pudo guardar', text: err?.error?.error || err?.error?.message || 'Error al actualizar el estatus académico.', confirmButtonColor: '#8B1538' });
      }
    });
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
    const tieneEstadoCuenta = !!this.miPostulacion.estadoCuentaDocumentoId;
    Swal.fire({
      title: this.tieneBancariaCapturada ? 'Editar datos bancarios' : 'Capturar datos bancarios',
      html: `
        <div class="text-start bancaria-modal-grid">
          <p class="small text-muted mb-3">Captura la cuenta donde se realizará el apoyo. El estado de cuenta es obligatorio la primera vez.</p>
          <div class="row g-3">
            <div class="col-12 col-md-6">
              <label for="swal-banco" class="form-label small fw-semibold mb-1">Banco</label>
              <input id="swal-banco" class="form-control" maxlength="120" value="${(this.miPostulacion.banco || '').replace(/"/g, '&quot;')}" placeholder="Ej. BBVA, Banorte, Santander" />
            </div>
            <div class="col-12 col-md-6">
              <label for="swal-titular" class="form-label small fw-semibold mb-1">Titular de la cuenta</label>
              <input id="swal-titular" class="form-control" maxlength="180" value="${(this.miPostulacion.titularCuenta || '').replace(/"/g, '&quot;')}" placeholder="Nombre completo" />
            </div>
            <div class="col-12 col-md-6">
              <label for="swal-cuenta" class="form-label small fw-semibold mb-1">Número de cuenta</label>
              <input id="swal-cuenta" class="form-control" maxlength="34" value="${(this.miPostulacion.cuentaBancaria || '').replace(/"/g, '&quot;')}" placeholder="Solo números" />
            </div>
            <div class="col-12 col-md-6">
              <label for="swal-clabe" class="form-label small fw-semibold mb-1">CLABE interbancaria</label>
              <input id="swal-clabe" class="form-control" maxlength="18" value="${(this.miPostulacion.clabeInterbancaria || '').replace(/"/g, '&quot;')}" placeholder="18 dígitos" />
            </div>
            <div class="col-12">
              <label for="swal-estado-cuenta" class="form-label small fw-semibold mb-1">Estado de cuenta</label>
              <input id="swal-estado-cuenta" class="form-control" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf" />
              <div class="form-text">PDF, Word o Excel. Máx. 2 MB según configuración.</div>
              ${tieneEstadoCuenta ? `<div class="alert alert-light border mt-2 mb-0 py-2"><i class="fas fa-file-invoice me-1 text-borgona"></i> Archivo actual: <strong>${(this.miPostulacion.estadoCuentaNombreArchivo || 'Estado de cuenta cargado').replace(/"/g, '&quot;')}</strong></div>` : ''}
            </div>
          </div>
        </div>
      `,
      width: 760,
      showCancelButton: true,
      confirmButtonText: 'Guardar datos bancarios',
      confirmButtonColor: '#8B1538',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const banco = (this.doc.getElementById('swal-banco') as HTMLInputElement | null)?.value?.trim() || '';
        const titularCuenta = (this.doc.getElementById('swal-titular') as HTMLInputElement | null)?.value?.trim() || '';
        const cuentaBancaria = (this.doc.getElementById('swal-cuenta') as HTMLInputElement | null)?.value?.trim() || '';
        const clabeInterbancaria = (this.doc.getElementById('swal-clabe') as HTMLInputElement | null)?.value?.trim() || '';
        const estadoCuenta = (this.doc.getElementById('swal-estado-cuenta') as HTMLInputElement | null)?.files?.[0] || null;
        if (!banco || !titularCuenta || !cuentaBancaria || !clabeInterbancaria) {
          Swal.showValidationMessage('Completa banco, titular, número de cuenta y CLABE');
          return false;
        }
        if (!tieneEstadoCuenta && !estadoCuenta) {
          Swal.showValidationMessage('Adjunta el estado de cuenta');
          return false;
        }
        const formData = new FormData();
        formData.append('banco', banco);
        formData.append('titularCuenta', titularCuenta);
        formData.append('cuentaBancaria', cuentaBancaria);
        formData.append('clabeInterbancaria', clabeInterbancaria);
        if (estadoCuenta) formData.append('estadoCuenta', estadoCuenta);
        return formData;
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.miPostulacion?.id) return;
      this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/bancaria`, res.value).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Datos bancarios guardados',
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
        <div class="text-start renuncia-modal-content">
          <div class="alert alert-warning border-0 mb-3 py-2 px-3 small">
            <i class="fas fa-circle-exclamation me-2"></i>
            Esta solicitud será revisada por COMECYT. Adjunta el oficio formal de baja que respalda tu renuncia.
          </div>
          <label for="swal-renuncia-motivo" class="form-label small fw-semibold mb-1">Motivo de renuncia</label>
          <textarea id="swal-renuncia-motivo" class="form-control mb-3" rows="5" maxlength="3000" placeholder="Describe de forma clara el motivo de tu renuncia..."></textarea>
          <label for="swal-renuncia-oficio" class="form-label small fw-semibold mb-1">Oficio formal de baja (PDF)</label>
          <input id="swal-renuncia-oficio" class="form-control" type="file" accept=".pdf,application/pdf" />
          <div class="form-text">Archivo PDF obligatorio. Máx. ${this.getPdfLimitMb('postulacion.documentos')} MB.</div>
        </div>
      `,
      icon: 'warning',
      width: 720,
      showCancelButton: true,
      confirmButtonText: 'Enviar solicitud',
      confirmButtonColor: '#8B1538',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const motivoRenuncia = (this.doc.getElementById('swal-renuncia-motivo') as HTMLTextAreaElement | null)?.value?.trim() || '';
        const input = this.doc.getElementById('swal-renuncia-oficio') as HTMLInputElement | null;
        const oficioBaja = input?.files?.[0] || null;
        if (!motivoRenuncia) {
          Swal.showValidationMessage('Debes capturar el motivo de renuncia');
          return false;
        }
        if (!oficioBaja) {
          Swal.showValidationMessage('Debes adjuntar el oficio formal de baja en PDF');
          return false;
        }
        if (!this.isPdfFile(oficioBaja)) {
          Swal.showValidationMessage('El oficio formal de baja debe ser un archivo PDF');
          if (input) input.value = '';
          return false;
        }
        const limiteMb = this.getPdfLimitMb('postulacion.documentos');
        const limiteBytes = limiteMb * 1024 * 1024;
        if (oficioBaja.size > limiteBytes) {
          Swal.showValidationMessage('El oficio formal de baja excede el límite permitido de ' + limiteMb + ' MB');
          if (input) input.value = '';
          return false;
        }
        const fd = new FormData();
        fd.append('motivoRenuncia', motivoRenuncia);
        fd.append('oficioBaja', oficioBaja);
        return fd;
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value || !this.miPostulacion?.id) return;
      this.http.post(`${this.apiBase}/postulaciones/mias/${this.miPostulacion.id}/renuncia`, res.value).subscribe({
        next: () => {
          Swal.fire({
            icon: 'success',
            title: 'Renuncia enviada',
            text: 'Tu solicitud de renuncia y oficio formal de baja fueron enviados para revisión administrativa.',
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

  async seleccionarArchivoReciboPago(input: HTMLInputElement): Promise<void> {
    if (!this.puedeCargarReciboPago || !this.miPostulacion?.id) return;
    const res = await Swal.fire({
      icon: 'warning',
      title: '¿Cargar recibo de pago?',
      html: 'Al subir el recibo, la carga quedará bloqueada hasta que COMECYT lo revise. Si el recibo es rechazado, podrás reemplazarlo.',
      showCancelButton: true,
      confirmButtonText: 'Sí, cargar recibo',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#8B1538'
    });
    if (res.isConfirmed) input.click();
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
    if (!this.validarTamanoPdf(file, 'postulacion.informes', 'El informe parcial', input)) {
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
    if (!this.validarTamanoPdf(file, 'postulacion.informes', 'El informe final', input)) {
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
    if (!this.validarTamanoPdf(file, 'postulacion.reciboPago', 'El recibo de pago', input)) {
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

  visualizarDocumento(documentoId?: number | null, nombreArchivo?: string | null): void {
    if (!documentoId || !isPlatformBrowser(this.platformId)) return;
    const win = window.open('', '_blank');
    if (!win) {
      Swal.fire({
        icon: 'warning',
        title: 'Ventana bloqueada',
        text: 'Permite ventanas emergentes para ver la previsualización del documento.',
        confirmButtonColor: '#8B1538'
      });
      return;
    }
    win.document.title = nombreArchivo || 'Documento';
    win.document.body.style.fontFamily = 'Arial, sans-serif';
    win.document.body.style.padding = '24px';
    win.document.body.textContent = 'Cargando documento...';

    this.http.get(`${this.apiBase}/documentos/${documentoId}?inline=true`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const nombre = nombreArchivo?.trim() || `documento_${documentoId}.pdf`;
        if (!this.esBlobPdf(blob, nombre)) {
          win.close();
          this.descargarBlob(blob, nombre);
          Swal.fire({
            icon: 'info',
            title: 'Vista previa no disponible',
            text: 'Este archivo no es PDF. Se descargó para que puedas abrirlo en tu equipo.',
            confirmButtonColor: '#8B1538'
          });
          return;
        }
        const url = URL.createObjectURL(blob);
        win.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      },
      error: (err) => {
        win.close();
        Swal.fire({
          icon: 'error',
          title: 'No se pudo abrir',
          text: this.mensajeErrorDocumento(err, 'No se pudo abrir el documento.'),
          confirmButtonColor: '#8B1538'
        });
      }
    });
  }

  descargarDocumento(documentoId?: number | null, nombreArchivo?: string | null): void {
    if (!documentoId || !isPlatformBrowser(this.platformId)) return;
    this.http.get(`${this.apiBase}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => this.descargarBlob(blob, nombreArchivo?.trim() || `documento_${documentoId}`),
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'No se pudo descargar',
          text: this.mensajeErrorDocumento(err, 'No se pudo descargar el documento.'),
          confirmButtonColor: '#8B1538'
        });
      }
    });
  }

  private esBlobPdf(blob: Blob, nombreArchivo: string): boolean {
    return (blob.type || '').toLowerCase().includes('pdf') || nombreArchivo.toLowerCase().endsWith('.pdf');
  }

  private descargarBlob(blob: Blob, nombreArchivo: string): void {
    const url = URL.createObjectURL(blob);
    const a = this.doc.createElement('a');
    a.href = url;
    a.download = nombreArchivo || 'documento';
    a.style.display = 'none';
    this.doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  private mensajeErrorDocumento(err: any, fallback: string): string {
    if (err?.status === 401) return 'Tu sesión expiró. Inicia sesión nuevamente para consultar el documento.';
    if (err?.status === 403) return 'No tienes permisos para consultar este documento.';
    if (err?.status === 404) return 'El documento no fue encontrado.';
    return err?.error?.message || err?.error?.error || fallback;
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



















