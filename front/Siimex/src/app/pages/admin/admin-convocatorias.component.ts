import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';
import { forkJoin, of } from 'rxjs';

export interface Aceptado {
  usuarioId: number;
  nombre: string;
  fotoDocumentoId?: number | null;
  fotoUrl?: string | SafeResourceUrl | null;
}

export interface CriterioFormulario {
  clave: string;
  etiqueta: string;
  tipo: 'texto' | 'numero' | 'select' | 'checkbox' | 'textarea';
  opciones?: string[];
  peso: number;
  requerido: boolean;
}

export interface ReglaConfigurable {
  clave: string;
  valor: string;
  descripcion?: string;
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

interface FormatoPendiente {
  file: File;
  nombre: string;
  descripcion: string;
}

interface ResumenReglaOperativaItem {
  etiqueta: string;
  valor: string;
  estado: 'ok' | 'warn' | 'info';
}

interface ModuloConvocatoriaOption {
  control: string;
  regla: string;
  etiqueta: string;
  descripcion: string;
}

export interface Convocatoria {
  id: number;
  titulo: string;
  descripcion?: string | null;
  resumen?: string | null;
  requisitos?: string | null;
  fechaApertura?: string | null;
  fechaCierre: string;
  area?: string | null;
  folioConvocatoria?: string | null;
  folioPrefijo?: string | null;
  keywords?: string | null;
  imagenUrl?: string | null;
  iconoUrl?: string | null;
  vigente: boolean;
  visibilidadPublica?: boolean;
  fechaPublicacion?: string | null;
  estadoPublicacion?: string | null;
  criteriosFormulario?: string | null;
  requisitosDocumentos?: string | null;
  tiposApoyo?: string | null;
  reglasConfigurables?: string | null;
  puntajeMaximoEvaluacion?: number | null;
  diasMinAnticipacion?: number | null;
  diasMaxAnticipacion?: number | null;
  avisoPrivacidadObligatorio?: boolean;
  avisoPrivacidadTexto?: string | null;
  avisoPrivacidadUrl?: string | null;
  limiteAceptados?: number | null;
  diasNaturalesVigencia?: number | null;
  feriadosEnVigencia?: number | null;
  diasSinFeriadosVigencia?: number | null;
  cantidadAceptados?: number;
  aceptados?: Aceptado[];
  formatos?: FormatoConvocatoria[];
}

@Component({
  selector: 'app-admin-convocatorias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink],
  templateUrl: './admin-convocatorias.component.html',
  styleUrls: ['./admin-convocatorias.component.css']
})
export class AdminConvocatoriasComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  error: string | null = null;
  convocatorias: Convocatoria[] = [];
  modalVisible = false;
  formModal!: FormGroup;
  editando: Convocatoria | null = null;
  guardando = false;
  subiendoImagen = false;
  subiendoFormatos = false;
  errorImagen = '';
  errorFormato = '';
  formatosExistentes: FormatoConvocatoria[] = [];
  formatosPendientes: FormatoPendiente[] = [];
  filtroTexto = '';
  filtroArea = '';
  filtroEstado = '';

  readonly AREAS = [
    { value: 'energias', label: 'Energías' },
    { value: 'educacion', label: 'Educación' },
    { value: 'tecnologia', label: 'Tecnología' },
    { value: 'salud', label: 'Salud' },
    { value: 'medio-ambiente', label: 'Medio ambiente' },
    { value: 'otro', label: 'Otro' }
  ];

  readonly TIPOS_CRITERIO = [
    { value: 'texto', label: 'Texto corto' },
    { value: 'textarea', label: 'Texto largo' },
    { value: 'numero', label: 'Número' },
    { value: 'select', label: 'Selección única' },
    { value: 'checkbox', label: 'Casilla de verificación' }
  ];

  readonly INFORMES_REQUERIDOS_OPTIONS = [
    { value: 'NINGUNO', label: 'Ninguno' },
    { value: 'PARCIAL', label: 'Solo parcial' },
    { value: 'FINAL', label: 'Solo final' },
    { value: 'AMBOS', label: 'Parcial y final' }
  ];

  readonly ESTADOS_EDITABLES_OPTIONS = [
    { value: 'PENDIENTE', label: 'Pendiente' },
    { value: 'CON_OBSERVACIONES', label: 'Con observaciones' },
    { value: 'SUBSANADA', label: 'Subsanada' },
    { value: 'REVISADA', label: 'Revisada' },
    { value: 'ACEPTADA', label: 'Aceptada' }
  ];

  readonly MODULOS_CONVOCATORIA_OPTIONS: ModuloConvocatoriaOption[] = [
    {
      control: 'reglaModuloEvaluadores',
      regla: 'modulo_evaluadores_activo',
      etiqueta: 'Módulo de evaluadores',
      descripcion: 'Asigna evaluadores, registra evaluaciones y genera documentos de evaluación.'
    },
    {
      control: 'reglaModuloComite',
      regla: 'modulo_comite_activo',
      etiqueta: 'Módulo de comité',
      descripcion: 'Permite dictamen de comité y resolución final de apoyo.'
    },
    {
      control: 'reglaModuloCotejo',
      regla: 'modulo_cotejo_activo',
      etiqueta: 'Módulo de cotejo',
      descripcion: 'Habilita cotejo documental posterior a evaluación.'
    },
    {
      control: 'reglaModuloInformes',
      regla: 'modulo_informes_activo',
      etiqueta: 'Módulo de informes',
      descripcion: 'Permite configurar y recibir informes parcial/final.'
    },
    {
      control: 'reglaModuloBancaria',
      regla: 'modulo_bancaria_activo',
      etiqueta: 'Módulo bancario',
      descripcion: 'Habilita captura de datos bancarios para postulaciones aprobadas.'
    },
    {
      control: 'reglaModuloRenuncia',
      regla: 'modulo_renuncia_activo',
      etiqueta: 'Módulo de renuncia',
      descripcion: 'Permite solicitudes y resolución de renuncia.'
    }
  ];

  readonly REGLAS_BASE_PRESET: ReglaConfigurable[] = [
    { clave: 'postulacion_fecha_inicio', valor: '2026-01-01', descripcion: 'Fecha de inicio para recepción de solicitudes (yyyy-MM-dd)' },
    { clave: 'postulacion_fecha_fin', valor: '2026-12-31', descripcion: 'Fecha de cierre para recepción de solicitudes (yyyy-MM-dd)' },
    { clave: 'postulacion_estados_editables', valor: 'PENDIENTE,CON_OBSERVACIONES', descripcion: 'Estados donde la persona puede editar su solicitud' },
    { clave: 'plazo_correccion_horas_default', valor: '120', descripcion: 'Horas por defecto para corregir observaciones' },
    { clave: 'plazo_correccion_horas_min', valor: '24', descripcion: 'Horas mínimas permitidas para corrección' },
    { clave: 'plazo_correccion_horas_max', valor: '720', descripcion: 'Horas máximas permitidas para corrección' },
    { clave: 'informes_requeridos', valor: 'AMBOS', descripcion: 'Tipo de informes: NINGUNO, PARCIAL, FINAL o AMBOS' },
    { clave: 'modulo_evaluadores_activo', valor: 'true', descripcion: 'Activa módulo de evaluadores' },
    { clave: 'modulo_comite_activo', valor: 'true', descripcion: 'Activa módulo de comité' },
    { clave: 'modulo_cotejo_activo', valor: 'true', descripcion: 'Activa módulo de cotejo' },
    { clave: 'modulo_informes_activo', valor: 'true', descripcion: 'Activa módulo de informes' },
    { clave: 'modulo_bancaria_activo', valor: 'true', descripcion: 'Activa módulo bancario' },
    { clave: 'modulo_renuncia_activo', valor: 'true', descripcion: 'Activa módulo de renuncia' },
    { clave: 'requerir_cedula', valor: 'true', descripcion: 'Exige cédula profesional' },
    { clave: 'requerir_curp', valor: 'true', descripcion: 'Exige CURP válida' },
    { clave: 'requerir_telefono', valor: 'true', descripcion: 'Exige teléfono de contacto' },
    { clave: 'titulo_proyecto_min_chars', valor: '10', descripcion: 'Longitud mínima de título' },
    { clave: 'descripcion_proyecto_min_chars', valor: '120', descripcion: 'Longitud mínima de descripción' },
    { clave: 'fecha_evento_no_fin_semana', valor: 'false', descripcion: 'Permitir o no sábado/domingo' },
    { clave: 'fecha_evento_min_dias', valor: '0', descripcion: 'Anticipación mínima adicional (días)' },
    { clave: 'fecha_evento_max_dias', valor: '365', descripcion: 'Anticipación máxima adicional (días)' },
    { clave: 'tipo_solicitud_permitida', valor: 'NACIONAL,INTERNACIONAL', descripcion: 'Tipos de solicitud permitidos' },
    { clave: 'observaciones_max_chars', valor: '500', descripcion: 'Máximo de caracteres en observaciones' }
  ];

  readonly ICONOS_DISPONIBLES = [
    { label: 'Tecnología', url: 'assets/img/devops.png' },
    { label: 'Energías', url: 'assets/img/solar-energy.png' },
    { label: 'Educación', url: 'assets/img/creative-education.png' },
    { label: 'Documentos', url: 'assets/img/documentos.png' },
    { label: 'Investigación', url: 'assets/img/teacher_icon_243839.png' },
    { label: 'Certificado', url: 'assets/img/certificado.png' }
  ];

  ngOnInit(): void {
    this.inicializarForm();
    this.cargar();
  }

  private inicializarForm(): void {
    this.formModal = this.fb.group({
      titulo: ['', [Validators.required, Validators.maxLength(200)]],
      descripcion: ['', [Validators.maxLength(500)]],
      resumen: [''],
      requisitos: [''],
      fechaApertura: [''],
      fechaCierre: ['', Validators.required],
      area: [''],
      folioConvocatoria: ['', [Validators.maxLength(40)]],
      folioPrefijo: ['', [Validators.maxLength(30)]],
      keywords: ['', [Validators.maxLength(300)]],
      limiteAceptados: [''],
      puntajeMaximoEvaluacion: [100, [Validators.min(1)]],
      diasMinAnticipacion: [20, [Validators.min(0)]],
      diasMaxAnticipacion: [60, [Validators.min(0)]],
      avisoPrivacidadObligatorio: [false],
      avisoPrivacidadTexto: [''],
      avisoPrivacidadUrl: ['', [Validators.maxLength(500)]],
      imagenUrl: ['', [Validators.maxLength(500)]],
      iconoUrl: ['', [Validators.maxLength(500)]],
      vigente: [true],
      visibilidadPublica: [true],
      reglaPostulacionFechaInicio: [''],
      reglaPostulacionFechaFin: [''],
      reglaInformesRequeridos: ['AMBOS'],
      reglaPlazoCorreccionHorasDefault: [120, [Validators.min(1), Validators.max(720)]],
      reglaPlazoCorreccionHorasMin: [24, [Validators.min(1), Validators.max(720)]],
      reglaPlazoCorreccionHorasMax: [720, [Validators.min(1), Validators.max(720)]],
      reglaEstadosEditables: [['PENDIENTE', 'CON_OBSERVACIONES']],
      reglaModuloEvaluadores: [true],
      reglaModuloComite: [true],
      reglaModuloCotejo: [true],
      reglaModuloInformes: [true],
      reglaModuloBancaria: [true],
      reglaModuloRenuncia: [true]
    });
    this.criteriosArray = this.fb.array([]);
    this.formModal.addControl('criterios', this.criteriosArray);
    this.requisitosDocsArray = this.fb.array([]);
    this.formModal.addControl('requisitosDocumentos', this.requisitosDocsArray);
    this.tiposApoyoArray = this.fb.array([]);
    this.formModal.addControl('tiposApoyo', this.tiposApoyoArray);
    this.reglasArray = this.fb.array([]);
    this.formModal.addControl('reglasConfigurables', this.reglasArray);
  }

  criteriosArray!: FormArray;
  requisitosDocsArray!: FormArray;
  tiposApoyoArray!: FormArray;
  reglasArray!: FormArray;

  get criterios(): FormArray {
    return (this.formModal?.get('criterios') ?? this.criteriosArray) as FormArray;
  }

  get requisitosDocs(): FormArray {
    return (this.formModal?.get('requisitosDocumentos') ?? this.requisitosDocsArray) as FormArray;
  }

  get tiposApoyo(): FormArray {
    return (this.formModal?.get('tiposApoyo') ?? this.tiposApoyoArray) as FormArray;
  }

  get reglasConfigurables(): FormArray {
    return (this.formModal?.get('reglasConfigurables') ?? this.reglasArray) as FormArray;
  }

  agregarRequisitoDoc(): void {
    this.requisitosDocs.push(this.fb.group({
      clave: ['', [Validators.required, Validators.maxLength(80)]],
      etiqueta: ['', [Validators.required, Validators.maxLength(120)]],
      requerido: [false]
    }));
  }

  quitarRequisitoDoc(i: number): void {
    this.requisitosDocs.removeAt(i);
  }

  private requisitosDocsToJson(): string {
    const arr = (this.requisitosDocs?.value || []).map((r: any) => ({
      clave: (r.clave || '').trim().replace(/\s+/g, '_') || undefined,
      etiqueta: (r.etiqueta || '').trim() || undefined,
      requerido: !!r.requerido
    })).filter((r: any) => r.clave && r.etiqueta);
    return arr.length ? JSON.stringify(arr) : '';
  }

  private jsonToRequisitosDocs(json: string | null | undefined): void {
    this.requisitosDocs.clear();
    if (!json?.trim()) return;
    try {
      const arr = JSON.parse(json) as Array<{ clave?: string; etiqueta?: string; requerido?: boolean }>;
      arr.forEach(r => {
        if (r.clave && r.etiqueta) {
          this.requisitosDocs.push(this.fb.group({
            clave: [r.clave, [Validators.required, Validators.maxLength(80)]],
            etiqueta: [r.etiqueta, [Validators.required, Validators.maxLength(120)]],
            requerido: [!!r.requerido]
          }));
        }
      });
    } catch {
      //
    }
  }

  agregarTipoApoyo(valor = ''): void {
    this.tiposApoyo.push(this.fb.group({
      nombre: [valor, [Validators.required, Validators.maxLength(120)]]
    }));
  }

  quitarTipoApoyo(i: number): void {
    this.tiposApoyo.removeAt(i);
  }

  private tiposApoyoToJson(): string {
    const vistos = new Set<string>();
    const arr = (this.tiposApoyo?.value || [])
      .map((x: any) => (x?.nombre || '').trim())
      .filter((v: string) => {
        if (!v) return false;
        const k = v.toLowerCase();
        if (vistos.has(k)) return false;
        vistos.add(k);
        return true;
      });
    return arr.length ? JSON.stringify(arr) : '';
  }

  private jsonToTiposApoyo(json: string | null | undefined): void {
    this.tiposApoyo.clear();
    if (!json?.trim()) return;
    try {
      const arr = JSON.parse(json) as string[];
      (Array.isArray(arr) ? arr : []).forEach((v) => {
        const limpio = (v || '').trim();
        if (limpio) this.agregarTipoApoyo(limpio);
      });
    } catch {
      //
    }
  }

  agregarReglaConfigurable(regla?: Partial<ReglaConfigurable>): void {
    this.reglasConfigurables.push(this.fb.group({
      clave: [(regla?.clave || '').trim(), [Validators.required, Validators.maxLength(80)]],
      valor: [(regla?.valor || '').trim(), [Validators.required, Validators.maxLength(240)]],
      descripcion: [(regla?.descripcion || '').trim(), [Validators.maxLength(240)]]
    }));
  }

  quitarReglaConfigurable(i: number): void {
    this.reglasConfigurables.removeAt(i);
  }

  cargarPlantillaReglasBase(): void {
    this.reglasConfigurables.clear();
    this.REGLAS_BASE_PRESET.forEach((r) => {
      if (!this.aplicarReglaGuiada(r)) {
        this.agregarReglaConfigurable(r);
      }
    });
  }

  private reglasConfigurablesToJson(): string {
    const arrLibres = (this.reglasConfigurables?.value || [])
      .map((r: any) => ({
        clave: (r?.clave || '').trim().replace(/\s+/g, '_'),
        valor: (r?.valor || '').trim(),
        descripcion: (r?.descripcion || '').trim() || undefined
      }))
      .filter((r: ReglaConfigurable) => !!r.clave && !!r.valor && !this.esReglaGuiada(r.clave));

    const arr = this.inyectarReglasGuiadas(arrLibres);
    return arr.length ? JSON.stringify(arr) : '';
  }

  private jsonToReglasConfigurables(json: string | null | undefined): void {
    this.reglasConfigurables.clear();
    if (!json?.trim()) return;
    try {
      const arr = JSON.parse(json) as ReglaConfigurable[];
      (Array.isArray(arr) ? arr : []).forEach((r) => {
        if (!r?.clave || !r?.valor) return;
        if (!this.aplicarReglaGuiada(r)) {
          this.agregarReglaConfigurable(r);
        }
      });
    } catch {
      //
    }
  }

  private inyectarReglasGuiadas(reglasLibres: ReglaConfigurable[]): ReglaConfigurable[] {
    const v = this.formModal.value || {};
    const out: ReglaConfigurable[] = [...(reglasLibres || [])];

    const upsert = (clave: string, valor: string | number | null | undefined, descripcion: string) => {
      const val = valor != null ? String(valor).trim() : '';
      const key = this.normalizarClaveRegla(clave);
      const idx = out.findIndex((r) => this.normalizarClaveRegla(r.clave) === key);
      if (!val) {
        if (idx >= 0) out.splice(idx, 1);
        return;
      }
      const regla: ReglaConfigurable = { clave, valor: val, descripcion };
      if (idx >= 0) out[idx] = regla;
      else out.push(regla);
    };

    const estados = Array.isArray(v.reglaEstadosEditables)
      ? v.reglaEstadosEditables.map((x: string) => (x || '').trim()).filter(Boolean)
      : [];
    upsert('postulacion_estados_editables', estados.join(','), 'Estados donde la persona puede editar su solicitud');
    upsert('plazo_correccion_horas_default', v.reglaPlazoCorreccionHorasDefault, 'Horas por defecto para corregir observaciones');
    upsert('plazo_correccion_horas_min', v.reglaPlazoCorreccionHorasMin, 'Horas mínimas permitidas para corrección');
    upsert('plazo_correccion_horas_max', v.reglaPlazoCorreccionHorasMax, 'Horas máximas permitidas para corrección');
    upsert('postulacion_fecha_inicio', v.reglaPostulacionFechaInicio, 'Fecha de inicio para recepción de solicitudes (yyyy-MM-dd)');
    upsert('postulacion_fecha_fin', v.reglaPostulacionFechaFin, 'Fecha de cierre para recepción de solicitudes (yyyy-MM-dd)');
    const moduloEvaluadores = !!v.reglaModuloEvaluadores;
    const moduloComite = !!v.reglaModuloComite;
    const moduloCotejo = !!v.reglaModuloCotejo;
    const moduloInformes = !!v.reglaModuloInformes;
    const moduloBancaria = !!v.reglaModuloBancaria;
    const moduloRenuncia = !!v.reglaModuloRenuncia;

    upsert('modulo_evaluadores_activo', moduloEvaluadores ? 'true' : 'false', 'Activa módulo de evaluadores');
    upsert('modulo_comite_activo', moduloComite ? 'true' : 'false', 'Activa módulo de comité');
    upsert('modulo_cotejo_activo', moduloCotejo ? 'true' : 'false', 'Activa módulo de cotejo');
    upsert('modulo_informes_activo', moduloInformes ? 'true' : 'false', 'Activa módulo de informes');
    upsert('modulo_bancaria_activo', moduloBancaria ? 'true' : 'false', 'Activa módulo bancario');
    upsert('modulo_renuncia_activo', moduloRenuncia ? 'true' : 'false', 'Activa módulo de renuncia');
    upsert('informes_requeridos', moduloInformes ? v.reglaInformesRequeridos : 'NINGUNO', 'Tipo de informes: NINGUNO, PARCIAL, FINAL o AMBOS');

    const vistos = new Set<string>();
    return out.filter((r) => {
      const key = this.normalizarClaveRegla(r.clave);
      if (!r.clave || !r.valor || !key) return false;
      if (vistos.has(key)) return false;
      vistos.add(key);
      return true;
    });
  }

  private aplicarReglaGuiada(regla: Partial<ReglaConfigurable>): boolean {
    const clave = this.normalizarClaveRegla(regla?.clave || '');
    const valor = (regla?.valor || '').trim();
    if (!clave) return false;
    switch (clave) {
      case 'postulacion_fecha_inicio':
        this.formModal.patchValue({ reglaPostulacionFechaInicio: valor || '' }, { emitEvent: false });
        return true;
      case 'postulacion_fecha_fin':
        this.formModal.patchValue({ reglaPostulacionFechaFin: valor || '' }, { emitEvent: false });
        return true;
      case 'informes_requeridos': {
        const tipo = ['NINGUNO', 'PARCIAL', 'FINAL', 'AMBOS'].includes(valor.toUpperCase()) ? valor.toUpperCase() : 'AMBOS';
        this.formModal.patchValue({ reglaInformesRequeridos: tipo }, { emitEvent: false });
        return true;
      }
      case 'plazo_correccion_horas_default':
        this.formModal.patchValue({ reglaPlazoCorreccionHorasDefault: this.toNumeroSeguro(valor, 120) }, { emitEvent: false });
        return true;
      case 'plazo_correccion_horas_min':
        this.formModal.patchValue({ reglaPlazoCorreccionHorasMin: this.toNumeroSeguro(valor, 24) }, { emitEvent: false });
        return true;
      case 'plazo_correccion_horas_max':
        this.formModal.patchValue({ reglaPlazoCorreccionHorasMax: this.toNumeroSeguro(valor, 720) }, { emitEvent: false });
        return true;
      case 'postulacion_estados_editables': {
        const arr = valor
          .split(/[;,|]/)
          .map((x) => x.trim().toUpperCase())
          .filter(Boolean);
        this.formModal.patchValue({ reglaEstadosEditables: arr.length ? arr : ['PENDIENTE', 'CON_OBSERVACIONES'] }, { emitEvent: false });
        return true;
      }
      case 'modulo_evaluadores_activo':
      case 'modulo_evaluadores':
      case 'requiere_evaluadores':
        this.formModal.patchValue({ reglaModuloEvaluadores: this.resolverBooleanoRegla(valor, true) }, { emitEvent: false });
        return true;
      case 'modulo_comite_activo':
      case 'modulo_comite':
      case 'requiere_comite':
        this.formModal.patchValue({ reglaModuloComite: this.resolverBooleanoRegla(valor, true) }, { emitEvent: false });
        return true;
      case 'modulo_cotejo_activo':
      case 'modulo_cotejo':
      case 'requiere_cotejo':
        this.formModal.patchValue({ reglaModuloCotejo: this.resolverBooleanoRegla(valor, true) }, { emitEvent: false });
        return true;
      case 'modulo_informes_activo':
      case 'modulo_informes':
      case 'requiere_informes':
        this.formModal.patchValue({ reglaModuloInformes: this.resolverBooleanoRegla(valor, true) }, { emitEvent: false });
        return true;
      case 'modulo_bancaria_activo':
      case 'modulo_bancaria':
      case 'requiere_bancaria':
        this.formModal.patchValue({ reglaModuloBancaria: this.resolverBooleanoRegla(valor, true) }, { emitEvent: false });
        return true;
      case 'modulo_renuncia_activo':
      case 'modulo_renuncia':
      case 'permite_renuncia':
        this.formModal.patchValue({ reglaModuloRenuncia: this.resolverBooleanoRegla(valor, true) }, { emitEvent: false });
        return true;
      default:
        return false;
    }
  }

  private esReglaGuiada(clave: string): boolean {
    const k = this.normalizarClaveRegla(clave);
    return [
      'postulacion_fecha_inicio',
      'postulacion_fecha_fin',
      'informes_requeridos',
      'plazo_correccion_horas_default',
      'plazo_correccion_horas_min',
      'plazo_correccion_horas_max',
      'postulacion_estados_editables',
      'modulo_evaluadores_activo',
      'modulo_comite_activo',
      'modulo_cotejo_activo',
      'modulo_informes_activo',
      'modulo_bancaria_activo',
      'modulo_renuncia_activo',
      'modulo_evaluadores',
      'modulo_comite',
      'modulo_cotejo',
      'modulo_informes',
      'modulo_bancaria',
      'modulo_renuncia',
      'requiere_evaluadores',
      'requiere_comite',
      'requiere_cotejo',
      'requiere_informes',
      'requiere_bancaria',
      'permite_renuncia'
    ].includes(k);
  }

  private normalizarClaveRegla(clave: string): string {
    return (clave || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  }

  private toNumeroSeguro(value: string, fallback: number): number {
    const n = parseInt((value || '').trim(), 10);
    return Number.isFinite(n) ? n : fallback;
  }

  private resolverBooleanoRegla(value: unknown, fallback: boolean): boolean {
    if (value == null) return fallback;
    const v = String(value).trim().toLowerCase();
    if (!v) return fallback;
    if (['true', '1', 'si', 'sí', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off'].includes(v)) return false;
    return fallback;
  }

  get resumenReglasOperativas(): ResumenReglaOperativaItem[] {
    const v = this.formModal?.value || {};
    const inicio = (v.reglaPostulacionFechaInicio || '').trim();
    const fin = (v.reglaPostulacionFechaFin || '').trim();
    const informes = (v.reglaInformesRequeridos || 'AMBOS').toString().toUpperCase();
    const pDef = Number(v.reglaPlazoCorreccionHorasDefault);
    const pMin = Number(v.reglaPlazoCorreccionHorasMin);
    const pMax = Number(v.reglaPlazoCorreccionHorasMax);
    const estados = Array.isArray(v.reglaEstadosEditables) ? v.reglaEstadosEditables : [];
    const modulos = this.MODULOS_CONVOCATORIA_OPTIONS.map((m) => ({
      ...m,
      activo: !!v[m.control]
    }));
    const modulosActivos = modulos.filter((m) => m.activo);

    const rangoFechaValido = !!inicio && !!fin && inicio <= fin;
    const rangoFechaIncompleto = !inicio || !fin;
    const rangoPlazoValido = Number.isFinite(pDef) && Number.isFinite(pMin) && Number.isFinite(pMax) && pMin >= 1 && pMax >= pMin && pDef >= pMin && pDef <= pMax;
    const estadosOk = Array.isArray(estados) && estados.length > 0;

    return [
      {
        etiqueta: 'Ventana de postulación',
        valor: rangoFechaIncompleto
          ? 'Sin límite específico (usa apertura/cierre general)'
          : `${this.formatearFecha(inicio)} a ${this.formatearFecha(fin)}`,
        estado: rangoFechaIncompleto ? 'info' : (rangoFechaValido ? 'ok' : 'warn')
      },
      {
        etiqueta: 'Informes requeridos',
        valor: this.etiquetaInformes(informes),
        estado: 'ok'
      },
      {
        etiqueta: 'Plazo de corrección',
        valor: Number.isFinite(pDef) && Number.isFinite(pMin) && Number.isFinite(pMax)
          ? `Default: ${pDef} h | Rango: ${pMin}-${pMax} h`
          : 'Configuración pendiente',
        estado: rangoPlazoValido ? 'ok' : 'warn'
      },
      {
        etiqueta: 'Estados editables',
        valor: estadosOk ? this.etiquetaEstadosEditables(estados) : 'Ninguno seleccionado',
        estado: estadosOk ? 'ok' : 'warn'
      },
      {
        etiqueta: 'Módulos activos',
        valor: modulosActivos.length ? modulosActivos.map((m) => m.etiqueta).join(', ') : 'Ninguno seleccionado',
        estado: modulosActivos.length ? 'ok' : 'warn'
      }
    ];
  }

  get reglaResumenConAlertas(): boolean {
    return this.resumenReglasOperativas.some((x) => x.estado === 'warn');
  }

  autocorregirReglasGuiadas(): void {
    const v = this.formModal?.value || {};
    const cambios: Array<{ campo: string; antes: string; despues: string }> = [];
    const registrarCambio = (campo: string, antes: string, despues: string) => {
      if ((antes || '') === (despues || '')) return;
      cambios.push({ campo, antes, despues });
    };

    const inicioOriginal = (v.reglaPostulacionFechaInicio || '').toString().trim();
    const finOriginal = (v.reglaPostulacionFechaFin || '').toString().trim();

    let inicio = inicioOriginal;
    let fin = finOriginal;
    if (!inicio && v.fechaApertura) inicio = String(v.fechaApertura).slice(0, 10);
    if (!fin && v.fechaCierre) fin = String(v.fechaCierre).slice(0, 10);
    if (inicio && fin && inicio > fin) {
      const tmp = inicio;
      inicio = fin;
      fin = tmp;
    }

    const informesPermitidos = new Set(this.INFORMES_REQUERIDOS_OPTIONS.map((x) => x.value));
    const informes = ((v.reglaInformesRequeridos || '').toString().toUpperCase().trim());
    const informesNormalizado = informesPermitidos.has(informes) ? informes : 'AMBOS';

    const minBruto = this.toNumeroEntero(v.reglaPlazoCorreccionHorasMin, 24);
    const maxBruto = this.toNumeroEntero(v.reglaPlazoCorreccionHorasMax, 720);
    let min = this.clamp(minBruto, 1, 720);
    let max = this.clamp(maxBruto, 1, 720);
    if (max < min) max = min;
    const defBruto = this.toNumeroEntero(v.reglaPlazoCorreccionHorasDefault, 120);
    const def = this.clamp(defBruto, min, max);

    const estadoPermitidos = new Set(this.ESTADOS_EDITABLES_OPTIONS.map((x) => x.value.toUpperCase()));
    const estadosRaw = Array.isArray(v.reglaEstadosEditables) ? v.reglaEstadosEditables : [];
    const estados: string[] = Array.from(new Set(
      estadosRaw
        .map((x: string) => (x || '').toString().toUpperCase().trim())
        .filter((x: string) => estadoPermitidos.has(x))
    ));
    const estadosNormalizados: string[] = estados.length ? estados : ['PENDIENTE', 'CON_OBSERVACIONES'];
    const estadosOriginalNormalizados = estadosRaw
      .map((x: string) => (x || '').toString().toUpperCase().trim())
      .filter(Boolean);

    const modulosRaw = this.MODULOS_CONVOCATORIA_OPTIONS.map((m) => ({
      ...m,
      valor: !!v[m.control]
    }));
    const modulosNormalizados = modulosRaw.map((m) => ({ ...m, valor: !!m.valor }));
    const algunModuloActivo = modulosNormalizados.some((m) => m.valor);
    if (!algunModuloActivo) {
      const moduloBase = modulosNormalizados.find((m) => m.control === 'reglaModuloEvaluadores');
      if (moduloBase) moduloBase.valor = true;
    }

    registrarCambio('Inicio de postulación', inicioOriginal || '—', inicio || '—');
    registrarCambio('Cierre de postulación', finOriginal || '—', fin || '—');
    registrarCambio(
      'Informes requeridos',
      this.etiquetaInformes(informes || 'AMBOS'),
      this.etiquetaInformes(informesNormalizado)
    );
    registrarCambio('Plazo mínimo de corrección (horas)', String(v.reglaPlazoCorreccionHorasMin ?? '—'), String(min));
    registrarCambio('Plazo máximo de corrección (horas)', String(v.reglaPlazoCorreccionHorasMax ?? '—'), String(max));
    registrarCambio('Plazo por defecto de corrección (horas)', String(v.reglaPlazoCorreccionHorasDefault ?? '—'), String(def));
    registrarCambio(
      'Estados editables',
      this.etiquetaEstadosEditables(estadosOriginalNormalizados),
      this.etiquetaEstadosEditables(estadosNormalizados)
    );
    modulosNormalizados.forEach((m) => {
      registrarCambio(
        m.etiqueta,
        modulosRaw.find((r) => r.control === m.control)?.valor ? 'Activo' : 'Inactivo',
        m.valor ? 'Activo' : 'Inactivo'
      );
    });

    const modulosPatch = modulosNormalizados.reduce((acc, m) => {
      acc[m.control] = m.valor;
      return acc;
    }, {} as Record<string, boolean>);

    this.formModal.patchValue({
      reglaPostulacionFechaInicio: inicio || '',
      reglaPostulacionFechaFin: fin || '',
      reglaInformesRequeridos: informesNormalizado,
      reglaPlazoCorreccionHorasDefault: def,
      reglaPlazoCorreccionHorasMin: min,
      reglaPlazoCorreccionHorasMax: max,
      reglaEstadosEditables: estadosNormalizados,
      ...modulosPatch
    });

    if (!cambios.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sin cambios',
        text: 'Las reglas ya estaban consistentes y no fue necesario ajustar valores.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    const cambiosHtml = cambios.map((c) => {
      return `<li><strong>${this.sanitizarHtml(c.campo)}:</strong> ${this.sanitizarHtml(c.antes)} <i class="fas fa-arrow-right mx-1"></i> ${this.sanitizarHtml(c.despues)}</li>`;
    }).join('');

    Swal.fire({
      icon: 'success',
      title: 'Reglas autocorregidas',
      html: `
        <div class="text-start">
          <p class="mb-2">Se aplicaron ${cambios.length} ajuste(s):</p>
          <ul class="mb-0 ps-3">${cambiosHtml}</ul>
        </div>
      `,
      confirmButtonColor: '#800020'
    });
  }

  private etiquetaInformes(value: string): string {
    switch ((value || '').toUpperCase()) {
      case 'NINGUNO': return 'Ninguno';
      case 'PARCIAL': return 'Solo informe parcial';
      case 'FINAL': return 'Solo informe final';
      default: return 'Parcial y final';
    }
  }

  private etiquetaEstadosEditables(values: string[]): string {
    const map: Record<string, string> = {
      PENDIENTE: 'Pendiente',
      CON_OBSERVACIONES: 'Con observaciones',
      SUBSANADA: 'Subsanada',
      REVISADA: 'Revisada',
      ACEPTADA: 'Aceptada'
    };
    return (values || [])
      .map((x) => map[(x || '').toUpperCase()] || x)
      .filter(Boolean)
      .join(', ');
  }

  private toNumeroEntero(value: unknown, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private sanitizarHtml(value: string): string {
    return (value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackById(_: number, c: Convocatoria): number {
    return c.id;
  }

  agregarCriterio(): void {
    this.criterios.push(this.fb.group({
      clave: ['', [Validators.required, Validators.maxLength(60)]],
      etiqueta: ['', [Validators.required, Validators.maxLength(120)]],
      tipo: ['texto', Validators.required],
      opciones: [''],
      peso: [10, [Validators.required, Validators.min(1), Validators.max(100)]],
      requerido: [false]
    }));
  }

  quitarCriterio(i: number): void {
    this.criterios.removeAt(i);
  }

  necesitaOpciones(tipo: string): boolean {
    return tipo === 'select' || tipo === 'checkbox';
  }

  private criteriosToJson(): string {
    const arr = (this.criterios?.value || []).map((c: any) => ({
      clave: (c.clave || '').trim().replace(/\s+/g, '_') || `criterio_${Date.now()}`,
      etiqueta: (c.etiqueta || '').trim() || 'Sin etiqueta',
      tipo: c.tipo || 'texto',
      opciones: (c.tipo === 'select' || c.tipo === 'checkbox')
        ? (c.opciones || '').split(',').map((o: string) => o.trim()).filter(Boolean)
        : undefined,
      peso: Math.min(100, Math.max(1, +(c.peso) || 10)),
      requerido: !!c.requerido
    })).filter((c: any) => c.etiqueta !== 'Sin etiqueta');
    return arr.length ? JSON.stringify(arr) : '';
  }

  private jsonToCriterios(json: string | null | undefined): void {
    this.criterios.clear();
    if (!json?.trim()) return;
    try {
      const arr: CriterioFormulario[] = JSON.parse(json);
      arr.forEach(c => {
        this.criterios.push(this.fb.group({
          clave: [c.clave || '', [Validators.required, Validators.maxLength(60)]],
          etiqueta: [c.etiqueta || '', [Validators.required, Validators.maxLength(120)]],
          tipo: [c.tipo || 'texto', Validators.required],
          opciones: [Array.isArray(c.opciones) ? c.opciones.join(', ') : (c.opciones || '')],
          peso: [c.peso ?? 10, [Validators.required, Validators.min(1), Validators.max(100)]],
          requerido: [!!c.requerido]
        }));
      });
    } catch {
      // JSON inválido, dejar vacío
    }
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    this.http.get<Convocatoria[]>(`${environment.apiBaseUrl}/admin/convocatorias`).subscribe({
      next: (data) => {
        this.convocatorias = data;
        data.forEach(c => (c.aceptados || []).filter(a => a.fotoDocumentoId).forEach(a => this.cargarFotoAceptado(a)));
        this.loading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'No se pudo cargar el listado';
        this.loading = false;
      }
    });
  }

  get convocatoriasFiltradas(): Convocatoria[] {
    const q = this.norm(this.filtroTexto);
    const area = this.norm(this.filtroArea);
    const estado = this.norm(this.filtroEstado);
    return this.convocatorias.filter((c) => {
      const areaItem = this.norm(c.area || '');
      const vigente = c.vigente ? 'vigente' : 'inactiva';
      const publicacion = this.norm(c.estadoPublicacion || '');
      const texto = this.norm(`${c.titulo} ${c.descripcion || ''} ${c.area || ''} ${c.keywords || ''}`);
      const okQ = !q || texto.includes(q);
      const okArea = !area || areaItem === area;
      const okEstado = !estado || vigente === estado || publicacion === estado;
      return okQ && okArea && okEstado;
    });
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroArea = '';
    this.filtroEstado = '';
  }

  abrirCrear(): void {
    this.editando = null;
    this.errorImagen = '';
    this.errorFormato = '';
    this.formatosExistentes = [];
    this.formatosPendientes = [];
    this.formModal.reset({
      titulo: '', descripcion: '', resumen: '', requisitos: '', fechaApertura: '', fechaCierre: '', area: '',
      folioConvocatoria: '', folioPrefijo: '', keywords: '', limiteAceptados: '',
      puntajeMaximoEvaluacion: 100, diasMinAnticipacion: 20, diasMaxAnticipacion: 60,
      avisoPrivacidadObligatorio: false, avisoPrivacidadTexto: '', avisoPrivacidadUrl: '',
      imagenUrl: '', iconoUrl: '', vigente: true, visibilidadPublica: true,
      reglaPostulacionFechaInicio: '', reglaPostulacionFechaFin: '', reglaInformesRequeridos: 'AMBOS',
      reglaPlazoCorreccionHorasDefault: 120, reglaPlazoCorreccionHorasMin: 24, reglaPlazoCorreccionHorasMax: 720,
      reglaEstadosEditables: ['PENDIENTE', 'CON_OBSERVACIONES'],
      reglaModuloEvaluadores: true, reglaModuloComite: true, reglaModuloCotejo: true,
      reglaModuloInformes: true, reglaModuloBancaria: true, reglaModuloRenuncia: true
    });
    this.criterios.clear();
    this.requisitosDocs.clear();
    this.tiposApoyo.clear();
    this.reglasConfigurables.clear();
    this.cargarPlantillaReglasBase();
    this.agregarTipoApoyo('Profesor participante');
    this.agregarTipoApoyo('Profesor asesor');
    this.agregarTipoApoyo('Estudiante en concurso');
    this.modalVisible = true;
  }

  abrirEditar(c: Convocatoria): void {
    this.editando = c;
    this.errorImagen = '';
    this.errorFormato = '';
    this.formatosPendientes = [];
    this.formatosExistentes = c.formatos ? [...c.formatos] : [];
    this.cargarFormatos(c.id);
    this.formModal.patchValue({
      titulo: c.titulo || '',
      descripcion: c.descripcion || '',
      resumen: c.resumen || '',
      requisitos: c.requisitos || '',
      fechaApertura: c.fechaApertura ? c.fechaApertura.toString().slice(0, 10) : '',
      fechaCierre: c.fechaCierre ? c.fechaCierre.toString().slice(0, 10) : '',
      area: c.area || '',
      folioConvocatoria: c.folioConvocatoria || '',
      folioPrefijo: c.folioPrefijo || '',
      keywords: c.keywords || '',
      limiteAceptados: c.limiteAceptados ?? '',
      puntajeMaximoEvaluacion: c.puntajeMaximoEvaluacion ?? 100,
      diasMinAnticipacion: c.diasMinAnticipacion ?? 20,
      diasMaxAnticipacion: c.diasMaxAnticipacion ?? 60,
      avisoPrivacidadObligatorio: c.avisoPrivacidadObligatorio ?? false,
      avisoPrivacidadTexto: c.avisoPrivacidadTexto || '',
      avisoPrivacidadUrl: c.avisoPrivacidadUrl || '',
      imagenUrl: c.imagenUrl || '',
      iconoUrl: c.iconoUrl || '',
      vigente: c.vigente ?? true,
      visibilidadPublica: c.visibilidadPublica ?? true,
      reglaPostulacionFechaInicio: '',
      reglaPostulacionFechaFin: '',
      reglaInformesRequeridos: 'AMBOS',
      reglaPlazoCorreccionHorasDefault: 120,
      reglaPlazoCorreccionHorasMin: 24,
      reglaPlazoCorreccionHorasMax: 720,
      reglaEstadosEditables: ['PENDIENTE', 'CON_OBSERVACIONES'],
      reglaModuloEvaluadores: true,
      reglaModuloComite: true,
      reglaModuloCotejo: true,
      reglaModuloInformes: true,
      reglaModuloBancaria: true,
      reglaModuloRenuncia: true
    });
    this.jsonToCriterios(c.criteriosFormulario);
    this.jsonToRequisitosDocs(c.requisitosDocumentos);
    this.jsonToTiposApoyo(c.tiposApoyo);
    this.jsonToReglasConfigurables(c.reglasConfigurables);
    if (this.tiposApoyo.length === 0) {
      this.agregarTipoApoyo('Profesor participante');
      this.agregarTipoApoyo('Profesor asesor');
      this.agregarTipoApoyo('Estudiante en concurso');
    }
    this.modalVisible = true;
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.editando = null;
    this.errorFormato = '';
    this.formatosExistentes = [];
    this.formatosPendientes = [];
  }

  guardar(): void {
    if (this.formModal.invalid) {
      this.formModal.markAllAsTouched();
      Swal.fire({ icon: 'warning', title: 'Formulario incompleto', text: 'Completa los campos obligatorios.', confirmButtonColor: '#800020' });
      return;
    }
    const fg = this.formModal.value || {};
    const fechaInicio = (fg.reglaPostulacionFechaInicio || '').trim();
    const fechaFin = (fg.reglaPostulacionFechaFin || '').trim();
    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      Swal.fire({ icon: 'warning', title: 'Rango de fechas inválido', text: 'La fecha de inicio de postulación no puede ser mayor a la fecha de cierre.', confirmButtonColor: '#800020' });
      return;
    }
    const plazoMin = parseInt(String(fg.reglaPlazoCorreccionHorasMin ?? ''), 10);
    const plazoMax = parseInt(String(fg.reglaPlazoCorreccionHorasMax ?? ''), 10);
    const plazoDef = parseInt(String(fg.reglaPlazoCorreccionHorasDefault ?? ''), 10);
    if (!Number.isFinite(plazoMin) || !Number.isFinite(plazoMax) || plazoMin < 1 || plazoMax < plazoMin) {
      Swal.fire({ icon: 'warning', title: 'Rango de corrección inválido', text: 'Define un rango válido de horas mínimas y máximas para corrección.', confirmButtonColor: '#800020' });
      return;
    }
    if (!Number.isFinite(plazoDef) || plazoDef < plazoMin || plazoDef > plazoMax) {
      Swal.fire({ icon: 'warning', title: 'Plazo por defecto inválido', text: 'El plazo por defecto debe estar dentro del rango mínimo y máximo.', confirmButtonColor: '#800020' });
      return;
    }
    const estadosEditables = Array.isArray(fg.reglaEstadosEditables) ? fg.reglaEstadosEditables : [];
    if (!estadosEditables.length) {
      Swal.fire({ icon: 'warning', title: 'Estados editables requeridos', text: 'Selecciona al menos un estado editable para la postulación.', confirmButtonColor: '#800020' });
      return;
    }
    const tiposApoyoJson = this.tiposApoyoToJson();
    if (!tiposApoyoJson) {
      Swal.fire({ icon: 'warning', title: 'Tipos de apoyo requeridos', text: 'Agrega al menos un tipo de apoyo para la convocatoria.', confirmButtonColor: '#800020' });
      return;
    }
    const reglasJson = this.reglasConfigurablesToJson();
    if (!reglasJson) {
      Swal.fire({ icon: 'warning', title: 'Reglas requeridas', text: 'Cada convocatoria debe tener al menos una regla configurada.', confirmButtonColor: '#800020' });
      return;
    }
    const v = this.formModal.value;
    const lim = v.limiteAceptados !== '' && v.limiteAceptados != null ? parseInt(v.limiteAceptados, 10) : null;
    const puntajeMax = v.puntajeMaximoEvaluacion !== '' && v.puntajeMaximoEvaluacion != null
      ? parseInt(v.puntajeMaximoEvaluacion, 10)
      : 100;
    const diasMinAnticipacion = v.diasMinAnticipacion !== '' && v.diasMinAnticipacion != null
      ? parseInt(v.diasMinAnticipacion, 10)
      : 20;
    const diasMaxAnticipacion = v.diasMaxAnticipacion !== '' && v.diasMaxAnticipacion != null
      ? parseInt(v.diasMaxAnticipacion, 10)
      : 60;
    const diasMin = (!isNaN(diasMinAnticipacion) && diasMinAnticipacion >= 0) ? diasMinAnticipacion : 20;
    const diasMax = (!isNaN(diasMaxAnticipacion) && diasMaxAnticipacion >= 0) ? diasMaxAnticipacion : 60;
    if (diasMin > diasMax) {
      Swal.fire({ icon: 'warning', title: 'Rango inválido', text: 'Los días mínimos de anticipación no pueden ser mayores al máximo.', confirmButtonColor: '#800020' });
      return;
    }
    const payload = {
      titulo: v.titulo?.trim() || '',
      descripcion: v.descripcion?.trim() || null,
      resumen: v.resumen?.trim() || null,
      requisitos: v.requisitos?.trim() || null,
      fechaApertura: v.fechaApertura || null,
      fechaCierre: v.fechaCierre || null,
      area: v.area?.trim() || null,
      folioConvocatoria: v.folioConvocatoria?.trim() || null,
      folioPrefijo: v.folioPrefijo?.trim() || null,
      keywords: v.keywords?.trim() || null,
      limiteAceptados: (lim != null && !isNaN(lim) && lim > 0) ? lim : null,
      puntajeMaximoEvaluacion: (!isNaN(puntajeMax) && puntajeMax > 0) ? puntajeMax : 100,
      diasMinAnticipacion: diasMin,
      diasMaxAnticipacion: diasMax,
      avisoPrivacidadObligatorio: !!v.avisoPrivacidadObligatorio,
      avisoPrivacidadTexto: v.avisoPrivacidadTexto?.trim() || null,
      avisoPrivacidadUrl: v.avisoPrivacidadUrl?.trim() || null,
      imagenUrl: v.imagenUrl?.trim() || null,
      iconoUrl: v.iconoUrl?.trim() || null,
      vigente: v.vigente ?? true,
      visibilidadPublica: v.visibilidadPublica ?? true,
      criteriosFormulario: this.criteriosToJson() || null,
      requisitosDocumentos: this.requisitosDocsToJson() || null,
      tiposApoyo: tiposApoyoJson,
      reglasConfigurables: reglasJson
    };

    this.guardando = true;
    const req = this.editando
      ? this.http.patch<Convocatoria>(`${environment.apiBaseUrl}/admin/convocatorias/${this.editando.id}`, payload)
      : this.http.post<Convocatoria>(`${environment.apiBaseUrl}/admin/convocatorias`, payload);

    const estabaEditando = !!this.editando;
    req.subscribe({
      next: (convocatoriaGuardada) => {
        const convocatoriaId = convocatoriaGuardada?.id || this.editando?.id;
        if (!convocatoriaId) {
          this.finalizarGuardadoConvocatoria(estabaEditando);
          return;
        }
        this.subirFormatosPendientes(convocatoriaId).subscribe({
          next: () => this.finalizarGuardadoConvocatoria(estabaEditando),
          error: (err: { error?: { message?: string } }) => {
            this.guardando = false;
            this.subiendoFormatos = false;
            this.cargar();
            Swal.fire({
              icon: 'warning',
              title: 'Convocatoria guardada',
              text: err?.error?.message || 'La convocatoria se guardó, pero no se pudieron cargar todos los formatos.',
              confirmButtonColor: '#800020'
            });
          }
        });
      },
      error: (err: { error?: { message?: string } }) => {
        this.guardando = false;
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo guardar.', confirmButtonColor: '#800020' });
      }
    });
  }

  private finalizarGuardadoConvocatoria(estabaEditando: boolean): void {
    this.guardando = false;
    this.subiendoFormatos = false;
    this.cerrarModal();
    this.cargar();
    Swal.fire({
      icon: 'success',
      title: 'Guardado',
      text: estabaEditando ? 'Convocatoria actualizada.' : 'Convocatoria creada.',
      confirmButtonColor: '#800020'
    });
  }

  confirmarEliminar(c: Convocatoria): void {
    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar convocatoria?',
      html: `Se eliminará <strong>${c.titulo}</strong>.`,
      showCancelButton: true,
      confirmButtonColor: '#800020',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (res.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/admin/convocatorias/${c.id}`).subscribe({
          next: () => {
            this.cargar();
            Swal.fire({ icon: 'success', title: 'Eliminada', text: 'Convocatoria eliminada.', confirmButtonColor: '#800020' });
          },
          error: (err: { error?: { message?: string } }) => {
            Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo eliminar.', confirmButtonColor: '#800020' });
          }
        });
      }
    });
  }

  duplicarConvocatoria(c: Convocatoria): void {
    Swal.fire({
      icon: 'question',
      title: '¿Duplicar convocatoria?',
      html: `Se creará una copia de <strong>${c.titulo}</strong> con la misma configuración y sin solicitudes.`,
      showCancelButton: true,
      confirmButtonColor: '#800020',
      confirmButtonText: 'Duplicar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.http.post<Convocatoria>(`${environment.apiBaseUrl}/admin/convocatorias/${c.id}/duplicar`, {}).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Convocatoria duplicada', text: 'Se creó la copia correctamente.', confirmButtonColor: '#800020' });
        },
        error: (err: { error?: { message?: string } }) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo duplicar la convocatoria.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  publicarConvocatoria(c: Convocatoria): void {
    Swal.fire({
      icon: 'question',
      title: '¿Publicar convocatoria?',
      html: `La convocatoria <strong>${c.titulo}</strong> quedará visible en el micrositio.`,
      showCancelButton: true,
      confirmButtonColor: '#800020',
      confirmButtonText: 'Publicar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.http.post<Convocatoria>(`${environment.apiBaseUrl}/admin/convocatorias/${c.id}/publicar`, {}).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Convocatoria publicada', text: 'Ya está visible para las personas aspirantes.', confirmButtonColor: '#800020' });
        },
        error: (err: { error?: { message?: string } }) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo publicar la convocatoria.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  retirarPublicacion(c: Convocatoria): void {
    Swal.fire({
      icon: 'warning',
      title: '¿Retirar publicación?',
      html: `La convocatoria <strong>${c.titulo}</strong> dejará de mostrarse en el micrositio público.`,
      showCancelButton: true,
      confirmButtonColor: '#800020',
      confirmButtonText: 'Retirar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.http.post<Convocatoria>(`${environment.apiBaseUrl}/admin/convocatorias/${c.id}/retirar-publicacion`, {}).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Publicación retirada', text: 'La convocatoria ya no se muestra públicamente.', confirmButtonColor: '#800020' });
        },
        error: (err: { error?: { message?: string } }) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo retirar la publicación.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  onImagenSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.errorImagen = '';
    if (!file.type.startsWith('image/')) {
      this.errorImagen = 'Archivo no válido. Selecciona una imagen (PNG, JPG, etc.).';
      input.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.errorImagen = 'La imagen no debe superar 2 MB.';
      input.value = '';
      return;
    }
    this.subiendoImagen = true;
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<{ url: string }>(`${environment.apiBaseUrl}/admin/convocatorias/imagen`, fd).subscribe({
      next: (res) => {
        this.formModal.patchValue({ imagenUrl: res.url || '' });
        this.subiendoImagen = false;
        this.errorImagen = '';
      },
      error: (err) => {
        this.subiendoImagen = false;
        this.errorImagen = err?.error?.message || 'No se pudo subir la imagen.';
      }
    });
  }

  onFormatosSeleccionados(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.errorFormato = '';
    const permitidas = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
    for (const file of files) {
      const lower = file.name.toLowerCase();
      const extensionOk = permitidas.some((ext) => lower.endsWith(ext));
      if (!extensionOk) {
        this.errorFormato = 'Solo se permiten formatos PDF, Word o Excel.';
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        this.errorFormato = 'Cada formato debe pesar máximo 10 MB.';
        continue;
      }
      this.formatosPendientes.push({
        file,
        nombre: this.nombreSinExtension(file.name),
        descripcion: ''
      });
    }
    input.value = '';
  }

  quitarFormatoPendiente(index: number): void {
    this.formatosPendientes.splice(index, 1);
  }

  eliminarFormatoExistente(formato: FormatoConvocatoria): void {
    if (!this.editando?.id || !formato?.id) return;
    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar formato?',
      html: `Se eliminará <strong>${this.sanitizarHtml(formato.nombre || formato.nombreArchivo)}</strong> de esta convocatoria.`,
      showCancelButton: true,
      confirmButtonColor: '#800020',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed || !this.editando?.id) return;
      this.http.delete(`${environment.apiBaseUrl}/admin/convocatorias/${this.editando.id}/formatos/${formato.id}`).subscribe({
        next: () => {
          this.formatosExistentes = this.formatosExistentes.filter((f) => f.id !== formato.id);
          this.cargar();
        },
        error: (err: { error?: { message?: string } }) => {
          Swal.fire({ icon: 'error', title: 'No se pudo eliminar', text: err?.error?.message || 'Intenta nuevamente.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  descargarFormato(formato: FormatoConvocatoria): void {
    const convocatoriaId = this.editando?.id || formato.convocatoriaId;
    if (!convocatoriaId || !formato?.id) return;
    window.open(`${environment.apiBaseUrl}/convocatorias/${convocatoriaId}/formatos/${formato.id}`, '_blank');
  }

  formatearPeso(bytes: number | null | undefined): string {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private cargarFormatos(convocatoriaId: number): void {
    this.http.get<FormatoConvocatoria[]>(`${environment.apiBaseUrl}/admin/convocatorias/${convocatoriaId}/formatos`).subscribe({
      next: (formatos) => this.formatosExistentes = formatos || [],
      error: () => this.formatosExistentes = this.formatosExistentes || []
    });
  }

  private subirFormatosPendientes(convocatoriaId: number) {
    if (!this.formatosPendientes.length) return of([]);
    this.subiendoFormatos = true;
    const requests = this.formatosPendientes.map((item) => {
      const fd = new FormData();
      fd.append('file', item.file);
      fd.append('nombre', item.nombre?.trim() || this.nombreSinExtension(item.file.name));
      fd.append('descripcion', item.descripcion?.trim() || '');
      return this.http.post<FormatoConvocatoria>(`${environment.apiBaseUrl}/admin/convocatorias/${convocatoriaId}/formatos`, fd);
    });
    return forkJoin(requests);
  }

  private nombreSinExtension(nombre: string): string {
    const limpio = (nombre || '').trim();
    const idx = limpio.lastIndexOf('.');
    return idx > 0 ? limpio.substring(0, idx) : limpio;
  }

  quitarImagen(): void {
    this.formModal.patchValue({ imagenUrl: '' });
  }

  seleccionarIcono(url: string): void {
    this.formModal.patchValue({ iconoUrl: url });
  }

  limpiarIcono(): void {
    this.formModal.patchValue({ iconoUrl: '' });
  }

  esIconoSeleccionado(url: string): boolean {
    return this.formModal.get('iconoUrl')?.value === url;
  }

  obtenerImagenSrc(url: string | null | undefined): string {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('/')) return url;
    return url.startsWith('assets/') ? url : '/' + url;
  }

  formatearFecha(s: string | null | undefined): string {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return s;
    }
  }

  getEstadoPublicacionLabel(c: Convocatoria): string {
    const estado = (c.estadoPublicacion || '').toUpperCase();
    const labels: Record<string, string> = {
      BORRADOR: 'Borrador',
      PROGRAMADA: 'Programada',
      PUBLICADA: 'Publicada',
      CERRADA: 'Cerrada',
      RETIRADA: 'Retirada',
      INACTIVA: 'Inactiva'
    };
    return labels[estado] || (c.visibilidadPublica === false ? 'Borrador' : 'Publicada');
  }

  getEstadoPublicacionClass(c: Convocatoria): string {
    const estado = (c.estadoPublicacion || '').toUpperCase();
    if (estado === 'PUBLICADA') return 'bg-success';
    if (estado === 'PROGRAMADA') return 'bg-info text-dark';
    if (estado === 'CERRADA') return 'bg-secondary';
    if (estado === 'RETIRADA') return 'bg-dark';
    if (estado === 'INACTIVA') return 'bg-warning text-dark';
    return 'bg-light text-dark border';
  }

  private norm(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  getProgresoCupo(c: Convocatoria): number | null {
    const lim = c.limiteAceptados;
    if (lim == null || lim <= 0) return null;
    const cant = c.cantidadAceptados ?? 0;
    return Math.min(100, Math.round((cant / lim) * 100));
  }

  getInicialAceptado(a: Aceptado): string {
    const n = (a.nombre || '').trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  getFotoUrlAceptado(a: Aceptado): string | SafeResourceUrl {
    return a.fotoUrl || '';
  }

  private cargarFotoAceptado(a: Aceptado): void {
    if (!a.fotoDocumentoId) return;
    this.http.get(`${environment.apiBaseUrl}/documentos/${a.fotoDocumentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        a.fotoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        this.cdr.detectChanges();
      },
      error: () => { a.fotoUrl = null; this.cdr.detectChanges(); }
    });
  }
}

