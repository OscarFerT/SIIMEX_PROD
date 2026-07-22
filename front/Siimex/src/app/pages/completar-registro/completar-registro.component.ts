import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  FormGroup,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { Usuario } from '../../core/models/user';
import Swal from 'sweetalert2';
import { firstValueFrom } from 'rxjs';

/**
 * Control de navegación entre secciones
 */
type View =
  | 'inicio' | 'area-conocimiento' | 'aportaciones' | 'divulgacion' | 'congresos'
  | 'cursos' | 'estancias' | 'trayectoria-profesional' | 'idiomas' | 'logros'
  | 'trayectoria-academica' | 'institucion' | 'personaPrincipal' | 'padronInstitucional' | 'documentos';

interface GradoAcademico {
  nivelNombre: string;
  titulo: string;
  estatusNombre: string;
  cedulaProfesional: string;
  opcionTitulacion: string;
  tituloTesis: string;
  fechaObtencion: string;
  institucion: string;
}

interface CursoImpartido {
  nombre: string;
  programa: string;
  horasTotales: number;
  fechaInicio: string;
  fechaFin: string;
  institucion: string;
  nivelEscolaridad: string;
  productoPrincipal: boolean;
}

interface IdiomaDominio {
  nombre: string;
  dominioNombre: string;
  conversacion: string;
  lectura: string;
  escritura: string;
  esCertificado: boolean;
  certInstitucion: string;
  certPuntuacion: string;
  vigenciaFin: string;
  certDocumento: File | null;
  certDocumentoNombre: string;
  certDocumentoPersistido: boolean;
}

interface EstanciaInvestigacion {
  nombreProyecto: string;
  tipoNombre: string;
  logros: string;
  fechaInicio: string;
  fechaFin: string;
  institucionReceptora: string;
}

interface AutorArticuloItem {
  nombre: string;
  orcid: string;
  orden: number;
}

interface ArticuloCientifico {
  idExterno: string;
  eje: string;
  tipo: string;
  productoPrincipal: boolean;
  anio: number | null;
  issn: string;
  issnElectronico: string;
  doi: string;
  nombreRevista: string;
  titulo: string;
  rolParticipacionNombre: string;
  estadoNombre: string;
  objetivoNombre: string;
  recibioApoyoSECIHTI: boolean;
  fondoProgramaNombre: string;
  totalCitas: number;
  autores: AutorArticuloItem[];
}

interface DivulgacionCientifica {
  titulo: string;
  tipoDivulgacionNombre: string;
  medioNombre: string;
  dirigidoA: string;
  productoObtenidoNombre: string;
  fecha: string;
  institucionOrganizadora: string;
  evidenciaTipo: 'LINK' | 'PDF';
  evidenciaLink: string;
  evidenciaArchivo: File | null;
  evidenciaArchivoNombre: string;
}

interface LogroReconocimiento {
  tipo: string;
  nombre: string;
  anio: number | null;
}

const MAX_MB = 5;
const MAX_BYTES = MAX_MB * 1024 * 1024;

function requiredFile(): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const value = ctrl.value;
    const yaGuardado = !!value && typeof value === 'object' && (value as any).persisted === true;
    return value instanceof File || yaGuardado ? null : { requiredFile: true };
  };
}

interface CatalogItem {
  clave: string;
  nombre: string;
  parentKey?: string;
  extra1?: string;
  extra2?: string;
  extra3?: string;
}

interface InstitucionEducativaItem {
  id: number | null;
  cct?: string;
  nombre: string;
  domicilio?: string;
  colonia?: string;
  codigoPostal?: string;
  municipio?: string;
  entidadFederativa?: string;
  telefono?: string;
  director?: string;
  correo?: string;
  nivelEducativo?: string;
  estado?: string;
}

type InstitucionCatalogControl = 'inst_nombre' | 'acad_institucion' | 'tray_prof_institucion' | 'curso_institucion';

@Component({
  selector: 'app-completar-registro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './completar-registro.component.html',
  styleUrl: './completar-registro.component.css',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class CompletarRegistroComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // Estados
  // La vista inicial del flujo es Migración SECIHTI.
  view = signal<View>('documentos');
  submitting = signal(false);
  processingMigration = signal(false);
  savingSection = signal(false);
  submitProgress = signal(0);
  submitProgressBadge = signal('Guardando');
  submitProgressTitle = signal('Procesando registro');
  submitProgressLabel = signal('Preparando información del registro...');
  submitProgressDetails = signal('Validando y organizando los datos antes de enviarlos.');
  /** true mientras se cargan los datos del usuario desde el servidor */
  loadingUserData = signal(false);
  /** true si la carga automática falló (servidor lento, etc.); permite editar manualmente */
  dataLoadFailed = signal(false);
  errorMsg = '';
  okMsg = '';
  currentUsuarioId: number | null = null;
  /** Tipo de perfil del usuario: INVESTIGADOR | INNOVADOR | HIBRIDO (para generar ID interno SIIMEX-INV/IND/HIB-XXX) */
  currentTipoPerfil: string | null = null;
  jsonFileName: string | null = null;
  isDraggingJson = false;

  form!: FormGroup;
  private readonly STORAGE_KEY = 'siimex_migration_session';
  private readonly seccionesObligatorias: View[] = [
    'personaPrincipal',
    'padronInstitucional',
    'institucion',
    'area-conocimiento'
  ];
  private readonly archivosGuardados: Record<string, { documentoId: number; nombre: string }> = {};
  private readonly archivosSubidosEnSesion = new WeakSet<File>();
  readonly catalogoOtroValue = '__OTRO__';

  autoresList: AutorArticuloItem[] = [
    { nombre: '', orcid: '', orden: 1 }
  ];
  articulosCientificosList: ArticuloCientifico[] = [];
  editingArticuloIndex: number | null = null;

  congresosList: {
    nombre: string; tituloTrabajo: string; tipoParticipacion: string; tipoParticipacionManual?: string;
    fecha: string; paisSede: string; paisSedeManual?: string; productoPrincipal: boolean;
  }[] = [
    { nombre: '', tituloTrabajo: '', tipoParticipacion: '', tipoParticipacionManual: '', fecha: '', paisSede: '', paisSedeManual: '', productoPrincipal: false }
  ];

  acadGradosList: GradoAcademico[] = [];
  editingGradoIndex: number | null = null;
  cursosImpartidosList: CursoImpartido[] = [];
  editingCursoIndex: number | null = null;
  idiomasDominioList: IdiomaDominio[] = [];
  editingIdiomaIndex: number | null = null;
  estanciasInvestigacionList: EstanciaInvestigacion[] = [];
  editingEstanciaIndex: number | null = null;
  divulgacionesCientificasList: DivulgacionCientifica[] = [];
  editingDivulgacionIndex: number | null = null;
  logrosReconocimientosList: LogroReconocimiento[] = [];
  editingLogroIndex: number | null = null;

  catalogoEntidadesFederativas: CatalogItem[] = [];
  catalogoNacionalidades: CatalogItem[] = [];
  catalogoEstadosCiviles: CatalogItem[] = [
    { clave: 'SOLTERO', nombre: 'Soltero(a)' },
    { clave: 'CASADO', nombre: 'Casado(a)' },
    { clave: 'DIVORCIADO', nombre: 'Divorciado(a)' },
    { clave: 'VIUDO', nombre: 'Viudo(a)' },
    { clave: 'UNION_LIBRE', nombre: 'Unión Libre' }
  ];
  catalogoIdentificaciones: CatalogItem[] = [
    { clave: 'INE', nombre: 'INE' },
    { clave: 'PASAPORTE', nombre: 'Pasaporte' },
    { clave: 'CEDULA_PROFESIONAL', nombre: 'Cédula profesional' },
    { clave: 'CARTILLA', nombre: 'Cartilla' },
    { clave: 'OTRA', nombre: 'Otra' }
  ];
  catalogoRedesSociales: CatalogItem[] = [];
  catalogoMunicipios: CatalogItem[] = [];
  catalogoLocalidades: CatalogItem[] = [];
  catalogoLocalidadesFiltradas: CatalogItem[] = [];
  catalogoInstitucionesEducativas: InstitucionEducativaItem[] = [];
  catalogoCarreras: CatalogItem[] = [];
  selectedInstitucionRegistroId = '';
  selectedInstitucionAcademicaId = '';
  selectedInstitucionProfesionalId = '';
  selectedInstitucionCursoId = '';
  selectedCarreraClave = '';
  selectedNacionalidadNombre = '';
  selectedMunicipioNacimientoNombre = '';
  selectedEntidadDomicilioNombre = '';
  selectedMunicipioNombre = '';
  selectedLocalidadNombre = '';
  selectedRedSocialClave = '';
  selectedGradoNombre = '';
  acadEstatusManual = '';
  cursoNivelManual = '';
  estanciaTipoManual = '';
  divulgTipoManual = '';
  divulgMedioManual = '';
  divulgDirigidoManual = '';
  divulgProductoManual = '';
  catalogoTiposInstitucion: CatalogItem[] = [
    { clave: 'NAC', nombre: 'Institución nacional (México)' },
    { clave: 'EXT', nombre: 'Institución extranjera (internacional)' },
    { clave: 'OTRO', nombre: 'Otro' }
  ];
  catalogoGradosEstudio: CatalogItem[] = [
    { clave: 'DOCTORADO', nombre: 'Doctorado' },
    { clave: 'MAESTRIA', nombre: 'Maestría' },
    { clave: 'LICENCIATURA', nombre: 'Licenciatura' },
    { clave: 'ESPECIALIDAD', nombre: 'Especialidad' },
    { clave: 'OTRO', nombre: 'Otro' }
  ];
  readonly opcionesEstatusAcademico = ['Titulado', 'Pasante', 'En curso', 'En trámite', 'Candidato'];
  readonly opcionesNivelCurso = ['Licenciatura', 'Maestría', 'Doctorado', 'Técnico superior'];
  readonly opcionesTipoEstancia = ['Posdoctoral', 'Sabatina', 'Investigador Invitado', 'Estancia Corta'];
  readonly opcionesTipoDivulgacion = ['Científica', 'Tecnológica', 'Humanista'];
  readonly opcionesMedioDivulgacion = ['Televisión', 'Radio', 'Prensa escrita', 'Redes sociales'];
  readonly opcionesDirigidoADivulgacion = ['Público general', 'Estudiantes', 'Especialistas'];
  readonly opcionesProductoDivulgacion = ['Video / Grabación', 'Reseña escrita', 'Material didáctico', 'Constancia de participación', 'Entrevista publicada'];
  // Lista de entidades federativas de México
  entidadesFederativas: string[] = [
    'Aguascalientes',
    'Baja California',
    'Baja California Sur',
    'Campeche',
    'Chiapas',
    'Chihuahua',
    'Ciudad de México',
    'Distrito Federal',
    'Coahuila',
    'Colima',
    'Durango',
    'Estado de México',
    'Guanajuato',
    'Guerrero',
    'Hidalgo',
    'Jalisco',
    'Michoacán',
    'Morelos',
    'Nayarit',
    'Nuevo León',
    'Oaxaca',
    'Puebla',
    'Querétaro',
    'Quintana Roo',
    'San Luis Potosí',
    'Sinaloa',
    'Sonora',
    'Tabasco',
    'Tamaulipas',
    'Tlaxcala',
    'Veracruz',
    'Yucatán',
    'Zacatecas'
  ];

  // Lista de estados de Estados Unidos
  estadosEstadosUnidos: string[] = [
    'Alabama',
    'Alaska',
    'Arizona',
    'Arkansas',
    'California',
    'Carolina del Norte',
    'Carolina del Sur',
    'Colorado',
    'Connecticut',
    'Delaware',
    'Distrito de Columbia',
    'Florida',
    'Georgia',
    'Hawaii',
    'Idaho',
    'Illinois',
    'Indiana',
    'Iowa',
    'Kansas',
    'Kentucky',
    'Luisiana',
    'Maine',
    'Maryland',
    'Massachusetts',
    'Míchigan',
    'Minnesota',
    'Misisipi',
    'Misuri',
    'Montana',
    'Nebraska',
    'Nevada',
    'Nueva Hampshire',
    'Nueva Jersey',
    'Nueva York',
    'Nuevo México',
    'Ohio',
    'Oklahoma',
    'Oregón',
    'Pensilvania',
    'Rhode Island',
    'Tennessee',
    'Texas',
    'Utah',
    'Vermont',
    'Virginia',
    'Virginia Occidental',
    'Washington',
    'Wisconsin',
    'Wyoming'
  ];

  // Años disponibles para "Año del catálogo" (de actual a 1990)
  readonly catalogoYears: number[] = this.generarCatalogoYears();

  ngOnInit(): void {
    this.initForm();
    this.configurarSuscripcionesCatalogo();
    this.loadCatalogos();
    
    // Verificar si el usuario ya completó el registro
    this.checkIfRegistrationCompleted();
    
    // Cargar datos del usuario primero, antes de cargar borrador
    this.loadUserData(); // Cargar datos de Registro1 automáticamente
    
    // Luego cargar borrador si existe (esto sobreescribirá los datos del usuario si hay borrador)
    this.loadDraft();
    
    // 💡 SOLUCIÓN AL ERROR DE rfcNum: 
    // Sincroniza el RFC de la pantalla 1 con el campo técnico rfcNum para que no sea invalidado
    this.form.get('pers_rfc')?.valueChanges.subscribe(val => {
      this.form.get('rfcNum')?.setValue(val, { emitEvent: false });
    });

    // Limpiar campos de estado/entidad cuando cambie el país
    this.form.get('inst_pais_nombre')?.valueChanges.subscribe(pais => {
      if (pais === 'México') {
        // Si se selecciona México, limpiar el campo de estado de EUA
        this.form.get('inst_estado_usa')?.setValue('', { emitEvent: false });
      } else if (pais === 'Estados Unidos') {
        // Si se selecciona EUA, limpiar campos de ubicación de México
        this.form.get('inst_entidad_nombre')?.setValue('', { emitEvent: false });
        this.form.get('inst_municipio_nombre')?.setValue('', { emitEvent: false });
      } else {
        // Si no hay país seleccionado, limpiar campos de ubicación
        this.form.get('inst_entidad_nombre')?.setValue('', { emitEvent: false });
        this.form.get('inst_estado_usa')?.setValue('', { emitEvent: false });
        this.form.get('inst_municipio_nombre')?.setValue('', { emitEvent: false });
      }
    });

    // Si cambia el estado de México, reiniciar municipio para evitar inconsistencias
    this.form.get('inst_entidad_nombre')?.valueChanges.subscribe(() => {
      const municipioControl = this.form.get('inst_municipio_nombre');
      const paisNombre = this.form.get('inst_pais_nombre')?.value;
      const entidadSeleccionada = (this.form.get('inst_entidad_nombre')?.value || '').toString().trim();

      municipioControl?.setValue('', { emitEvent: false });
      if (paisNombre === 'México' && entidadSeleccionada) {
        municipioControl?.setValidators([Validators.required]);
      } else {
        municipioControl?.clearValidators();
      }
      municipioControl?.updateValueAndValidity({ emitEvent: false });
    });

    // Validar que las horas totales no sean negativas (mínimo 0, pero inicializa en 5)
    this.form.get('curso_horas_totales')?.valueChanges.subscribe(val => {
      if (val !== null && val !== undefined) {
        const numVal = Number(val);
        if (isNaN(numVal) || numVal < 0) {
          this.form.get('curso_horas_totales')?.setValue(0, { emitEvent: false });
        }
      }
    });

    // Validar que todos los campos numéricos no acepten valores negativos
    // art_anio tiene un mínimo especial de 1800
    const numericFields = ['art_total_citas', 'art_autor_orden', 'logro_anio'];
    numericFields.forEach(fieldName => {
      this.form.get(fieldName)?.valueChanges.subscribe(val => {
        if (val !== null && val !== undefined && val !== '') {
          const numVal = Number(val);
          if (!isNaN(numVal) && numVal < 0) {
            this.form.get(fieldName)?.setValue(0, { emitEvent: false });
          }
        }
      });
    });


    // Validación condicional: art_fondo_prog_nombre es obligatorio si art_recibio_apoyo_SECIHTI es true
    this.form.get('art_recibio_apoyo_SECIHTI')?.valueChanges.subscribe(recibioApoyo => {
      const fondoProgControl = this.form.get('art_fondo_prog_nombre');
      if (recibioApoyo) {
        fondoProgControl?.setValidators([Validators.required]);
      } else {
        fondoProgControl?.clearValidators();
        fondoProgControl?.setValue('', { emitEvent: false });
      }
      fondoProgControl?.updateValueAndValidity({ emitEvent: false });
    });

    // Idiomas: reglas de certificación por dominio
    this.form.get('idioma_dominio_nombre')?.valueChanges.subscribe(nivelDominio => {
      const esCertificadoControl = this.form.get('idioma_es_certificado');
      const esExcelente = nivelDominio === 'Excelente';
      const esAvanzado = nivelDominio === 'Avanzado';

      if (esExcelente) {
        // En Excelente, la certificación debe estar activa
        esCertificadoControl?.setValue(true, { emitEvent: false });
      } else if (!esAvanzado) {
        // En niveles menores, se limpia certificación
        esCertificadoControl?.setValue(false, { emitEvent: false });
        this.form.get('idioma_cert_institucion')?.setValue('', { emitEvent: false });
        this.form.get('idioma_cert_puntuacion')?.setValue('', { emitEvent: false });
        this.form.get('idioma_vigencia_fin')?.setValue('', { emitEvent: false });
        this.form.get('idioma_cert_documento')?.setValue(null, { emitEvent: false });
      }

      this.actualizarValidacionesCondicionales();
    });

    this.form.get('idioma_es_certificado')?.valueChanges.subscribe(esCertificado => {
      const dominio = this.form.get('idioma_dominio_nombre')?.value;
      if (dominio === 'Excelente' && !esCertificado) {
        // En Excelente no se puede desactivar certificación
        this.form.get('idioma_es_certificado')?.setValue(true, { emitEvent: false });
      }
      this.actualizarValidacionesCondicionales();
    });

    // Validación condicional: evidencias de divulgación
    // - Video/Grabación y Entrevista publicada: evidencia por link obligatorio
    // - Resto de productos: evidencia por PDF obligatorio
    this.form.get('divulg_prod_obtenido_nombre')?.valueChanges.subscribe(productoObtenido => {
      const archivoControl = this.form.get('divulg_archivo');
      const linkControl = this.form.get('divulg_evidencia_link');
      const producto = (productoObtenido || '').toString().trim();
      const usaLink = this.esProductoConEvidenciaLink(producto);

      if (producto) {
        if (usaLink) {
          linkControl?.setValidators([Validators.required, Validators.pattern('https?://.*')]);
          archivoControl?.clearValidators();
          archivoControl?.setValue(null, { emitEvent: false });
        } else {
          archivoControl?.setValidators([requiredFile()]);
          linkControl?.clearValidators();
          linkControl?.setValue('', { emitEvent: false });
        }
      } else {
        archivoControl?.clearValidators();
        archivoControl?.setValue(null, { emitEvent: false });
        linkControl?.clearValidators();
        linkControl?.setValue('', { emitEvent: false });
      }
      archivoControl?.updateValueAndValidity({ emitEvent: false });
      linkControl?.updateValueAndValidity({ emitEvent: false });
    });

    // Validación condicional: constancia SNII obligatoria solo si activa el switch
    this.form.get('acad_es_perfil_snii')?.valueChanges.subscribe((esPerfilSnii) => {
      const constanciaControl = this.form.get('acad_constancia_snii');
      if (esPerfilSnii) {
        constanciaControl?.setValidators([requiredFile()]);
      } else {
        constanciaControl?.clearValidators();
        constanciaControl?.setValue(null, { emitEvent: false });
      }
      constanciaControl?.updateValueAndValidity({ emitEvent: false });
    });

    // Validación condicional: Si es empleo actual, deshabilitar y limpiar fecha de término
    this.form.get('tray_prof_es_actual')?.valueChanges.subscribe(esActual => {
      const fechaFinControl = this.form.get('tray_prof_fecha_fin');
      if (esActual) {
        fechaFinControl?.setValue('', { emitEvent: false });
        fechaFinControl?.disable({ emitEvent: false });
      } else {
        fechaFinControl?.enable({ emitEvent: false });
      }
    });

    // Validación condicional: inst_entidad_nombre es obligatorio si inst_pais_nombre es 'México'
    // inst_estado_usa es obligatorio si inst_pais_nombre es 'Estados Unidos'
    this.form.get('inst_pais_nombre')?.valueChanges.subscribe(paisNombre => {
      const entidadControl = this.form.get('inst_entidad_nombre');
      const estadoUsaControl = this.form.get('inst_estado_usa');
      const municipioControl = this.form.get('inst_municipio_nombre');
      const entidadSeleccionada = (entidadControl?.value || '').toString().trim();
      
      if (paisNombre === 'México') {
        entidadControl?.setValidators([Validators.required]);
        estadoUsaControl?.clearValidators();
        estadoUsaControl?.setValue('', { emitEvent: false });
        if (entidadSeleccionada) {
          municipioControl?.setValidators([Validators.required]);
        } else {
          municipioControl?.clearValidators();
          municipioControl?.setValue('', { emitEvent: false });
        }
      } else if (paisNombre === 'Estados Unidos') {
        estadoUsaControl?.setValidators([Validators.required]);
        entidadControl?.clearValidators();
        entidadControl?.setValue('', { emitEvent: false });
        municipioControl?.clearValidators();
        municipioControl?.setValue('', { emitEvent: false });
      } else {
        entidadControl?.clearValidators();
        estadoUsaControl?.clearValidators();
        municipioControl?.clearValidators();
        entidadControl?.setValue('', { emitEvent: false });
        estadoUsaControl?.setValue('', { emitEvent: false });
        municipioControl?.setValue('', { emitEvent: false });
      }
      
      entidadControl?.updateValueAndValidity({ emitEvent: false });
      estadoUsaControl?.updateValueAndValidity({ emitEvent: false });
      municipioControl?.updateValueAndValidity({ emitEvent: false });
    });

    // Verificar estado inicial: si ya está marcado como actual, deshabilitar fecha de término
    const esActualInicial = this.form.get('tray_prof_es_actual')?.value;
    if (esActualInicial) {
      const fechaFinControl = this.form.get('tray_prof_fecha_fin');
      fechaFinControl?.setValue('', { emitEvent: false });
      fechaFinControl?.disable({ emitEvent: false });
    }
  }

  /**
   * Verificar si el usuario ya completó el registro
   */
  private checkIfRegistrationCompleted(): void {
    if (!this.authService.isLoggedIn()) {
      return;
    }

    // Verificar si el usuario tiene un PerfilMigracion guardado
    this.http.get<any>(`${environment.apiBaseUrl}/migracion/verificar`).subscribe({
      next: (response: any) => {
        if (response && response.tienePerfilMigracion) {
          // El usuario ya completó el registro
          this.showRegistrationCompletedAlert(
            response.usuarioId, 
            response.perfilMigracionId,
            response.nombreCompleto,
            response.curp
          );
        }
        // Si no tiene perfilMigracion, permitir continuar normalmente
      },
      error: (err) => {
        // Si hay error al verificar, permitir continuar (por si acaso)
        // Error al verificar estado del registro - continuar normalmente
        // No mostrar error al usuario, permitir que continúe
      }
    });
  }

  /**
   * Mostrar alerta de que el registro ya está completado
   */
  private showRegistrationCompletedAlert(
    usuarioId: number, 
    perfilMigracionId: number | null,
    nombreCompleto: string,
    curp: string
  ): void {
    Swal.fire({
      icon: 'info',
      title: 'Registro ya completado',
      html: `
        <p><strong>Usuaria o usuario:</strong> ${nombreCompleto}</p>
        <p><strong>CURP:</strong> ${curp}</p>
        <p>La usuaria o el usuario ya ha completado su registro previamente.</p>
        ${perfilMigracionId ? `<p><small>ID de Perfil migración: ${perfilMigracionId}</small></p>` : ''}
        <p><strong>No es necesario completarlo nuevamente.</strong></p>
        <p>Serás redirigido a tu perfil...</p>
      `,
      confirmButtonColor: '#800020',
      confirmButtonText: 'Ir a mi perfil',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showCancelButton: false,
      timer: 5000,
      timerProgressBar: true
    }).then(() => {
      // Redirigir a perfil
      this.router.navigate(['/app/perfil']);
    });
  }

  /**
   * Generar ID interno con formato SIIMEX-INV-XXX (investigador),
   * SIIMEX-IND-XXX (innovador) o SIIMEX-HIB-XXX (perfil mixto).
   * XXX es el id de usuario rellenado a 3 dígitos (001, 002, ...).
   */
  private generarIdInterno(tipoPerfil: string | null, usuarioId: number | null): string {
    const tipo = (tipoPerfil || '').toUpperCase();
    const esMixto =
      tipo === 'HIBRIDO' ||
      tipo === 'MIXTO' ||
      tipo === 'INVESTIGADOR_INNOVADOR' ||
      tipo === 'INNOVADOR_INVESTIGADOR';
    const sufijo = esMixto ? 'HIB' : (tipo === 'INNOVADOR' ? 'IND' : 'INV');
    const numero = usuarioId != null ? String(usuarioId).padStart(3, '0') : '001';
    return `SIIMEX-${sufijo}-${numero}`;
  }

  /**
   * Actualizar ID interno cuando se disponga de tipoPerfil y usuarioId (tras cargar datos del usuario).
   */
  private actualizarUUID(): void {
    if (this.currentUsuarioId != null) {
      const idGenerado = this.generarIdInterno(this.currentTipoPerfil, this.currentUsuarioId);
      this.form.get('uuid_interno')?.setValue(idGenerado, { emitEvent: false });
    }
  }

  /**
   * Reintentar cargar los datos del usuario (cuando falló por servidor lento).
   */
  retryLoadUserData(): void {
    this.dataLoadFailed.set(false);
    this.loadUserData();
  }

  /**
   * Prellenar formulario con datos de usuario almacenados localmente (fallback cuando me() falla).
   */
  private prefillFromStoredUser(userData: Usuario): void {
    const formData: { [key: string]: string } = {};
    if (userData.nombre) formData['pers_nombre'] = userData.nombre;
    if (userData.apellidoPaterno) formData['pers_primer_apellido'] = userData.apellidoPaterno;
    if (userData.apellidoMaterno) formData['pers_segundo_apellido'] = userData.apellidoMaterno ?? '';
    if (userData.curp) formData['pers_curp'] = userData.curp;
    if (userData.rfc) {
      formData['pers_rfc'] = userData.rfc;
      formData['rfcNum'] = userData.rfc;
    }
    if (userData.fechaNacimiento) formData['pers_fecha_nacimiento'] = userData.fechaNacimiento;
    if (userData.entidadFederativa) formData['pers_entidad_nombre'] = userData.entidadFederativa;
    if (userData.paisNacimiento) formData['pers_pais_nac_nombre'] = userData.paisNacimiento ?? '';
    if (userData.nacionalidad) formData['pers_nacionalidad_nombre'] = userData.nacionalidad ?? '';
    if (userData.municipio) formData['pers_municipio_nombre'] = userData.municipio;
    if (userData.genero) {
      const m: Record<string, string> = { 'MASCULINO': 'Hombre', 'FEMENINO': 'Mujer', 'OTRO': 'Otro' };
      formData['pers_sexo_nombre'] = m[userData.genero] ?? userData.genero;
    }
    if (userData.estadoCivil) {
      const m: Record<string, string> = {
        'SOLTERO': 'Soltero(a)', 'CASADO': 'Casado(a)', 'DIVORCIADO': 'Divorciado(a)',
        'VIUDO': 'Viudo(a)', 'UNION_LIBRE': 'Unión Libre'
      };
      formData['pers_estado_civil_nombre'] = m[userData.estadoCivil] ?? userData.estadoCivil;
    }
    this.aplicarDatosPadronUsuario(formData, userData);
    if (userData.id) this.currentUsuarioId = userData.id;
    if (userData.tipoPerfil) this.currentTipoPerfil = userData.tipoPerfil;
    const idInterno = this.generarIdInterno(userData.tipoPerfil ?? null, userData.id ?? null);
    formData['uuid_interno'] = idInterno;
    this.form.patchValue(formData);
  }

  /**
   * Cargar automáticamente los datos de Registro1 del usuario autenticado.
   * Si el servidor tarda o falla, permite editar manualmente y usa fallbacks (localStorage/sessionStorage).
   */
  private loadUserData(): void {
    if (!this.authService.isLoggedIn()) {
      this.loadingUserData.set(false);
      return;
    }

    this.loadingUserData.set(true);
    this.dataLoadFailed.set(false);
    this.cargarArchivosGuardados();

    this.authService.me().subscribe({
      next: (userData: Usuario) => {
        this.loadingUserData.set(false);
        // Guardar el usuarioId y tipoPerfil para usarlos al enviar el formulario y generar ID interno
        if (userData.id) {
          this.currentUsuarioId = userData.id;
        }
        this.currentTipoPerfil = userData.tipoPerfil ?? null;

        // Mapear los datos de Registro1 al formulario
        const formData: { [key: string]: string } = {};

        if (userData.nombre) {
          formData['pers_nombre'] = userData.nombre;
        }
        if (userData.apellidoPaterno) {
          formData['pers_primer_apellido'] = userData.apellidoPaterno;
        }
        if (userData.apellidoMaterno) {
          formData['pers_segundo_apellido'] = userData.apellidoMaterno;
        }
        if (userData.curp) {
          formData['pers_curp'] = userData.curp;
        }
        if (userData.rfc) {
          formData['pers_rfc'] = userData.rfc;
          formData['rfcNum'] = userData.rfc; // También actualizar el campo técnico
        }
        if (userData.fechaNacimiento) {
          // Mantener el formato yyyy-MM-dd para el input type="date"
          formData['pers_fecha_nacimiento'] = userData.fechaNacimiento;
        }
        if (userData.entidadFederativa) {
          formData['pers_entidad_nombre'] = userData.entidadFederativa;
        }
        if (userData.paisNacimiento) {
          formData['pers_pais_nac_nombre'] = userData.paisNacimiento;
        }
        if (userData.nacionalidad) {
          formData['pers_nacionalidad_nombre'] = userData.nacionalidad;
        }
        if (userData.municipio) {
          formData['pers_municipio_nombre'] = userData.municipio;
        }
        if (userData.genero) {
          // Mapear el enum del backend al valor del select
          const generoMap: { [key: string]: string } = {
            'MASCULINO': 'Hombre',
            'FEMENINO': 'Mujer',
            'OTRO': 'Otro'
          };
          const generoMapeado = generoMap[userData.genero] || userData.genero;
          formData['pers_sexo_nombre'] = generoMapeado;
        }
        if (userData.estadoCivil) {
          // Mapear el enum del backend al valor del select
          const estadoCivilMap: { [key: string]: string } = {
            'SOLTERO': 'Soltero(a)',
            'CASADO': 'Casado(a)',
            'DIVORCIADO': 'Divorciado(a)',
            'VIUDO': 'Viudo(a)',
            'UNION_LIBRE': 'Unión Libre'
          };
          const estadoCivilMapeado = estadoCivilMap[userData.estadoCivil] || userData.estadoCivil;
          formData['pers_estado_civil_nombre'] = estadoCivilMapeado;
        }
        this.aplicarDatosPadronUsuario(formData, userData);

        // Generar ID interno: SIIMEX-INV-XXX (investigador), SIIMEX-IND-XXX (innovador) o SIIMEX-HIB-XXX (mixto)
        const idInterno = this.generarIdInterno(userData.tipoPerfil ?? null, userData.id ?? null);
        formData['uuid_interno'] = idInterno;

        // Verificar si hay datos guardados en sessionStorage
        const saved = sessionStorage.getItem(this.STORAGE_KEY);
        if (!saved) {
          // No hay datos guardados, aplicar los datos del usuario directamente
          this.form.patchValue(formData);
        } else {
          // Hay datos guardados, pero verificar si son del usuario actual
          try {
            const savedData = JSON.parse(saved) as { [key: string]: any };
            if (Array.isArray(savedData['_autoresList']) && savedData['_autoresList'].length > 0) {
              this.autoresList = savedData['_autoresList'];
            }
            delete savedData['_autoresList'];
            if (Array.isArray(savedData['_articulosCientificosList']) && savedData['_articulosCientificosList'].length > 0) {
              this.articulosCientificosList = savedData['_articulosCientificosList'];
            }
            delete savedData['_articulosCientificosList'];
            this.editingArticuloIndex = savedData['_editingArticuloIndex'] ?? null;
            delete savedData['_editingArticuloIndex'];
            if (Array.isArray(savedData['_congresosList']) && savedData['_congresosList'].length > 0) {
              this.congresosList = savedData['_congresosList'];
            }
            delete savedData['_congresosList'];
            if (Array.isArray(savedData['_acadGradosList']) && savedData['_acadGradosList'].length > 0) {
              this.acadGradosList = savedData['_acadGradosList'];
            }
            delete savedData['_acadGradosList'];
            this.editingGradoIndex = savedData['_editingGradoIndex'] ?? null;
            delete savedData['_editingGradoIndex'];
            if (Array.isArray(savedData['_cursosImpartidosList']) && savedData['_cursosImpartidosList'].length > 0) {
              this.cursosImpartidosList = savedData['_cursosImpartidosList'];
            }
            delete savedData['_cursosImpartidosList'];
            this.editingCursoIndex = savedData['_editingCursoIndex'] ?? null;
            delete savedData['_editingCursoIndex'];
            if (Array.isArray(savedData['_idiomasDominioList']) && savedData['_idiomasDominioList'].length > 0) {
              this.idiomasDominioList = savedData['_idiomasDominioList'].map((item: any) => this.normalizarIdioma(item));
            }
            delete savedData['_idiomasDominioList'];
            this.editingIdiomaIndex = savedData['_editingIdiomaIndex'] ?? null;
            delete savedData['_editingIdiomaIndex'];
            if (Array.isArray(savedData['_estanciasInvestigacionList']) && savedData['_estanciasInvestigacionList'].length > 0) {
              this.estanciasInvestigacionList = savedData['_estanciasInvestigacionList'];
            }
            delete savedData['_estanciasInvestigacionList'];
            this.editingEstanciaIndex = savedData['_editingEstanciaIndex'] ?? null;
            delete savedData['_editingEstanciaIndex'];
            if (Array.isArray(savedData['_divulgacionesCientificasList']) && savedData['_divulgacionesCientificasList'].length > 0) {
              this.divulgacionesCientificasList = savedData['_divulgacionesCientificasList'].map((item: any) => ({
                titulo: (item?.titulo || '').toString(),
                tipoDivulgacionNombre: (item?.tipoDivulgacionNombre || '').toString(),
                medioNombre: (item?.medioNombre || '').toString(),
                dirigidoA: (item?.dirigidoA || '').toString(),
                productoObtenidoNombre: (item?.productoObtenidoNombre || '').toString(),
                fecha: (item?.fecha || '').toString(),
                institucionOrganizadora: (item?.institucionOrganizadora || '').toString(),
                evidenciaTipo: item?.evidenciaTipo === 'LINK' ? 'LINK' : 'PDF',
                evidenciaLink: (item?.evidenciaLink || '').toString(),
                evidenciaArchivo: null,
                evidenciaArchivoNombre: (item?.evidenciaArchivoNombre || '').toString()
              }));
            }
            delete savedData['_divulgacionesCientificasList'];
            this.editingDivulgacionIndex = savedData['_editingDivulgacionIndex'] ?? null;
            delete savedData['_editingDivulgacionIndex'];
            if (Array.isArray(savedData['_logrosReconocimientosList']) && savedData['_logrosReconocimientosList'].length > 0) {
              this.logrosReconocimientosList = savedData['_logrosReconocimientosList'];
            }
            delete savedData['_logrosReconocimientosList'];
            this.editingLogroIndex = savedData['_editingLogroIndex'] ?? null;
            delete savedData['_editingLogroIndex'];
            // Verificar si el CURP guardado coincide con el del usuario actual
            const savedCurp = savedData['pers_curp'];
            const currentCurp = userData.curp;
            
            if (savedCurp && currentCurp && savedCurp === currentCurp) {
              // Los datos guardados son del mismo usuario
              // Aplicar los datos guardados primero
              this.form.patchValue(savedData);
              // Luego asegurar que genero y estadoCivil del usuario se apliquen (sobrescriben los guardados)
              if (formData['pers_sexo_nombre']) {
                this.form.patchValue({ pers_sexo_nombre: formData['pers_sexo_nombre'] });
              }
              if (formData['pers_estado_civil_nombre']) {
                this.form.patchValue({ pers_estado_civil_nombre: formData['pers_estado_civil_nombre'] });
              }
            } else {
              // Los datos guardados son de otro usuario, limpiarlos y aplicar datos del usuario actual
              sessionStorage.removeItem(this.STORAGE_KEY);
              this.form.patchValue(formData);
            }
          } catch (e) {
            // Error al parsear, limpiar sessionStorage y aplicar datos del usuario
            sessionStorage.removeItem(this.STORAGE_KEY);
            this.form.patchValue(formData);
          }
        }
        
        // La BD sigue siendo la fuente de verdad para los datos ya confirmados.
        // Si existe borrador local, se conserva y solo se sincronizan campos críticos persistidos.
        this.cargarAvancePersistido(!!sessionStorage.getItem(this.STORAGE_KEY));

        // Inicializar validaciones condicionales después de cargar datos
        this.actualizarValidacionesCondicionales();
      },
      error: (_err: unknown) => {
        this.loadingUserData.set(false);
        this.dataLoadFailed.set(true);
        // Usar userId de fallback (guardado al registrar) para permitir enviar el formulario
        const fallbackId = this.authService.getStoredUserId();
        if (fallbackId != null) {
          this.currentUsuarioId = fallbackId;
          this.currentTipoPerfil = this.currentTipoPerfil ?? 'INVESTIGADOR';
          const idInterno = this.generarIdInterno(this.currentTipoPerfil, fallbackId);
          this.form.get('uuid_interno')?.setValue(idInterno, { emitEvent: false });
        }
        // Prellenar desde localStorage si hay datos de me() previos
        const stored = this.authService.currentUser;
        if (stored) {
          this.prefillFromStoredUser(stored);
        }
        this.actualizarValidacionesCondicionales();
      }
    });
  }

  private cargarAvancePersistido(conservarBorradorLocal = false): void {
    this.http.get<any>(environment.apiBaseUrl + '/usuarios/me/detalle').subscribe({
      next: detalle => {
        if (conservarBorradorLocal) {
          this.sincronizarCamposPersistidosCriticos(detalle);
          return;
        }
        this.aplicarAvancePersistido(detalle);
      },
      error: () => {
        // Mantener el endpoint específico de idiomas como respaldo si falla el detalle general.
        this.cargarIdiomasGuardados();
      }
    });
  }

  private sincronizarCamposPersistidosCriticos(detalle: any): void {
    const claveOficial = (detalle?.institucion?.claveOficial || '').toString().trim();
    if (!claveOficial) {
      return;
    }

    this.form.patchValue({ inst_clave_oficial: claveOficial }, { emitEvent: false });
    this.saveDraft();
  }

  private aplicarAvancePersistido(detalle: any): void {
    if (!detalle) {
      return;
    }

    const patch: Record<string, unknown> = {};
    if (detalle.semblanza) patch['pers_semblanza'] = detalle.semblanza;

    const institucion = detalle.institucion || {};
    if (institucion.nombre) patch['inst_nombre'] = institucion.nombre;
    if (institucion.claveOficial) patch['inst_clave_oficial'] = institucion.claveOficial;
    if (institucion.tipoId) patch['inst_tipo_id'] = institucion.tipoId;
    if (institucion.tipoNombre) patch['inst_tipo_nombre'] = institucion.tipoNombre;
    if (institucion.paisNombre) patch['inst_pais_nombre'] = institucion.paisNombre;
    if (institucion.paisNombre === 'Estados Unidos') {
      if (institucion.entidadNombre) patch['inst_estado_usa'] = institucion.entidadNombre;
    } else {
      if (institucion.entidadNombre) patch['inst_entidad_nombre'] = institucion.entidadNombre;
      if (institucion.municipioNombre) patch['inst_municipio_nombre'] = institucion.municipioNombre;
    }
    if (institucion.nivelUnoNombre) patch['inst_nivel_uno_nombre'] = institucion.nivelUnoNombre;
    if (institucion.nivelDosNombre) patch['inst_nivel_dos_nombre'] = institucion.nivelDosNombre;

    const area = detalle.areaConocimiento || {};
    if (area.areaId) patch['area_id'] = area.areaId;
    if (area.areaNombre) patch['area_nombre'] = area.areaNombre;
    if (area.areaClave) patch['area_clave'] = area.areaClave;
    if (area.areaVersion) patch['area_version'] = area.areaVersion;
    if (area.campoId) patch['campo_id'] = area.campoId;
    if (area.campoNombre) patch['campo_nombre'] = area.campoNombre;
    if (area.campoClave) patch['campo_clave'] = area.campoClave;
    if (area.disciplinaId) patch['disciplina_id'] = area.disciplinaId;
    if (area.disciplinaNombre) patch['disciplina_nombre'] = area.disciplinaNombre;
    if (area.disciplinaClave) patch['disciplina_clave'] = area.disciplinaClave;
    if (area.subdisciplinaId) patch['subdisciplina_id'] = area.subdisciplinaId;
    if (area.subdisciplinaNombre) patch['subdisciplina_nombre'] = area.subdisciplinaNombre;
    if (area.subdisciplinaClave) patch['subdisciplina_clave'] = area.subdisciplinaClave;

    const profesionales = Array.isArray(detalle.trayectoriaProfesional) ? detalle.trayectoriaProfesional : [];
    const profesional = profesionales.find((item: any) => item?.esActual) || profesionales[0];
    if (profesional) {
      patch['tray_prof_nombramiento'] = profesional.nombramiento || '';
      patch['tray_prof_institucion'] = profesional.institucion || '';
      patch['tray_prof_fecha_inicio'] = profesional.fechaInicio || '';
      patch['tray_prof_fecha_fin'] = profesional.fechaFin || '';
      patch['tray_prof_es_actual'] = !!profesional.esActual;
      patch['tray_prof_logros'] = profesional.logros || '';
    }

    const grados = Array.isArray(detalle.trayectoriaAcademica) ? detalle.trayectoriaAcademica : [];
    this.acadGradosList = grados
      .map((item: any) => ({
        nivelNombre: (item?.nivelNombre || '').toString(),
        titulo: (item?.titulo || '').toString(),
        estatusNombre: (item?.estatusNombre || '').toString(),
        cedulaProfesional: (item?.cedulaProfesional || '').toString(),
        opcionTitulacion: (item?.opcionTitulacion || '').toString(),
        tituloTesis: (item?.tituloTesis || '').toString(),
        fechaObtencion: (item?.fechaObtencion || '').toString(),
        institucion: (item?.institucion || '').toString()
      }))
      .filter((item: GradoAcademico) => !!(item.nivelNombre && item.titulo && item.estatusNombre));
    if (grados.some((item: any) => !!item?.esPerfilSnii)) {
      patch['acad_es_perfil_snii'] = true;
    }

    const cursos = Array.isArray(detalle.cursos) ? detalle.cursos : [];
    this.cursosImpartidosList = cursos
      .map((item: any) => ({
        nombre: (item?.nombre || '').toString(),
        programa: (item?.programa || '').toString(),
        horasTotales: Number(item?.horasTotales ?? 0),
        fechaInicio: (item?.fechaInicio || '').toString(),
        fechaFin: (item?.fechaFin || '').toString(),
        institucion: (item?.institucion || '').toString(),
        nivelEscolaridad: (item?.nivelEscolaridad || '').toString(),
        productoPrincipal: !!item?.productoPrincipal
      }))
      .filter((item: CursoImpartido) => !!(item.nombre && item.programa));

    const idiomas = Array.isArray(detalle.idiomas) ? detalle.idiomas : [];
    this.idiomasDominioList = idiomas
      .map((item: any) => this.normalizarIdioma(item))
      .filter((item: IdiomaDominio) => !!(item.nombre && item.dominioNombre));

    const estancias = Array.isArray(detalle.estancias) ? detalle.estancias : [];
    this.estanciasInvestigacionList = estancias
      .map((item: any) => ({
        nombreProyecto: (item?.nombreProyecto || '').toString(),
        tipoNombre: (item?.tipoNombre || '').toString(),
        logros: (item?.logros || '').toString(),
        fechaInicio: (item?.fechaInicio || '').toString(),
        fechaFin: (item?.fechaFin || '').toString(),
        institucionReceptora: (item?.institucionReceptora || '').toString()
      }))
      .filter((item: EstanciaInvestigacion) => !!(item.nombreProyecto && item.tipoNombre));

    const articulos = Array.isArray(detalle.articulos) ? detalle.articulos : [];
    this.articulosCientificosList = articulos
      .map((item: any) => ({
        idExterno: (item?.idExterno || '').toString(),
        eje: (item?.eje || '').toString(),
        tipo: (item?.tipo || '').toString(),
        productoPrincipal: !!item?.productoPrincipal,
        anio: item?.anio == null ? null : Number(item.anio),
        issn: (item?.issn || '').toString(),
        issnElectronico: (item?.issnElectronico || '').toString(),
        doi: (item?.doi || '').toString(),
        nombreRevista: (item?.nombreRevista || '').toString(),
        titulo: (item?.titulo || '').toString(),
        rolParticipacionNombre: (item?.rolParticipacionNombre || '').toString(),
        estadoNombre: (item?.estadoNombre || '').toString(),
        objetivoNombre: (item?.objetivoNombre || '').toString(),
        recibioApoyoSECIHTI: !!item?.fondoProgramaNombre,
        fondoProgramaNombre: (item?.fondoProgramaNombre || '').toString(),
        totalCitas: Number(item?.totalCitas ?? 0),
        autores: (Array.isArray(item?.autores) ? item.autores : []).map((autor: any, index: number) => ({
          nombre: (autor?.nombreCompleto || autor?.nombre || '').toString(),
          orcid: (autor?.orcid || '').toString(),
          orden: Number(autor?.orden ?? index + 1)
        }))
      }))
      .filter((item: ArticuloCientifico) => !!(item.titulo && item.nombreRevista));

    const congresos = Array.isArray(detalle.congresos) ? detalle.congresos : [];
    const congresosNormalizados = congresos
      .map((item: any) => ({
        nombre: (item?.nombreEvento || '').toString(),
        tituloTrabajo: (item?.tituloTrabajo || '').toString(),
        tipoParticipacion: (item?.tipoParticipacionNombre || '').toString(),
        tipoParticipacionManual: '',
        fecha: (item?.fecha || '').toString(),
        paisSede: (item?.paisSede || '').toString(),
        paisSedeManual: '',
        productoPrincipal: !!item?.productoPrincipal
      }))
      .filter((item: any) => !!item.nombre);
    if (congresosNormalizados.length > 0) {
      this.congresosList = congresosNormalizados;
    }

    const divulgaciones = Array.isArray(detalle.divulgaciones) ? detalle.divulgaciones : [];
    this.divulgacionesCientificasList = divulgaciones
      .map((item: any) => ({
        titulo: (item?.titulo || '').toString(),
        tipoDivulgacionNombre: (item?.tipoDivulgacionNombre || '').toString(),
        medioNombre: (item?.medioNombre || '').toString(),
        dirigidoA: (item?.dirigidoA || '').toString(),
        productoObtenidoNombre: (item?.productoObtenidoNombre || '').toString(),
        fecha: (item?.fecha || '').toString(),
        institucionOrganizadora: (item?.institucionOrganizadora || '').toString(),
        evidenciaTipo: item?.evidenciaTipo === 'LINK' ? 'LINK' as const : 'PDF' as const,
        evidenciaLink: (item?.evidenciaLink || '').toString(),
        evidenciaArchivo: null,
        evidenciaArchivoNombre: (item?.evidenciaArchivoNombre || '').toString()
      }))
      .filter((item: DivulgacionCientifica) => !!item.titulo);

    const logros = Array.isArray(detalle.logros) ? detalle.logros : [];
    this.logrosReconocimientosList = logros
      .map((item: any) => ({
        tipo: (item?.tipo || '').toString(),
        nombre: (item?.nombre || '').toString(),
        anio: item?.anio == null ? null : Number(item.anio)
      }))
      .filter((item: LogroReconocimiento) => !!item.nombre);

    this.form.patchValue(patch, { emitEvent: false });
    this.sincronizarGradosAcademicosAntesDeEnviar();
    this.sincronizarCursosAntesDeEnviar();
    this.sincronizarIdiomasAntesDeEnviar();
    this.sincronizarEstanciasAntesDeEnviar();
    this.sincronizarArticulosAntesDeEnviar();
    this.sincronizarDivulgacionesAntesDeEnviar();
    this.sincronizarLogrosAntesDeEnviar();
    this.sincronizarValoresCatalogoActuales();
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }
  private aplicarDatosPadronUsuario(formData: { [key: string]: string }, userData: Usuario): void {
    const campos: Array<keyof Usuario> = [
      'telefono',
      'celular',
      'tipoIdentificacionOficial',
      'identificacionOficial',
      'calle',
      'numeroExterior',
      'numeroInterior',
      'entreCalle',
      'yCalle',
      'otraReferencia',
      'colonia',
      'claveLocalidad',
      'localidad',
      'claveMunicipio',
      'claveEntidadFederativa',
      'codigoPostal',
      'claveAgeb',
      'claveRedSocial',
      'redSocial'
    ];
    campos.forEach((campo) => {
      const value = userData[campo];
      if (typeof value === 'string' && value.trim()) {
        formData[campo] = value;
      }
    });
    if (!formData['municipioDomicilio'] && userData.municipioDomicilio) {
      formData['municipioDomicilio'] = userData.municipioDomicilio;
    }
  }

  /**
   * 📝 CONFIGURACIÓN DEL FORMULARIO (SNAKE_CASE)
   * He restaurado los campos exactamente como los tenías, pero con los Validators que pediste.
   */
  private initForm(): void {
    this.form = this.fb.group({
      // CONTROL
      uuid_interno: [''], // Se genera automáticamente basado en datos del usuario
      fecha_migracion: [new Date().toISOString()],
      estatus_migracion: ['PENDIENTE'],

      // 1. PERFIL (CVU)
      perfil_cvu: [''], perfil_login: [''], perfil_correo_alterno: [''], perfil_nivel_academico: [''],
      perfil_titulo_tratamiento: [''], perfil_filtro: [''], perfil_institucion_receptora: [''],
      perfil_created_date: [null], perfil_last_modified_date: [null],

      // 2. PERSONA PRINCIPAL
      pers_nombre: ['', [Validators.required]],
      pers_primer_apellido: ['', [Validators.required]],
      pers_segundo_apellido: [''],
      pers_curp: ['', [Validators.required]],
      pers_rfc: ['', [Validators.required]],
      pers_fecha_nacimiento: ['', [Validators.required]],
      pers_sexo_id: [''], pers_sexo_nombre: ['', [Validators.required]], pers_pais_nac_id: [''], pers_pais_nac_nombre: [''],
      pers_entidad_clave: [''], pers_entidad_nombre: ['', [Validators.required]], pers_estado_civil_id: [''], pers_estado_civil_nombre: ['', [Validators.required]],
      pers_nacionalidad_id: [''], pers_nacionalidad_nombre: ['', [Validators.required]],
      pers_municipio_nombre: ['', [Validators.required]],
      pers_orcid_url: ['', [Validators.pattern('https?://.*')]],
      pers_scholar_url: ['', [Validators.pattern('https?://.*')]],
      pers_semblanza: ['', [Validators.required]],

      // 2.1 PADRÓN INSTITUCIONAL DICyFRH
      telefono: ['', [Validators.required]],
      celular: [''],
      tipoIdentificacionOficial: ['', [Validators.required]],
      identificacionOficial: ['', [Validators.required, Validators.maxLength(80)]],
      calle: ['', [Validators.required]],
      numeroExterior: ['', [Validators.required]],
      numeroInterior: [''],
      entreCalle: [''],
      yCalle: [''],
      otraReferencia: [''],
      colonia: ['', [Validators.required]],
      claveLocalidad: [''],
      localidad: ['', [Validators.required]],
      claveMunicipio: [''],
      municipioDomicilio: ['', [Validators.required]],
      claveEntidadFederativa: [''],
      codigoPostal: ['', [Validators.required, Validators.pattern('^[0-9]{5}$')]],
      claveAgeb: [''],
      claveRedSocial: [''],
      redSocial: [''],

      // 3. FOTO E INTERESES
      foto_uri: [''], interes_descripcion: [''], habilidad_descripcion: [''], habilidad_nivel: [''],

      // 4. ÁREA DEL CONOCIMIENTO
      area_id: [''], area_nombre: ['', [Validators.required]], area_clave: ['', [Validators.required]],
      area_version: ['', [Validators.pattern('^[0-9]{4}$')]],
      campo_id: [''], campo_nombre: [''], campo_clave: [''],
      disciplina_id: [''], disciplina_nombre: [''], disciplina_clave: [''],
      subdisciplina_id: [''], subdisciplina_nombre: [''], subdisciplina_clave: [''],

      // 5. INSTITUCIÓN
      inst_clave_oficial: ['', [Validators.required]],
      inst_nombre: ['', [Validators.required]],
      inst_tipo_id: ['', [Validators.required]], inst_tipo_nombre: [''],
      inst_pais_nombre: ['', [Validators.required]], inst_entidad_nombre: [''],
      inst_municipio_nombre: [''],
      inst_estado_usa: [''],
      inst_nivel_uno_nombre: [''], inst_nivel_dos_nombre: [''],

      // 6. TRAYECTORIA ACADÉMICA
      acad_nivel_nombre: ['', [Validators.required]],
      acad_titulo: ['', [Validators.required]],
      acad_estatus_nombre: ['', [Validators.required]],
      acad_institucion: [''],
      acad_cedula_profesional: [''],
      acad_es_perfil_snii: [false],
      acad_constancia_snii: [null],
      acad_opcion_titulacion: [''], acad_titulo_tesis: [''], acad_fecha_obtencion: [''],

      // 7. IDIOMAS
      idioma_nombre: ['', [Validators.required]],
      idioma_dominio_nombre: ['', [Validators.required]],
      idioma_conversacion: [''], idioma_lectura: [''], idioma_escritura: [''],
      idioma_es_certificado: [false], idioma_cert_institucion: [''], idioma_cert_puntuacion: [''], idioma_vigencia_fin: [''],
      idioma_cert_documento: [null],

      // 8. TRAYECTORIA PROFESIONAL / ESTANCIAS
      tray_prof_nombramiento: ['', [Validators.required]],
      tray_prof_institucion: ['', [Validators.required]],
      tray_prof_fecha_inicio: ['', [Validators.required]],
      tray_prof_fecha_fin: [''], tray_prof_es_actual: [false], tray_prof_logros: [''],
      estancia_nombre_proyecto: ['', [Validators.required]],
      estancia_tipo_nombre: ['', [Validators.required]],
      estancia_logros: [''],
      estancia_fecha_inicio: ['', [Validators.required]],
      estancia_fecha_fin: [''],
      estancia_institucion_receptora: ['', [Validators.required]],
      estancia_documento: [null],

      // 9. DOCENCIA Y EVENTOS
      curso_nombre: ['', [Validators.required]],
      curso_programa: ['', [Validators.required]],
      curso_horas_totales: [5, [Validators.required, Validators.min(0)]],
      curso_fecha_inicio: ['', [Validators.required]],
      curso_fecha_fin: [''],
      curso_institucion: ['', [Validators.required]],
      curso_nivel_escolaridad: ['', [Validators.required]],
      curso_producto_principal: [false],
      // 9. CONGRESOS (se manejan con congresosList, estos campos son auxiliares)
      congreso_nombre_evento: [''],
      congreso_titulo_trabajo: [''],
      congreso_tipo_part_nombre: [''],
      congreso_fecha: [''],
      congreso_pais_sede: [''],

      // 10. DIVULGACIÓN (todos opcionales)
      divulg_titulo: [''],
      divulg_tipo_div_nombre: [''],
      divulg_medio_nombre: [''],
      divulg_dirigido_a: [''], divulg_prod_obtenido_nombre: [''],
      divulg_fecha: [''],
      divulg_institucion_organizadora: [''],
      divulg_evidencia_link: [''],
      divulg_archivo: [null],

      // 11. PRODUCCIÓN CIENTÍFICA (Aportaciones)
      art_id_externo: [''], art_eje: [''], art_tipo: [''], art_producto_principal: [false],
      art_anio: [null, [Validators.min(1800)]],
      art_issn: [''], art_issn_electronico: [''], art_doi: [''],
      art_nombre_revista: ['', [Validators.required]],
      art_titulo: ['', [Validators.required]],
      art_rol_part_nombre: ['', [Validators.required]],
      art_estado_nombre: ['Publicado', [Validators.required]],
      art_objetivo_nombre: [''], art_recibio_apoyo_SECIHTI: [false], art_fondo_prog_nombre: [''],
      art_total_citas: [0],

      // 12. AUTORÍA (se maneja con autoresList, estos campos ya no se usan directamente)
      art_autor_nombre_completo: [''],
      art_autor_orcid: [''], art_autor_orden: [1],

      // 13. LOGROS
      logro_tipo: [''], 
      logro_nombre: ['', [Validators.required]],
      logro_anio: [null, [Validators.required]],

      // 14. DOCUMENTOS Y ARCHIVOS
      doc_nombre_archivo: [''],
      rfcNum: ['', [Validators.required]],
      cvFile: [null], fiscalPdf: [null], domicilio: [null], cert1: [null, [requiredFile()]], cert2: [null]
    });
  }

  // --- VALIDACIÓN VISUAL ---
  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  /**
   * Resalta los campos faltantes y hace focus en el primero
   */
  private resaltarYEnfocarCamposFaltantes(): void {
    const camposInvalidos: { campo: string; nombre: string; seccion: View }[] = [];
    
    // Mapeo completo de campos a sus nombres legibles y secciones
    const mapeoCampos: { [key: string]: { nombre: string; seccion: View } } = {
      // Persona principal
      'pers_nombre': { nombre: 'Nombre(s)', seccion: 'personaPrincipal' },
      'pers_primer_apellido': { nombre: 'Primer apellido', seccion: 'personaPrincipal' },
      'pers_curp': { nombre: 'CURP', seccion: 'personaPrincipal' },
      'pers_rfc': { nombre: 'RFC', seccion: 'personaPrincipal' },
      'pers_fecha_nacimiento': { nombre: 'Fecha de nacimiento', seccion: 'personaPrincipal' },
      'pers_semblanza': { nombre: 'Resumen de trayectoria (Semblanza)', seccion: 'personaPrincipal' },
      'pers_sexo_nombre': { nombre: 'Sexo', seccion: 'personaPrincipal' },
      'pers_estado_civil_nombre': { nombre: 'Estado civil', seccion: 'personaPrincipal' },
      'pers_nacionalidad_nombre': { nombre: 'Nacionalidad', seccion: 'personaPrincipal' },
      'pers_entidad_nombre': { nombre: 'Entidad federativa', seccion: 'personaPrincipal' },
      'pers_municipio_nombre': { nombre: 'Municipio de nacimiento', seccion: 'personaPrincipal' },
      'rfcNum': { nombre: 'RFC (Número)', seccion: 'personaPrincipal' },

      // Padrón institucional
      'telefono': { nombre: 'Teléfono', seccion: 'padronInstitucional' },
      'tipoIdentificacionOficial': { nombre: 'Tipo de identificación oficial', seccion: 'padronInstitucional' },
      'identificacionOficial': { nombre: 'Folio de identificación oficial', seccion: 'padronInstitucional' },
      'calle': { nombre: 'Calle', seccion: 'padronInstitucional' },
      'numeroExterior': { nombre: 'Número exterior', seccion: 'padronInstitucional' },
      'colonia': { nombre: 'Colonia', seccion: 'padronInstitucional' },
      'localidad': { nombre: 'Localidad', seccion: 'padronInstitucional' },
      'municipioDomicilio': { nombre: 'Municipio', seccion: 'padronInstitucional' },
      'codigoPostal': { nombre: 'Código postal', seccion: 'padronInstitucional' },
      
      // Institución
      'inst_clave_oficial': { nombre: 'Clave oficial de la institución', seccion: 'institucion' },
      'inst_nombre': { nombre: 'Nombre de la institución', seccion: 'institucion' },
      'inst_tipo_id': { nombre: 'Tipo de institución', seccion: 'institucion' },
      'inst_pais_nombre': { nombre: 'País de la institución', seccion: 'institucion' },
      'inst_entidad_nombre': { nombre: 'Estado o Entidad federativa', seccion: 'institucion' },
      'inst_municipio_nombre': { nombre: 'Municipio de la institución', seccion: 'institucion' },
      'inst_estado_usa': { nombre: 'Estado (Estados Unidos)', seccion: 'institucion' },
      
      // Área de conocimiento
      'area_nombre': { nombre: 'Área de conocimiento', seccion: 'area-conocimiento' },
      'area_clave': { nombre: 'Clave del área', seccion: 'area-conocimiento' },
      'area_version': { nombre: 'Año del catálogo', seccion: 'area-conocimiento' },
      
      // Trayectoria académica
      'acad_nivel_nombre': { nombre: 'Nivel académico', seccion: 'trayectoria-academica' },
      'acad_estatus_nombre': { nombre: 'Estatus académico', seccion: 'trayectoria-academica' },
      'acad_titulo': { nombre: 'Título obtenido', seccion: 'trayectoria-academica' },
      'acad_institucion': { nombre: 'Institución de egreso', seccion: 'trayectoria-academica' },
      'acad_cedula_profesional': { nombre: 'Cédula profesional', seccion: 'trayectoria-academica' },
      'acad_constancia_snii': { nombre: 'Constancia SNII', seccion: 'trayectoria-academica' },
      'cert1': { nombre: 'Documento probatorio de titulación', seccion: 'trayectoria-academica' },
      
      // Trayectoria profesional
      'tray_prof_nombramiento': { nombre: 'Puesto o nombramiento', seccion: 'trayectoria-profesional' },
      'tray_prof_institucion': { nombre: 'Institución o empresa', seccion: 'trayectoria-profesional' },
      'tray_prof_fecha_inicio': { nombre: 'Fecha de inicio', seccion: 'trayectoria-profesional' },
      
      // Cursos
      'curso_nombre': { nombre: 'Nombre del curso', seccion: 'cursos' },
      'curso_programa': { nombre: 'Nombre del programa académico', seccion: 'cursos' },
      'curso_horas_totales': { nombre: 'Horas totales', seccion: 'cursos' },
      'curso_fecha_inicio': { nombre: 'Fecha de inicio del curso', seccion: 'cursos' },
      'curso_institucion': { nombre: 'Institución donde se impartió', seccion: 'cursos' },
      'curso_nivel_escolaridad': { nombre: 'Nivel de escolaridad del curso', seccion: 'cursos' },
      
      // Idiomas
      'idioma_nombre': { nombre: 'Idioma', seccion: 'idiomas' },
      'idioma_dominio_nombre': { nombre: 'Dominio global del idioma', seccion: 'idiomas' },
      'idioma_cert_institucion': { nombre: 'Institución evaluadora', seccion: 'idiomas' },
      'idioma_cert_puntuacion': { nombre: 'Puntuación / Score', seccion: 'idiomas' },
      'idioma_cert_documento': { nombre: 'Documento probatorio de certificación', seccion: 'idiomas' },
      
      // Estancias
      'estancia_nombre_proyecto': { nombre: 'Nombre del proyecto o estancia', seccion: 'estancias' },
      'estancia_fecha_inicio': { nombre: 'Fecha de inicio', seccion: 'estancias' },
      'estancia_tipo_nombre': { nombre: 'Tipo de estancia', seccion: 'estancias' },
      'estancia_institucion_receptora': { nombre: 'Institución receptora', seccion: 'estancias' },
      'estancia_documento': { nombre: 'Documento probatorio de estancia', seccion: 'estancias' },
      
      // Artículos (Aportaciones)
      'art_titulo': { nombre: 'Título del artículo', seccion: 'aportaciones' },
      'art_anio': { nombre: 'Año de publicación', seccion: 'aportaciones' },
      'art_nombre_revista': { nombre: 'Revista científica', seccion: 'aportaciones' },
      'art_rol_part_nombre': { nombre: 'Tu rol en el artículo', seccion: 'aportaciones' },
      'art_estado_nombre': { nombre: 'Estado de la obra', seccion: 'aportaciones' },
      'art_autor_nombre_completo': { nombre: 'Nombre completo del autor', seccion: 'aportaciones' },
      'art_fondo_prog_nombre': { nombre: 'Fondo / Programa', seccion: 'aportaciones' },
      
      // Congresos
      'congreso_nombre_evento': { nombre: 'Nombre del congreso / simposio', seccion: 'congresos' },
      'congreso_fecha': { nombre: 'Fecha del evento', seccion: 'congresos' },
      'congreso_pais_sede': { nombre: 'País sede', seccion: 'congresos' },
      'congreso_tipo_part_nombre': { nombre: 'Tipo de participación', seccion: 'congresos' },
      
      // Divulgación
      'divulg_titulo': { nombre: 'Título del trabajo', seccion: 'divulgacion' },
      'divulg_tipo_div_nombre': { nombre: 'Tipo de divulgación', seccion: 'divulgacion' },
      'divulg_medio_nombre': { nombre: 'Medio de comunicación', seccion: 'divulgacion' },
      'divulg_fecha': { nombre: 'Fecha de realización', seccion: 'divulgacion' },
      'divulg_evidencia_link': { nombre: 'Link de evidencia', seccion: 'divulgacion' },
      'divulg_archivo': { nombre: 'Documento probatorio', seccion: 'divulgacion' },
      
      // Logros
      'logro_nombre': { nombre: 'Nombre del logro', seccion: 'logros' },
      'logro_anio': { nombre: 'Año de obtención', seccion: 'logros' }
    };

    // Recorrer todos los controles del formulario para encontrar campos inválidos
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      if (control && control.invalid) {
        // Priorizar campos con error de requerido (texto o archivo)
        if (control.hasError('required') || control.hasError('requiredFile')) {
          const info = mapeoCampos[key];
          if (info) {
            // Verificar validaciones condicionales
            // idioma_cert_institucion y idioma_cert_puntuacion solo son requeridos si idioma_es_certificado es true
            if ((key === 'idioma_cert_institucion' || key === 'idioma_cert_puntuacion' || key === 'idioma_cert_documento')) {
              const esCertificado = this.form.get('idioma_es_certificado')?.value;
              const dominioNombre = this.form.get('idioma_dominio_nombre')?.value;
              const esExcelente = dominioNombre === 'Excelente';
              // Para Excelente: el documento probatorio es obligatorio.
              // Para Avanzado: institución y puntuación son obligatorios solo si se activa certificación.
              const requeridoEnExcelente = esExcelente && key === 'idioma_cert_documento';
              const requeridoEnCertificacion = esCertificado && (dominioNombre === 'Avanzado' || esExcelente) && key !== 'idioma_cert_documento';
              if (requeridoEnExcelente || requeridoEnCertificacion) {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // art_fondo_prog_nombre solo es requerido si art_recibio_apoyo_SECIHTI es true
            else if (key === 'art_fondo_prog_nombre') {
              const recibioApoyo = this.form.get('art_recibio_apoyo_SECIHTI')?.value;
              if (recibioApoyo) {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // divulg_archivo solo es requerido si hay un producto obtenido
            else if (key === 'divulg_archivo') {
              const prodObtenido = this.form.get('divulg_prod_obtenido_nombre')?.value;
              if (prodObtenido && prodObtenido !== '' && !this.esProductoConEvidenciaLink(String(prodObtenido))) {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // divulg_evidencia_link solo es requerido para Video/Grabación y Entrevista publicada
            else if (key === 'divulg_evidencia_link') {
              const prodObtenido = this.form.get('divulg_prod_obtenido_nombre')?.value;
              if (prodObtenido && this.esProductoConEvidenciaLink(String(prodObtenido))) {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // acad_constancia_snii solo es requerido si acad_es_perfil_snii es true
            else if (key === 'acad_constancia_snii') {
              const esPerfilSnii = !!this.form.get('acad_es_perfil_snii')?.value;
              if (esPerfilSnii) {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // inst_entidad_nombre solo es requerido si inst_pais_nombre es 'México'
            else if (key === 'inst_entidad_nombre') {
              const paisNombre = this.form.get('inst_pais_nombre')?.value;
              if (paisNombre === 'México') {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // inst_municipio_nombre solo es requerido si inst_pais_nombre es 'México' y ya hay estado seleccionado
            else if (key === 'inst_municipio_nombre') {
              const paisNombre = this.form.get('inst_pais_nombre')?.value;
              const entidad = (this.form.get('inst_entidad_nombre')?.value || '').toString().trim();
              if (paisNombre === 'México' && entidad) {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // inst_estado_usa solo es requerido si inst_pais_nombre es 'Estados Unidos'
            else if (key === 'inst_estado_usa') {
              const paisNombre = this.form.get('inst_pais_nombre')?.value;
              if (paisNombre === 'Estados Unidos') {
                camposInvalidos.push({
                  campo: key,
                  nombre: info.nombre,
                  seccion: info.seccion
                });
              }
            }
            // Para todos los demás campos, agregarlos directamente
            else {
              camposInvalidos.push({
                campo: key,
                nombre: info.nombre,
                seccion: info.seccion
              });
            }
          }
        }
      }
    });

    // Si no hay campos requeridos faltantes, buscar otros tipos de errores
    if (camposInvalidos.length === 0) {
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        if (control && control.invalid) {
          const info = mapeoCampos[key];
          if (info && !camposInvalidos.find(c => c.campo === key)) {
            camposInvalidos.push({
              campo: key,
              nombre: info.nombre,
              seccion: info.seccion
            });
          }
        }
      });
    }

    if (camposInvalidos.length > 0) {
      // Ordenar por sección para agrupar
      const seccionesOrden: { [key: string]: number } = {
        'personaPrincipal': 1,
        'institucion': 2,
        'area-conocimiento': 3,
        'trayectoria-academica': 4,
        'trayectoria-profesional': 5,
        'idiomas': 6,
        'cursos': 7,
        'estancias': 8,
        'aportaciones': 9,
        'congresos': 10,
        'divulgacion': 11,
        'logros': 12
      };

      camposInvalidos.sort((a, b) => {
        const ordenA = seccionesOrden[a.seccion] || 999;
        const ordenB = seccionesOrden[b.seccion] || 999;
        return ordenA - ordenB;
      });

      const primerCampo = camposInvalidos[0];
      
      // Función auxiliar para encontrar un elemento en el DOM
      const encontrarElemento = (campo: string, seccion?: View): HTMLElement | null => {
        // Mapeo especial para campos de archivo que pueden tener nombres diferentes en el HTML
        const campoMapeo: { [key: string]: string[] } = {
          'divulg_archivo': ['divulg_archivo', 'divulgArchivo'],
          'acad_constancia_snii': ['acad_constancia_snii'],
          'idioma_cert_documento': ['idioma_cert_documento'],
          'estancia_documento': ['estancia_documento'],
          'cert1': ['cert1'],
          'cert2': ['cert2'],
          'cvFile': ['cvFile'],
          'fiscalPdf': ['fiscalPdf'],
          'domicilio': ['domicilio']
        };
        
        const nombresBuscar = campoMapeo[campo] || [campo];
        
        // Si se proporciona una sección, buscar primero en esa sección
        if (seccion) {
          const seccionElement = document.querySelector(`section[ng-reflect-ng-switch-case="${seccion}"]`) ||
                                 document.querySelector(`section[ng-reflect-ng-switch-case="'${seccion}'"]`);
          if (seccionElement) {
            for (const nombreBuscar of nombresBuscar) {
              // Estrategia 1: Buscar por formControlName dentro de la sección
              let elemento = seccionElement.querySelector(`[formControlName="${nombreBuscar}"]`) as HTMLElement;
              if (elemento) return elemento;
              
              // Estrategia 2: Buscar por ID dentro de la sección
              elemento = seccionElement.querySelector(`#${nombreBuscar}`) as HTMLElement;
              if (elemento) return elemento;
              
              // Estrategia 3: Buscar por ID con sufijo _inicio
              elemento = seccionElement.querySelector(`#${nombreBuscar}_inicio`) as HTMLElement;
              if (elemento) return elemento;
              
              // Estrategia 4: Buscar input[type="file"] con name o id
              elemento = seccionElement.querySelector(`input[type="file"][name="${nombreBuscar}"], input[type="file"][id="${nombreBuscar}"]`) as HTMLElement;
              if (elemento) return elemento;
            }
          }
        }
        
        // Búsqueda global si no se encontró en la sección específica
        for (const nombreBuscar of nombresBuscar) {
          // Estrategia 1: Buscar por formControlName
          let elemento = document.querySelector(`[formControlName="${nombreBuscar}"]`) as HTMLElement;
          if (elemento) return elemento;
          
          // Estrategia 2: Buscar por ID exacto
          elemento = document.getElementById(nombreBuscar) as HTMLElement;
          if (elemento) return elemento;
          
          // Estrategia 3: Buscar por ID sin prefijos comunes
          const idSinPrefijo = nombreBuscar
            .replace(/^(pers_|inst_|area_|acad_|tray_prof_|curso_|idioma_|estancia_|art_|congreso_|divulg_|logro_)/, '')
            .replace(/_/g, '-');
          elemento = document.getElementById(idSinPrefijo) as HTMLElement;
          if (elemento) return elemento;
          
          // Estrategia 4: Buscar por ID con sufijo _inicio (para campos duplicados)
          elemento = document.getElementById(`${nombreBuscar}_inicio`) as HTMLElement;
          if (elemento) return elemento;
          
          // Estrategia 5: Buscar input[type="file"] con name o id
          elemento = document.querySelector(`input[type="file"][name="${nombreBuscar}"], input[type="file"][id="${nombreBuscar}"]`) as HTMLElement;
          if (elemento) return elemento;
        }
        
        // Estrategia 6: Buscar en la sección activa actual
        const seccionActual = this.view();
        const seccionElement = document.querySelector(`section[ng-reflect-ng-switch-case="${seccionActual}"]`) ||
                               document.querySelector(`section[ng-reflect-ng-switch-case="'${seccionActual}'"]`);
        if (seccionElement) {
          for (const nombreBuscar of nombresBuscar) {
            let elemento = seccionElement.querySelector(`[formControlName="${nombreBuscar}"]`) as HTMLElement;
            if (elemento) return elemento;
          }
        }
        
        return null;
      };

      // Navegar a la sección del primer campo inválido PRIMERO
      this.setView(primerCampo.seccion);
      
      // Esperar a que Angular renderice la nueva vista antes de buscar elementos
      setTimeout(() => {
        // Resaltar todos los campos inválidos
        camposInvalidos.forEach((campoInfo, index) => {
          setTimeout(() => {
            const elemento = encontrarElemento(campoInfo.campo, campoInfo.seccion);
            if (elemento) {
              // Agregar clase de resaltado temporal
              elemento.classList.add('campo-faltante-resaltado');
              // También agregar clase is-invalid si es un input/select/textarea
              if (elemento.tagName === 'INPUT' || elemento.tagName === 'SELECT' || elemento.tagName === 'TEXTAREA') {
                elemento.classList.add('is-invalid');
              }
              // Remover después de 4 segundos
              setTimeout(() => {
                elemento.classList.remove('campo-faltante-resaltado');
              }, 4000);
            }
          }, 150 * (index + 1));
        });

        // Hacer scroll y focus en el primer campo después de un delay adicional
        setTimeout(() => {
          const primerElemento = encontrarElemento(primerCampo.campo, primerCampo.seccion);
          if (primerElemento) {
            // Scroll suave al elemento
            primerElemento.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            // Delay antes del focus para asegurar que el scroll termine
            setTimeout(() => {
              if (primerElemento instanceof HTMLInputElement || 
                  primerElemento instanceof HTMLSelectElement || 
                  primerElemento instanceof HTMLTextAreaElement) {
                primerElemento.focus();
                // Si es un select, intentar abrirlo (solo funciona en algunos navegadores)
                if (primerElemento instanceof HTMLSelectElement) {
                  // Forzar el focus y hacer click para abrir el dropdown
                  primerElemento.click();
                }
              }
            }, 600);
          } else {
            // Si no se encuentra el elemento, hacer scroll al inicio de la sección
            const seccionElement = document.querySelector(`section[ng-reflect-ng-switch-case="${primerCampo.seccion}"]`) ||
                                   document.querySelector(`section[ng-reflect-ng-switch-case="'${primerCampo.seccion}'"]`);
            if (seccionElement) {
              seccionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }
        }, 300);
      }, 200); // Esperar 200ms para que Angular renderice la nueva vista

      // Agrupar campos por sección para el mensaje
      const camposPorSeccion: { [key: string]: string[] } = {};
      camposInvalidos.forEach(campo => {
        if (!camposPorSeccion[campo.seccion]) {
          camposPorSeccion[campo.seccion] = [];
        }
        camposPorSeccion[campo.seccion].push(campo.nombre);
      });

      // Construir mensaje agrupado por sección
      const nombresSecciones: { [key: string]: string } = {
        'personaPrincipal': 'Datos personales',
        'padronInstitucional': 'Padrón institucional',
        'institucion': 'Institución',
        'area-conocimiento': 'Área de conocimiento',
        'trayectoria-academica': 'Trayectoria académica',
        'trayectoria-profesional': 'Trayectoria profesional',
        'idiomas': 'Idiomas',
        'cursos': 'Cursos impartidos',
        'estancias': 'Estancias de investigación',
        'aportaciones': 'Aportaciones científicas',
        'congresos': 'Congresos y eventos',
        'divulgacion': 'Divulgación científica',
        'logros': 'Logros y reconocimientos'
      };

      let mensajeHtml = '';
      const primeraSeccion = nombresSecciones[primerCampo.seccion] || primerCampo.seccion;
      
      // Mensaje destacado sobre la navegación
      mensajeHtml += `<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-bottom: 15px; border-radius: 4px;">`;
      mensajeHtml += `<strong>📍 Te hemos llevado a la sección: "${primeraSeccion}"</strong><br>`;
      mensajeHtml += `<small>Revisa los campos marcados en rojo y completa la información faltante.</small>`;
      mensajeHtml += `</div>`;
      
      // Lista de campos faltantes agrupados por sección
      Object.keys(camposPorSeccion).forEach(seccion => {
        const nombreSeccion = nombresSecciones[seccion] || seccion;
        const esPrimeraSeccion = seccion === primerCampo.seccion;
        mensajeHtml += `<div style="${esPrimeraSeccion ? 'background-color: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 10px;' : 'margin-bottom: 10px;'}">`;
        mensajeHtml += `<strong style="color: ${esPrimeraSeccion ? '#800020' : '#333'};">
          ${esPrimeraSeccion ? '👉 ' : ''}${nombreSeccion}:
        </strong><br>`;
        camposPorSeccion[seccion].forEach(nombre => {
          mensajeHtml += `• ${nombre}<br>`;
        });
        mensajeHtml += `</div>`;
      });

      const totalCampos = camposInvalidos.length;
      const titulo = totalCampos === 1 
        ? 'Falta completar 1 campo obligatorio'
        : `Faltan completar ${totalCampos} campos obligatorios`;

      const elementoActivo = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      elementoActivo?.blur();

      Swal.fire({
        icon: 'warning',
        title: titulo,
        html: `<div style="text-align: left; max-height: 400px; overflow-y: auto; padding: 5px;">${mensajeHtml}</div>`,
        confirmButtonColor: '#800020',
        confirmButtonText: 'Entendido',
        width: '700px',
        customClass: {
          popup: 'swal-popup-custom'
        },
        willClose: () => {
          setTimeout(() => {
            const primerElemento = encontrarElemento(primerCampo.campo, primerCampo.seccion);
            if (primerElemento) {
              primerElemento.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
              setTimeout(() => {
                if (primerElemento instanceof HTMLInputElement || 
                    primerElemento instanceof HTMLSelectElement || 
                    primerElemento instanceof HTMLTextAreaElement) {
                  primerElemento.focus();
                }
              }, 300);
            }
          }, 100);
        }
      });
    } else {
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor, complete todos los campos obligatorios',
        confirmButtonColor: '#800020'
      });
    }
  }

  async setView(v: View): Promise<void> {
    if (this.savingSection() || this.view() === v) {
      return;
    }

    const vistaActual = this.view();
    const puedeContinuar = await this.guardarSeccionActualAntesDeNavegar(vistaActual, v);
    if (!puedeContinuar) {
      return;
    }

    this.asegurarFechasCorrectas(v);
    this.view.set(v);

    requestAnimationFrame(() => {
      const sectionContainer = document.querySelector('.section-container');
      if (sectionContainer) {
        sectionContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const mainContent = document.querySelector('.content') || document.querySelector('main');
      if (mainContent) {
        mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  notificarInstitucionNoRegistrada(): void {
    const nombrePrefill = (this.form.get('inst_nombre')?.value || '').toString().trim();
    const cctPrefill = (this.form.get('inst_clave_oficial')?.value || '').toString().trim();
    const entidadPrefill = (this.form.get('inst_entidad_nombre')?.value || this.form.get('pers_entidad_nombre')?.value || '').toString().trim();
    const municipioPrefill = (this.form.get('inst_municipio_nombre')?.value || '').toString().trim();

    Swal.fire({
      title: 'Notificar institución no registrada',
      html: `
        <div class="siimex-inst-modal text-start">
          <div class="siimex-inst-banner">
            <i class="fas fa-university"></i>
            <div>
              <strong>Solicitud de alta de institución</strong>
              <div class="small text-muted">La solicitud se enviará al equipo administrador para validación.</div>
            </div>
          </div>

          <label class="form-label small fw-semibold mb-1">Tipo de institución <span class="text-danger">*</span></label>
          <select id="swal-inst-tipo" class="swal2-input mt-0 mb-2">
            <option value="EDUCATIVA" selected>Educativa</option>
            <option value="OTRA">No educativa</option>
          </select>

          <label class="form-label small fw-semibold mb-1">Nombre de la institución <span class="text-danger">*</span></label>
          <input id="swal-inst-nombre" type="text" class="swal2-input mt-0 mb-2" maxlength="220" value="${this.escapeHtml(nombrePrefill)}" />

          <div id="swal-inst-cct-wrap">
            <label class="form-label small fw-semibold mb-1">CCT <span class="text-danger">*</span></label>
            <input id="swal-inst-cct" type="text" class="swal2-input mt-0 mb-1" maxlength="25" value="${this.escapeHtml(cctPrefill)}" />
            <div class="small text-muted mb-2">El CCT es obligatorio para instituciones educativas.</div>
          </div>

          <label class="form-label small fw-semibold mb-1">Municipio <span class="text-danger">*</span></label>
          <input id="swal-inst-municipio" type="text" class="swal2-input mt-0 mb-2" maxlength="120" value="${this.escapeHtml(municipioPrefill)}" />

          <label class="form-label small fw-semibold mb-1">Entidad federativa <span class="text-danger">*</span></label>
          <input id="swal-inst-entidad" type="text" class="swal2-input mt-0 mb-2" maxlength="120" value="${this.escapeHtml(entidadPrefill)}" />

          <label class="form-label small fw-semibold mb-1">Nivel educativo (opcional)</label>
          <input id="swal-inst-nivel" type="text" class="swal2-input mt-0" maxlength="120" placeholder="Ej. Licenciatura, Posgrado" />
        </div>
      `,
      customClass: {
        popup: 'swal-popup-custom swal-inst-popup'
      },
      showCancelButton: true,
      confirmButtonText: 'Enviar solicitud',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      didOpen: () => {
        this.actualizarVistaTipoInstitucionEnModal();
        const selectTipo = document.getElementById('swal-inst-tipo') as HTMLSelectElement | null;
        if (selectTipo) {
          selectTipo.addEventListener('change', () => this.actualizarVistaTipoInstitucionEnModal());
        }
      },
      preConfirm: () => {
        const tipoInstitucion = ((document.getElementById('swal-inst-tipo') as HTMLSelectElement | null)?.value || 'EDUCATIVA').trim();
        const nombre = (document.getElementById('swal-inst-nombre') as HTMLInputElement | null)?.value?.trim();
        const cct = (document.getElementById('swal-inst-cct') as HTMLInputElement | null)?.value?.trim();
        const municipio = (document.getElementById('swal-inst-municipio') as HTMLInputElement | null)?.value?.trim();
        const entidadFederativa = (document.getElementById('swal-inst-entidad') as HTMLInputElement | null)?.value?.trim();
        const nivelEducativo = (document.getElementById('swal-inst-nivel') as HTMLInputElement | null)?.value?.trim();

        const esEducativa = tipoInstitucion === 'EDUCATIVA';
        if (!nombre) {
          Swal.showValidationMessage('El nombre de la institución es obligatorio');
          return false;
        }
        if (esEducativa && !cct) {
          Swal.showValidationMessage('El CCT es obligatorio cuando el tipo de institución es educativa');
          return false;
        }
        if (!municipio) {
          Swal.showValidationMessage('El municipio es obligatorio');
          return false;
        }
        if (!entidadFederativa) {
          Swal.showValidationMessage('La entidad federativa es obligatoria');
          return false;
        }
        return {
          tipoInstitucion,
          nombre,
          cct: esEducativa ? (cct || null) : null,
          municipio,
          entidadFederativa,
          nivelEducativo: nivelEducativo || null,
          estado: 'PENDIENTE_VALIDACION'
        };
      }
    }).then((result) => {
      if (!result.isConfirmed || !result.value) return;
      const payload = result.value;
      this.http.post<any>(`${environment.apiBaseUrl}/instituciones-educativas/notificar-falta`, payload).subscribe({
        next: (response) => {
          const inst = response?.institucion || {};
          const nombre = (inst?.nombre || payload?.nombre || '').toString().trim();
          const cct = (inst?.cct || payload?.cct || '').toString().trim();
          const entidad = (inst?.entidadFederativa || payload?.entidadFederativa || '').toString().trim();
          const municipio = (inst?.municipio || payload?.municipio || '').toString().trim();
          const nivel = (inst?.nivelEducativo || payload?.nivelEducativo || '').toString().trim();

          const patch: Record<string, string> = {};
          if (nombre) patch['inst_nombre'] = nombre;
          if (cct) patch['inst_clave_oficial'] = cct;
          if (entidad) patch['inst_entidad_nombre'] = entidad;
          if (municipio) patch['inst_municipio_nombre'] = municipio;
          if (nivel && !(this.form.get('inst_nivel_uno_nombre')?.value || '').toString().trim()) {
            patch['inst_nivel_uno_nombre'] = nivel;
          }
          if (!(this.form.get('inst_pais_nombre')?.value || '').toString().trim()) {
            patch['inst_pais_nombre'] = 'México';
          }
          if (!(this.form.get('inst_tipo_id')?.value || '').toString().trim()) {
            patch['inst_tipo_id'] = 'NAC';
          }
          this.form.patchValue(patch);
          this.saveDraft();

          Swal.fire({
            icon: 'success',
            title: 'Solicitud enviada',
            text: 'Tu solicitud fue enviada para validación y los datos se precargaron en este formulario.',
            confirmButtonColor: '#800020'
          });
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'No se pudo enviar',
            text: err?.error?.message || 'Ocurrió un error al notificar la institución.',
            confirmButtonColor: '#800020'
          });
        }
      });
    });
  }

  /**
   * Asegura que los campos de fecha de cada sección estén correctamente inicializados
   * y no tengan valores compartidos incorrectamente
   */
  private asegurarFechasCorrectas(seccionActual: View): void {
    // Mapeo de secciones a sus campos de fecha correctos
    const camposPorSeccion: { [key: string]: string[] } = {
      'cursos': ['curso_fecha_inicio', 'curso_fecha_fin'],
      'estancias': ['estancia_fecha_inicio', 'estancia_fecha_fin'],
      'trayectoria-profesional': ['tray_prof_fecha_inicio', 'tray_prof_fecha_fin'],
      'congresos': ['congreso_fecha'],
      'divulgacion': ['divulg_fecha']
    };

    const camposCorrectos = camposPorSeccion[seccionActual];
    if (camposCorrectos) {
      // Verificar que los campos correctos tengan valores válidos
      // y que no haya valores compartidos incorrectamente
      camposCorrectos.forEach(campo => {
        const control = this.form.get(campo);
        if (control) {
          const valor = control.value;
          // Si el valor es una fecha pero no corresponde al formato esperado, limpiarlo
          if (valor && typeof valor === 'string' && valor.length > 0) {
            // Validar que sea una fecha válida en formato YYYY-MM-DD
            const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!fechaRegex.test(valor)) {
              control.setValue('', { emitEvent: false });
            }
          }
        }
      });
    }
  }

  private escapeHtml(value: string): string {
    return (value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private generarCatalogoYears(): number[] {
    const actual = new Date().getFullYear();
    const min = 1990;
    const years: number[] = [];
    for (let y = actual; y >= min; y--) {
      years.push(y);
    }
    return years;
  }

  /**
   * Métodos para manejar la selección y arrastre del archivo JSON
   */
  triggerFileInput(): void {
    const input = document.getElementById('migracion_json') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  onFileSelectedJson(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        this.jsonFileName = file.name;
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Archivo inválido',
          text: 'Por favor, selecciona un archivo JSON válido',
          confirmButtonColor: '#800020'
        });
        input.value = '';
        this.jsonFileName = null;
      }
    }
  }

  onDragOverJson(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingJson = true;
  }

  onDragLeaveJson(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingJson = false;
  }

  onDropJson(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingJson = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        this.jsonFileName = file.name;
        // Asignar el archivo al input
        const input = document.getElementById('migracion_json') as HTMLInputElement;
        if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
        }
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Archivo inválido',
          text: 'Por favor, arrastra un archivo JSON válido',
          confirmButtonColor: '#800020'
        });
      }
    }
  }

  clearJsonFile(event: Event): void {
    event.stopPropagation();
    const input = document.getElementById('migracion_json') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
    this.jsonFileName = null;
  }

  /**
   * Procesa la migración de forma independiente (separada del formulario principal)
   * Lee el archivo JSON y carga automáticamente los datos en el formulario
   */
  procesarMigracion(): void {
    const migracionJsonInput = document.getElementById('migracion_json') as HTMLInputElement;
    const migracionJsonFile = migracionJsonInput?.files?.[0];
    
    if (!migracionJsonFile) {
      Swal.fire({
        icon: 'warning',
        title: 'Archivo requerido',
        text: 'Por favor, selecciona el archivo JSON para la migración',
        confirmButtonColor: '#800020'
      });
      return;
    }

    this.processingMigration.set(true);
    this.actualizarProgresoMigracion(12, 'Leyendo archivo JSON', 'Estamos abriendo el archivo para recuperar tu información histórica.');

    // Leer el archivo JSON
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }
      const porcentajeLectura = Math.round((event.loaded / event.total) * 44);
      this.actualizarProgresoMigracion(18 + porcentajeLectura, 'Leyendo archivo JSON', 'Estamos cargando el contenido del archivo para preparar la importación.');
    };
    reader.onload = (e) => {
      try {
        this.actualizarProgresoMigracion(72, 'Validando estructura', 'Revisando el contenido del JSON antes de importar los datos.');
        const jsonContent = e.target?.result as string;
        const jsonData = JSON.parse(jsonContent);
        
        // Mapear los datos del JSON al formulario
        this.actualizarProgresoMigracion(84, 'Mapeando información', 'Convirtiendo los datos del archivo al formato del formulario SIIMEX.');
        const datosMapeados = this.mapearDatosJSON(jsonData);
        
        // Cargar los datos en el formulario
        this.actualizarProgresoMigracion(94, 'Aplicando datos al formulario', 'Insertando la información recuperada en cada sección del registro.');
        this.form.patchValue(datosMapeados);
        this.importarGradosAcademicosDesdePerfil(jsonData);
        this.importarCursosImpartidosDesdePerfil(jsonData);
        this.importarIdiomasDesdePerfil(jsonData);
        this.importarEstanciasDesdePerfil(jsonData);
        this.importarDivulgacionesDesdePerfil(jsonData);
        this.importarLogrosDesdePerfil(jsonData);
        this.actualizarValidacionesCondicionales();
        
        // Sincronizar RFC con el campo técnico rfcNum
        if (datosMapeados['pers_rfc']) {
          this.form.get('rfcNum')?.setValue(datosMapeados['pers_rfc'], { emitEvent: false });
        }
        
        // Guardar el borrador automáticamente
        this.saveDraft();
        
        // Actualizar UUID basado en los datos cargados
        this.actualizarUUID();
        
        // Contar campos cargados por sección
        const camposCargados = Object.keys(datosMapeados).filter(key => {
          const valor = datosMapeados[key];
          return valor !== null && valor !== undefined && valor !== '';
        }).length;
        
        // Contar secciones completadas
        const secciones = {
          'Datos personales': ['pers_nombre', 'pers_curp', 'pers_rfc'].some(k => datosMapeados[k]),
          'Institución': ['inst_nombre', 'inst_clave_oficial'].some(k => datosMapeados[k]),
          'Área de conocimiento': ['area_nombre', 'area_clave'].some(k => datosMapeados[k]),
          'Trayectoria académica': ['acad_nivel_nombre', 'acad_titulo'].some(k => datosMapeados[k]),
          'Trayectoria profesional': ['tray_prof_nombramiento'].some(k => datosMapeados[k]),
          'Idiomas': ['idioma_nombre'].some(k => datosMapeados[k]),
          'Estancias': ['estancia_nombre_proyecto'].some(k => datosMapeados[k]),
          'Cursos': ['curso_nombre'].some(k => datosMapeados[k]),
          'Artículos': ['art_titulo'].some(k => datosMapeados[k]),
          'Congresos': ['congreso_nombre_evento'].some(k => datosMapeados[k]),
          'Divulgación': ['divulg_titulo'].some(k => datosMapeados[k]),
          'Logros': ['logro_nombre'].some(k => datosMapeados[k])
        };
        
        const seccionesCompletadas = Object.values(secciones).filter(v => v).length;
        
        this.actualizarProgresoMigracion(100, 'Migración completada', 'La información del archivo ya fue incorporada al formulario.');
        this.finalizarProgresoMigracion();

        Swal.fire({
          icon: 'success',
          title: '¡Datos cargados exitosamente!',
          html: `
            <p>Se han importado <strong>${camposCargados}</strong> campos del archivo JSON.</p>
            <p>Secciones con datos: <strong>${seccionesCompletadas} de ${Object.keys(secciones).length}</strong></p>
            <p class="mt-3">Los datos se han importado con éxito al SIIMEX. Puedes revisarlos y completar las secciones faltantes.</p>
          `,
          confirmButtonColor: '#800020',
          confirmButtonText: 'Continuar con el registro',
          width: '600px'
        }).then(() => {
          this.setView('personaPrincipal');
        });
        
      } catch (error) {
        this.finalizarProgresoMigracion();
        console.error('Error al procesar JSON:', error);
        this.jsonFileName = null;
        Swal.fire({
          icon: 'error',
          title: 'Error al leer el archivo',
          text: 'El archivo JSON no es válido o está corrupto. Por favor, verifica el formato del archivo.',
          confirmButtonColor: '#800020'
        });
      }
    };
    
    reader.onerror = () => {
      this.finalizarProgresoMigracion();
      this.jsonFileName = null;
      Swal.fire({
        icon: 'error',
        title: 'Error al leer el archivo',
        text: 'No se pudo leer el archivo JSON. Por favor, intente nuevamente.',
        confirmButtonColor: '#800020'
      });
    };
    
    reader.readAsText(migracionJsonFile);
  }

  /**
   * Mapea los datos del JSON a los campos del formulario
   * Basado en la estructura real del JSON de SECIHTI
   */
  private mapearDatosJSON(jsonData: any): { [key: string]: any } {
    const datosMapeados: { [key: string]: any } = {};
    
    // Función auxiliar para obtener valores anidados
    const getValue = (obj: any, path: string): any => {
      const keys = path.split('.');
      let value = obj;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return null;
        }
      }
      return value;
    };
    
    // Función auxiliar para obtener valor de objeto anidado (ej: sexo.nombre)
    const getNestedValue = (obj: any, path: string, subKey?: string): any => {
      const value = getValue(obj, path);
      if (value && typeof value === 'object' && subKey) {
        return value[subKey] || value.nombre || value.id || value;
      }
      return value;
    };
    
    // Función auxiliar para mapear valores con múltiples posibles rutas
    const mapField = (formField: string, ...jsonPaths: string[]): void => {
      for (const path of jsonPaths) {
        const value = getValue(jsonData, path);
        if (value !== null && value !== undefined && value !== '') {
          datosMapeados[formField] = value;
          return;
        }
      }
    };
    
    // Obtener el objeto principal del perfil
    const perfil = jsonData.perfil || jsonData;
    const principal = perfil.principal || perfil;
    
    // 1. DATOS PERSONALES (desde perfil.principal)
    if (principal.nombre) datosMapeados['pers_nombre'] = principal.nombre;
    if (principal.primerApellido) datosMapeados['pers_primer_apellido'] = principal.primerApellido;
    if (principal.segundoApellido) datosMapeados['pers_segundo_apellido'] = principal.segundoApellido;
    if (principal.curp) datosMapeados['pers_curp'] = principal.curp;
    if (principal.rfc) datosMapeados['pers_rfc'] = principal.rfc;
    if (principal.fechaNacimiento) datosMapeados['pers_fecha_nacimiento'] = principal.fechaNacimiento;
    
    // Mapear sexo (puede ser objeto con id y nombre, o string)
    if (principal.sexo) {
      const sexo = typeof principal.sexo === 'object' ? principal.sexo.nombre : principal.sexo;
      if (sexo) {
        // Convertir a formato del formulario
        const sexoMap: { [key: string]: string } = {
          'Masculino': 'Hombre',
          'MASCULINO': 'Hombre',
          'M': 'Hombre',
          'Femenino': 'Mujer',
          'FEMENINO': 'Mujer',
          'F': 'Mujer'
        };
        datosMapeados['pers_sexo_nombre'] = sexoMap[sexo] || sexo;
      }
    }
    
    // Mapear país de nacimiento
    if (principal.paisNacimiento) {
      const pais = typeof principal.paisNacimiento === 'object' ? principal.paisNacimiento.nombre : principal.paisNacimiento;
      if (pais) datosMapeados['pers_pais_nac_nombre'] = pais;
    }
    
    // Mapear entidad federativa
    if (principal.entidadFederativa) {
      const entidad = typeof principal.entidadFederativa === 'object' ? principal.entidadFederativa.nombre : principal.entidadFederativa;
      if (entidad) datosMapeados['pers_entidad_nombre'] = entidad;
    }
    
    // Mapear nacionalidad
    if (principal.nacionalidad) {
      const nacionalidad = typeof principal.nacionalidad === 'object' ? principal.nacionalidad.nombre : principal.nacionalidad;
      if (nacionalidad) datosMapeados['pers_nacionalidad_nombre'] = nacionalidad;
    }
    if (principal.municipio) {
      const municipio = typeof principal.municipio === 'object' ? principal.municipio.nombre : principal.municipio;
      if (municipio) datosMapeados['pers_municipio_nombre'] = municipio;
    }
    
    // Mapear estado civil
    if (principal.estadoCivil) {
      const estadoCivil = typeof principal.estadoCivil === 'object' ? principal.estadoCivil.nombre : principal.estadoCivil;
      if (estadoCivil) datosMapeados['pers_estado_civil_nombre'] = estadoCivil;
    }
    
    // ORCID y Scholar
    if (principal.orcId) datosMapeados['pers_orcid_url'] = principal.orcId;
    if (principal.linkedin && principal.linkedin.includes('scholar')) datosMapeados['pers_scholar_url'] = principal.linkedin;
    
    // Semblanza
    if (principal.semblanza) datosMapeados['pers_semblanza'] = principal.semblanza;
    
    // 2. ÁREA DE CONOCIMIENTO (desde perfil.principal.areaConocimiento)
    const areaConocimiento = principal.areaConocimiento;
    if (areaConocimiento) {
      if (areaConocimiento.area) {
        if (areaConocimiento.area.nombre) datosMapeados['area_nombre'] = areaConocimiento.area.nombre;
        if (areaConocimiento.area.clave) datosMapeados['area_clave'] = areaConocimiento.area.clave;
        if (areaConocimiento.area.version) datosMapeados['area_version'] = areaConocimiento.area.version;
      }
      if (areaConocimiento.campo) {
        if (areaConocimiento.campo.nombre) datosMapeados['campo_nombre'] = areaConocimiento.campo.nombre;
        if (areaConocimiento.campo.clave) datosMapeados['campo_clave'] = areaConocimiento.campo.clave;
      }
      if (areaConocimiento.disciplina) {
        if (areaConocimiento.disciplina.nombre) datosMapeados['disciplina_nombre'] = areaConocimiento.disciplina.nombre;
        if (areaConocimiento.disciplina.clave) datosMapeados['disciplina_clave'] = areaConocimiento.disciplina.clave;
      }
      if (areaConocimiento.subdisciplina) {
        if (areaConocimiento.subdisciplina.nombre) datosMapeados['subdisciplina_nombre'] = areaConocimiento.subdisciplina.nombre;
        if (areaConocimiento.subdisciplina.clave) datosMapeados['subdisciplina_clave'] = areaConocimiento.subdisciplina.clave;
      }
    }
    
    // 3. INSTITUCIÓN (tomar de trayectoria profesional actual o académica más reciente)
    const trayectoriaProfesional = perfil.trayectoriaProfesional;
    const trayectoriaAcademica = perfil.trayectoriaAcademica;
    
    // Buscar institución en trayectoria profesional actual
    let institucion = null;
    if (Array.isArray(trayectoriaProfesional) && trayectoriaProfesional.length > 0) {
      const profActual = trayectoriaProfesional.find((t: any) => t.esActual || t.esPrincipal) || trayectoriaProfesional[0];
      institucion = profActual?.institucion;
    }
    
    // Si no hay profesional, buscar en académica más reciente
    if (!institucion && Array.isArray(trayectoriaAcademica) && trayectoriaAcademica.length > 0) {
      institucion = trayectoriaAcademica[trayectoriaAcademica.length - 1]?.institucion;
    }
    
    if (institucion) {
      if (institucion.clave) datosMapeados['inst_clave_oficial'] = institucion.clave;
      if (institucion.nombre) datosMapeados['inst_nombre'] = institucion.nombre;
      if (institucion.tipo) {
        const tipo = typeof institucion.tipo === 'object' ? institucion.tipo.nombre : institucion.tipo;
        if (tipo === 'Nacional') datosMapeados['inst_tipo_id'] = 'NAC';
        else if (tipo === 'Extranjera') datosMapeados['inst_tipo_id'] = 'EXT';
      }
      if (institucion.pais) {
        const pais = typeof institucion.pais === 'object' ? institucion.pais.nombre : institucion.pais;
        if (pais) datosMapeados['inst_pais_nombre'] = pais;
      }
      if (institucion.entidad) {
        const entidad = typeof institucion.entidad === 'object' ? institucion.entidad.nombre : institucion.entidad;
        if (entidad) datosMapeados['inst_entidad_nombre'] = entidad;
      }
      if (institucion.municipio || institucion.municipioNombre) {
        const municipioRaw = institucion.municipio ?? institucion.municipioNombre;
        const municipio = typeof municipioRaw === 'object' ? municipioRaw.nombre : municipioRaw;
        if (municipio) datosMapeados['inst_municipio_nombre'] = municipio;
      }
      if (institucion.nivelUno) {
        const nivelUno = typeof institucion.nivelUno === 'object' ? institucion.nivelUno.nombre : institucion.nivelUno;
        if (nivelUno) datosMapeados['inst_nivel_uno_nombre'] = nivelUno;
      }
      if (institucion.nivelDos) {
        const nivelDos = typeof institucion.nivelDos === 'object' ? institucion.nivelDos.nombre : institucion.nivelDos;
        if (nivelDos) datosMapeados['inst_nivel_dos_nombre'] = nivelDos;
      }
    }
    
    // 4. TRAYECTORIA ACADÉMICA (tomar el grado más alto o más reciente)
    if (Array.isArray(trayectoriaAcademica) && trayectoriaAcademica.length > 0) {
      // Buscar doctorado primero, luego maestría, luego licenciatura
      const doctorado = trayectoriaAcademica.find((t: any) => t.nivelEscolaridad?.nombre === 'Doctorado' || t.nivelEscolaridad?.id === '8');
      const maestria = trayectoriaAcademica.find((t: any) => t.nivelEscolaridad?.nombre === 'Maestría' || t.nivelEscolaridad?.id === '7');
      const licenciatura = trayectoriaAcademica.find((t: any) => t.nivelEscolaridad?.nombre === 'Licenciatura' || t.nivelEscolaridad?.id === '5');
      
      const grado = doctorado || maestria || licenciatura || trayectoriaAcademica[trayectoriaAcademica.length - 1];
      
      if (grado) {
        if (grado.nivelEscolaridad) {
          const nivel = typeof grado.nivelEscolaridad === 'object' ? grado.nivelEscolaridad.nombre : grado.nivelEscolaridad;
          if (nivel) datosMapeados['acad_nivel_nombre'] = nivel;
        }
        if (grado.titulo) datosMapeados['acad_titulo'] = grado.titulo;
        if (grado.estatus) {
          const estatus = typeof grado.estatus === 'object' ? grado.estatus.nombre : grado.estatus;
          if (estatus) {
            // Mapear estatus
            const estatusMap: { [key: string]: string } = {
              'Grado obtenido': 'Titulado',
              'Grado en curso': 'En curso',
              'Grado en trámite': 'En trámite'
            };
            datosMapeados['acad_estatus_nombre'] = estatusMap[estatus] || estatus;
          }
        }
        if (grado.cedulaProfesional) datosMapeados['acad_cedula_profesional'] = grado.cedulaProfesional;
        if (grado.institucion) {
          const institucionGrado = typeof grado.institucion === 'object' ? grado.institucion.nombre : grado.institucion;
          if (institucionGrado) datosMapeados['acad_institucion'] = institucionGrado;
        }
        if (grado.opcionTitulacion) {
          const opcion = typeof grado.opcionTitulacion === 'object' ? grado.opcionTitulacion.nombre : grado.opcionTitulacion;
          if (opcion) datosMapeados['acad_opcion_titulacion'] = opcion;
        }
        if (grado.tituloTesis) datosMapeados['acad_titulo_tesis'] = grado.tituloTesis;
        if (grado.fechaObtencion) datosMapeados['acad_fecha_obtencion'] = grado.fechaObtencion;
      }
    }
    
    // 5. TRAYECTORIA PROFESIONAL (tomar el empleo actual o principal)
    if (Array.isArray(trayectoriaProfesional) && trayectoriaProfesional.length > 0) {
      const profActual = trayectoriaProfesional.find((t: any) => t.esActual || t.esPrincipal) || trayectoriaProfesional[0];
      
      if (profActual) {
        if (profActual.nombramiento) datosMapeados['tray_prof_nombramiento'] = profActual.nombramiento;
        if (profActual.institucion) datosMapeados['tray_prof_institucion'] = profActual.institucion;
        if (profActual.fechaInicio) datosMapeados['tray_prof_fecha_inicio'] = profActual.fechaInicio;
        if (profActual.fechaFin) datosMapeados['tray_prof_fecha_fin'] = profActual.fechaFin;
        if (profActual.esActual !== undefined) datosMapeados['tray_prof_es_actual'] = profActual.esActual;
        if (profActual.logros) datosMapeados['tray_prof_logros'] = profActual.logros;
      }
    }
    
    // 6. IDIOMAS (tomar el primer idioma con certificación o el primero disponible)
    const idiomaLengua = perfil.idiomaLengua;
    if (idiomaLengua && Array.isArray(idiomaLengua.idiomas) && idiomaLengua.idiomas.length > 0) {
      const idioma = idiomaLengua.idiomas.find((i: any) => i.esCertificado) || idiomaLengua.idiomas[0];
      
      if (idioma) {
        if (idioma.nombre) {
          const nombreIdioma = typeof idioma.nombre === 'object' ? idioma.nombre.nombre : idioma.nombre;
          if (nombreIdioma) datosMapeados['idioma_nombre'] = nombreIdioma;
        }
        if (idioma.dominio) {
          const dominio = typeof idioma.dominio === 'object' ? idioma.dominio.nombre : idioma.dominio;
          if (dominio) {
            // Mapear dominio a formato del formulario
            const dominioMap: { [key: string]: string } = {
              'Nivel universitario': 'Excelente',
              'Avanzado': 'Avanzado',
              'Intermedio': 'Bueno',
              'Básico': 'Básico'
            };
            datosMapeados['idioma_dominio_nombre'] = dominioMap[dominio] || dominio;
          }
        }
        if (idioma.lectura) {
          const lectura = typeof idioma.lectura === 'object' ? idioma.lectura.nombre : idioma.lectura;
          if (lectura) datosMapeados['idioma_lectura'] = lectura;
        }
        if (idioma.escritura) {
          const escritura = typeof idioma.escritura === 'object' ? idioma.escritura.nombre : idioma.escritura;
          if (escritura) datosMapeados['idioma_escritura'] = escritura;
        }
        if (idioma.conversacion) {
          const conversacion = typeof idioma.conversacion === 'object' ? idioma.conversacion.nombre : idioma.conversacion;
          if (conversacion) datosMapeados['idioma_conversacion'] = conversacion;
        }
        if (idioma.esCertificado !== undefined) datosMapeados['idioma_es_certificado'] = idioma.esCertificado;
        if (idioma.nombreInstitucion) datosMapeados['idioma_cert_institucion'] = idioma.nombreInstitucion;
        if (idioma.puntuacion) datosMapeados['idioma_cert_puntuacion'] = idioma.puntuacion;
        if (idioma.finVigencia) datosMapeados['idioma_vigencia_fin'] = idioma.finVigencia;
      }
    }
    
    // 7. ESTANCIAS (tomar la más reciente)
    const estancias = perfil.estancias;
    if (Array.isArray(estancias) && estancias.length > 0) {
      const estancia = estancias[estancias.length - 1]; // La más reciente
      
      if (estancia) {
        if (estancia.nombre) datosMapeados['estancia_nombre_proyecto'] = estancia.nombre;
        if (estancia.tipo) {
          const tipo = typeof estancia.tipo === 'object' ? estancia.tipo.nombre : estancia.tipo;
          if (tipo) datosMapeados['estancia_tipo_nombre'] = tipo;
        }
        if (estancia.fechaInicio) datosMapeados['estancia_fecha_inicio'] = estancia.fechaInicio;
        if (estancia.fechaFin) datosMapeados['estancia_fecha_fin'] = estancia.fechaFin;
        if (estancia.institucion) {
          const instNombre = typeof estancia.institucion === 'object' ? estancia.institucion.nombre : estancia.institucion;
          if (instNombre) datosMapeados['estancia_institucion_receptora'] = instNombre;
        }
        if (estancia.logros) datosMapeados['estancia_logros'] = estancia.logros;
      }
    }
    
    // 8. CURSOS (tomar el curso marcado como producto principal o el más reciente)
    const cursosImpartidos = perfil.cursosImpartidos;
    if (Array.isArray(cursosImpartidos) && cursosImpartidos.length > 0) {
      const curso = cursosImpartidos.find((c: any) => c.productoPrincipal) || cursosImpartidos[cursosImpartidos.length - 1];
      
      if (curso) {
        if (curso.nombreCurso) datosMapeados['curso_nombre'] = curso.nombreCurso;
        if (curso.nombrePrograma) datosMapeados['curso_programa'] = curso.nombrePrograma;
        if (curso.horasTotales) datosMapeados['curso_horas_totales'] = curso.horasTotales;
        if (curso.fechaInicio) datosMapeados['curso_fecha_inicio'] = curso.fechaInicio;
        if (curso.fechaFin) datosMapeados['curso_fecha_fin'] = curso.fechaFin;
        if (curso.institucion) {
          const instNombre = typeof curso.institucion === 'object' ? curso.institucion.nombre : curso.institucion;
          if (instNombre) datosMapeados['curso_institucion'] = instNombre;
        }
        if (curso.nivelEscolaridad) {
          const nivel = typeof curso.nivelEscolaridad === 'object' ? curso.nivelEscolaridad.nombre : curso.nivelEscolaridad;
          if (nivel) datosMapeados['curso_nivel_escolaridad'] = nivel;
        }
        if (curso.productoPrincipal !== undefined) datosMapeados['curso_producto_principal'] = curso.productoPrincipal;
      }
    }
    
    // 9. APORTACIONES (ARTÍCULOS) - desde aportaciones.articulosCientifica
    const aportaciones = jsonData.aportaciones;
    if (aportaciones && Array.isArray(aportaciones.articulosCientifica) && aportaciones.articulosCientifica.length > 0) {
      const rolMap: { [key: string]: string } = {
        'Autor': 'Autor Principal',
        'Coautor': 'Coautor'
      };

      const articulosNormalizados: ArticuloCientifico[] = aportaciones.articulosCientifica
        .map((item: any) => {
          const rolRaw = typeof item?.rolParticipacion === 'object' ? item?.rolParticipacion?.nombre : item?.rolParticipacion;
          const estadoRaw = typeof item?.estado === 'object' ? item?.estado?.nombre : item?.estado;

          const autores: AutorArticuloItem[] = Array.isArray(item?.autores)
            ? item.autores
                .map((a: any, idx: number) => {
                  const nombreCompleto = (a?.nombreCompleto || `${a?.nombre || ''} ${a?.primerApellido || ''} ${a?.segundoApellido || ''}`.trim()).toString().trim();
                  return {
                    nombre: nombreCompleto,
                    orcid: (a?.orcid || a?.orcId || '').toString().trim(),
                    orden: Number(a?.orden) > 0 ? Number(a?.orden) : idx + 1
                  } as AutorArticuloItem;
                })
                .filter((a: AutorArticuloItem) => !!a.nombre)
            : [];

          let recibioApoyo = false;
          let fondoProgramaNombre = '';
          if (item?.apoyo) {
            const claveApoyoRecibido = Object.keys(item.apoyo).find((k) => k.toLowerCase().includes('recibioapoyo'));
            if (claveApoyoRecibido !== undefined) {
              recibioApoyo = !!item.apoyo[claveApoyoRecibido];
            }
            const fondoRaw = item.apoyo?.fondoPrograma;
            if (fondoRaw) {
              fondoProgramaNombre = (typeof fondoRaw === 'object' ? fondoRaw?.nombre : fondoRaw || '').toString().trim();
            }
          }

          const anioNum = Number(item?.anio);
          const totalCitasNum = Number(item?.cita?.totalCitas);

          return {
            idExterno: (item?.idExterno || '').toString().trim(),
            eje: (item?.eje || '').toString().trim(),
            tipo: (item?.tipo || '').toString().trim(),
            productoPrincipal: !!item?.productoPrincipal,
            anio: Number.isNaN(anioNum) ? null : anioNum,
            issn: (item?.issn || '').toString().trim(),
            issnElectronico: (item?.issnElectronico || '').toString().trim(),
            doi: (item?.doi || '').toString().trim(),
            nombreRevista: (item?.nombreRevista || '').toString().trim(),
            titulo: (item?.titulo || '').toString().trim(),
            rolParticipacionNombre: (rolMap[(rolRaw || '').toString().trim()] || (rolRaw || '')).toString().trim(),
            estadoNombre: (estadoRaw || '').toString().trim(),
            objetivoNombre: (item?.objetivoNombre || '').toString().trim(),
            recibioApoyoSECIHTI: recibioApoyo,
            fondoProgramaNombre: fondoProgramaNombre,
            totalCitas: Number.isNaN(totalCitasNum) ? 0 : Math.max(0, totalCitasNum),
            autores
          } as ArticuloCientifico;
        })
        .filter((item: ArticuloCientifico) => !!(item.titulo && item.nombreRevista && item.rolParticipacionNombre));

      if (articulosNormalizados.length > 0) {
        this.articulosCientificosList = articulosNormalizados;
        const articulo = this.articulosCientificosList.find((a) => a.productoPrincipal) || this.articulosCientificosList[0];
        this.autoresList = articulo.autores.length > 0
          ? articulo.autores.map((a, idx) => ({
              nombre: a.nombre || '',
              orcid: a.orcid || '',
              orden: Number(a.orden) > 0 ? Number(a.orden) : idx + 1
            }))
          : [{ nombre: '', orcid: '', orden: 1 }];

        datosMapeados['art_titulo'] = articulo.titulo || '';
        datosMapeados['art_nombre_revista'] = articulo.nombreRevista || '';
        datosMapeados['art_anio'] = articulo.anio ?? null;
        datosMapeados['art_rol_part_nombre'] = articulo.rolParticipacionNombre || '';
        datosMapeados['art_estado_nombre'] = articulo.estadoNombre || 'Publicado';
        datosMapeados['art_doi'] = articulo.doi || '';
        datosMapeados['art_issn'] = articulo.issn || '';
        datosMapeados['art_issn_electronico'] = articulo.issnElectronico || '';
        datosMapeados['art_total_citas'] = articulo.totalCitas ?? 0;
        datosMapeados['art_producto_principal'] = !!articulo.productoPrincipal;
        datosMapeados['art_recibio_apoyo_SECIHTI'] = !!articulo.recibioApoyoSECIHTI;
        datosMapeados['art_fondo_prog_nombre'] = articulo.fondoProgramaNombre || '';

        const primerAutor = this.autoresList[0];
        if (primerAutor) {
          datosMapeados['art_autor_nombre_completo'] = primerAutor.nombre;
          datosMapeados['art_autor_orcid'] = primerAutor.orcid;
          datosMapeados['art_autor_orden'] = primerAutor.orden;
        }
      }
    }
    
    // 10. CONGRESOS (cargar todos a congresosList)
    const congresos = perfil.congresos;
    if (Array.isArray(congresos) && congresos.length > 0) {
      const tipoMap: { [key: string]: string } = {
        'Ponencia': 'Ponente',
        'Póster': 'Presentación de Póster',
        'Participante en mesa redonda': 'Ponente',
        'Presentación de artículo en extenso': 'Ponente'
      };
      const paisMap: { [key: string]: string } = {
        'United States of America': 'Estados Unidos',
        'Italy': 'Otro',
        'Spain': 'España',
        'Costa Rica': 'Otro',
        'Czech Republic': 'Otro'
      };

      this.congresosList = congresos.map((c: any) => {
        const tipo = typeof c.tipoParticipacion === 'object' ? c.tipoParticipacion?.nombre : c.tipoParticipacion;
        const pais = typeof c.pais === 'object' ? c.pais?.nombre : c.pais;
        const tipoNormalizado = (tipoMap[tipo] || tipo || '').toString().trim();
        const paisNormalizado = (paisMap[pais] || pais || '').toString().trim();
        return {
          nombre: c.nombre || '',
          tituloTrabajo: c.tituloTrabajo || '',
          tipoParticipacion: this.obtenerValorSelectConOtro(tipoNormalizado, ['Ponente', 'Conferencista magistral', 'Presentación de póster', 'Organizador']),
          tipoParticipacionManual: this.obtenerTextoManualDesdeValor(tipoNormalizado, ['Ponente', 'Conferencista magistral', 'Presentación de póster', 'Organizador']),
          fecha: c.fecha || '',
          paisSede: this.obtenerValorSelectConOtro(paisNormalizado, ['México', 'España', 'Estados Unidos']),
          paisSedeManual: this.obtenerTextoManualDesdeValor(paisNormalizado, ['México', 'España', 'Estados Unidos']),
          productoPrincipal: c.productoPrincipal || false
        };
      });

      // Mapear el primero al form para compatibilidad
      const primero = this.congresosList[0];
      if (primero) {
        datosMapeados['congreso_nombre_evento'] = primero.nombre;
        datosMapeados['congreso_titulo_trabajo'] = primero.tituloTrabajo;
        datosMapeados['congreso_tipo_part_nombre'] = this.resolverValorConOtro(primero.tipoParticipacion, primero.tipoParticipacionManual);
        datosMapeados['congreso_fecha'] = primero.fecha;
        datosMapeados['congreso_pais_sede'] = this.resolverValorConOtro(primero.paisSede, primero.paisSedeManual);
        datosMapeados['art_producto_principal'] = primero.productoPrincipal;
      }
    }
    
    // 11. DIVULGACIÓN (tomar la más reciente)
    const divulgacion = perfil.divulgacion;
    if (Array.isArray(divulgacion) && divulgacion.length > 0) {
      const divulg = divulgacion[divulgacion.length - 1];
      
      if (divulg) {
        if (divulg.tituloTrabajo) datosMapeados['divulg_titulo'] = divulg.tituloTrabajo;
        if (divulg.tipoDivulgacion) {
          const tipo = typeof divulg.tipoDivulgacion === 'object' ? divulg.tipoDivulgacion.nombre : divulg.tipoDivulgacion;
          if (tipo) {
            const tipoMap: { [key: string]: string } = {
              'Nacional': 'Científica'
            };
            datosMapeados['divulg_tipo_div_nombre'] = tipoMap[tipo] || tipo;
          }
        }
        if (divulg.tipoMedio) {
          const medio = typeof divulg.tipoMedio === 'object' ? divulg.tipoMedio.nombre : divulg.tipoMedio;
          if (medio) {
            const medioMap: { [key: string]: string } = {
              'Internet': 'Redes Sociales',
              'Medio impreso': 'Prensa Escrita'
            };
            datosMapeados['divulg_medio_nombre'] = medioMap[medio] || medio;
          }
        }
        if (divulg.dirigidoA) {
          const dirigido = typeof divulg.dirigidoA === 'object' ? divulg.dirigidoA.nombre : divulg.dirigidoA;
          if (dirigido) {
            const dirigidoMap: { [key: string]: string } = {
              'Sector estudiantil': 'Estudiantes',
              'Público en general': 'Público general'
            };
            datosMapeados['divulg_dirigido_a'] = dirigidoMap[dirigido] || dirigido;
          }
        }
        if (divulg.fecha) datosMapeados['divulg_fecha'] = divulg.fecha;
        if (divulg.nombreInstitucion) datosMapeados['divulg_institucion_organizadora'] = divulg.nombreInstitucion;
        if (Array.isArray(divulg.productoObtenido) && divulg.productoObtenido.length > 0) {
          const producto = typeof divulg.productoObtenido[0] === 'object' ? divulg.productoObtenido[0].nombre : divulg.productoObtenido[0];
          if (producto) {
            const productoMap: { [key: string]: string } = {
              'Póster': 'Material Didáctico',
              'Ponencia': 'Constancia de Participación'
            };
            datosMapeados['divulg_prod_obtenido_nombre'] = productoMap[producto] || producto;
          }
        }
      }
    }
    
    // 12. LOGROS (tomar el más reciente)
    const logros = perfil.logros;
    if (Array.isArray(logros) && logros.length > 0) {
      const logro = logros[logros.length - 1];
      
      if (logro) {
        if (logro.nombre) {
          const nombreLogro = typeof logro.nombre === 'object' ? logro.nombre.nombre : logro.nombre;
          if (nombreLogro) datosMapeados['logro_nombre'] = nombreLogro;
        }
        if (logro.anio) datosMapeados['logro_anio'] = parseInt(logro.anio) || logro.anio;
        if (logro.tipo) datosMapeados['logro_tipo'] = logro.tipo;
      }
    }
    
    return datosMapeados;
  }

  private cargarArchivosGuardados(): void {
    this.http.get<any>(environment.apiBaseUrl + '/usuarios/me/completar-registro/archivos').subscribe({
      next: (response) => {
        const archivos = response?.archivos || {};
        Object.entries(archivos).forEach(([campo, raw]) => {
          const archivo = raw as any;
          if (!archivo?.guardado) {
            return;
          }
          this.archivosGuardados[campo] = {
            documentoId: Number(archivo.documentoId),
            nombre: String(archivo.nombre || 'Documento guardado')
          };

          const control = this.form.get(campo);
          if (control && !(control.value instanceof File)) {
            control.setValue({
              persisted: true,
              documentoId: Number(archivo.documentoId),
              name: String(archivo.nombre || 'Documento guardado')
            }, { emitEvent: false });
            control.updateValueAndValidity({ emitEvent: false });
          }
        });
        const certificadoIdioma = this.archivosGuardados['idioma_cert_documento'];
        if (certificadoIdioma) {
          this.idiomasDominioList = this.idiomasDominioList.map(item => ({
            ...item,
            certDocumentoPersistido: item.certDocumentoPersistido || item.esCertificado,
            certDocumentoNombre: item.certDocumentoNombre || certificadoIdioma.nombre
          }));
        }
        this.actualizarValidacionesCondicionales();
      },
      error: () => {
        // El guardado de datos puede continuar aunque no se pueda consultar el resumen de archivos.
      }
    });
  }

  private esArchivoDisponible(value: unknown, campo: string): boolean {
    if (value instanceof File) {
      return true;
    }
    if (value && typeof value === 'object' && (value as any).persisted === true) {
      return true;
    }
    return !!this.archivosGuardados[campo];
  }

  private construirArchivosSeccion(seccion: View): FormData | null {
    const archivos = new FormData();
    let total = 0;

    const agregarControl = (campo: string): void => {
      const value = this.form.get(campo)?.value;
      if (value instanceof File && !this.archivosSubidosEnSesion.has(value)) {
        archivos.append(campo, value);
        total++;
      }
    };

    switch (seccion) {
      case 'trayectoria-academica':
        agregarControl('cert1');
        agregarControl('acad_constancia_snii');
        break;
      case 'trayectoria-profesional':
        agregarControl('cert2');
        break;
      case 'idiomas':
        this.idiomasDominioList.forEach((item, index) => {
          if (item.certDocumento instanceof File && !this.archivosSubidosEnSesion.has(item.certDocumento)) {
            archivos.append('idiomaCertDocumento_' + index, item.certDocumento);
            total++;
          }
        });
        if (total === 0) {
          agregarControl('idioma_cert_documento');
        }
        break;
      case 'estancias':
        agregarControl('estancia_documento');
        break;
      case 'divulgacion':
        this.divulgacionesCientificasList.forEach((item, index) => {
          if (item.evidenciaArchivo instanceof File && !this.archivosSubidosEnSesion.has(item.evidenciaArchivo)) {
            archivos.append('divulgArchivo_' + index, item.evidenciaArchivo);
            total++;
          }
        });
        if (total === 0) {
          agregarControl('divulg_archivo');
        }
        break;
    }

    return total > 0 ? archivos : null;
  }

  private registrarArchivosGuardados(response: any, enviados: FormData): void {
    enviados.forEach((value) => {
      if (value instanceof File) {
        this.archivosSubidosEnSesion.add(value);
      }
    });

    const guardados = Array.isArray(response?.archivos) ? response.archivos : [];
    guardados.forEach((archivo: any) => {
      const campoRespuesta = String(archivo?.campo || '');
      const esCertificadoIdioma = campoRespuesta.startsWith('idiomaCertDocumento_');
      const campo = campoRespuesta.startsWith('divulgArchivo_')
        ? 'divulg_archivo'
        : esCertificadoIdioma ? 'idioma_cert_documento' : campoRespuesta;
      if (!campo || !archivo?.documentoId) {
        return;
      }
      const nombre = String(archivo.nombre || 'Documento guardado');
      this.archivosGuardados[campo] = {
        documentoId: Number(archivo.documentoId),
        nombre
      };
      if (esCertificadoIdioma) {
        const index = Number(campoRespuesta.substring('idiomaCertDocumento_'.length));
        const item = this.idiomasDominioList[index];
        if (item) {
          item.certDocumentoPersistido = true;
          item.certDocumentoNombre = item.certDocumentoNombre || nombre;
        }
      }
    });
  }

  private async validarArchivosRequeridosSeccion(seccion: View): Promise<boolean> {
    this.actualizarValidacionesCondicionales();
    const faltantes: Array<{ campo: string; nombre: string }> = [];

    const requerir = (campo: string, nombre: string): void => {
      const control = this.form.get(campo);
      if (!this.esArchivoDisponible(control?.value, campo)) {
        control?.markAsTouched();
        faltantes.push({ campo, nombre });
      }
    };

    if (seccion === 'trayectoria-academica') {
      requerir('cert1', 'Documento probatorio de titulación');
      if (this.form.get('acad_es_perfil_snii')?.value) {
        requerir('acad_constancia_snii', 'Constancia SNII');
      }
    }

    if (seccion === 'idiomas') {
      const idiomaActual = this.obtenerIdiomaDesdeFormulario();
      const idiomasAValidar = [...this.idiomasDominioList];
      const tieneDatosActual = !!(idiomaActual.nombre || idiomaActual.dominioNombre);
      if (tieneDatosActual && !idiomasAValidar.some(item => this.idiomasIguales(item, idiomaActual))) {
        idiomasAValidar.unshift(idiomaActual);
      }
      const faltaCertificado = idiomasAValidar.some(item =>
        item.dominioNombre === 'Excelente' &&
        !(item.certDocumento instanceof File) &&
        !item.certDocumentoPersistido &&
        !this.archivosGuardados['idioma_cert_documento']
      );
      if (faltaCertificado) {
        this.form.get('idioma_cert_documento')?.markAsTouched();
        faltantes.push({
          campo: 'idioma_cert_documento',
          nombre: 'Documento probatorio de certificación para cada idioma con dominio Excelente'
        });
      }
    }

    if (seccion === 'divulgacion') {
      const productoActual = this.resolverValorConOtro(
        this.form.get('divulg_prod_obtenido_nombre')?.value,
        this.divulgProductoManual
      );
      const archivoActual = this.form.get('divulg_archivo')?.value;
      const requierePdfActual = !!productoActual && !this.esProductoConEvidenciaLink(productoActual);
      const tienePdfEnControl = archivoActual instanceof File ||
        (!!archivoActual && typeof archivoActual === 'object' && archivoActual.persisted === true);

      this.sincronizarDivulgacionesAntesDeEnviar();
      const hayEvidenciaPersistida = !!this.archivosGuardados['divulg_archivo'];
      const faltaEnLista = this.divulgacionesCientificasList.some(item =>
        item.evidenciaTipo === 'PDF' &&
        !(item.evidenciaArchivo instanceof File || (!!item.evidenciaArchivoNombre && hayEvidenciaPersistida))
      );

      if ((requierePdfActual && !tienePdfEnControl) || faltaEnLista) {
        const control = this.form.get('divulg_archivo');
        control?.markAsTouched();
        faltantes.push({ campo: 'divulg_archivo', nombre: 'Documento probatorio de divulgación' });
      }
    }

    if (faltantes.length === 0) {
      return true;
    }

    await Swal.fire({
      icon: 'warning',
      title: 'Falta un archivo obligatorio',
      text: 'Carga ' + faltantes.map(item => item.nombre).join(', ') + ' para continuar.',
      confirmButtonColor: '#800020'
    });
    return false;
  }
  private async guardarSeccionActualAntesDeNavegar(actual: View, destino: View, forzar = false): Promise<boolean> {
    this.saveDraft();

    if (!forzar && !this.debeGuardarSeccionEnServidor(actual, destino)) {
      return true;
    }

    const payload = this.construirPayloadGuardadoParcial(actual);
    const archivos = this.construirArchivosSeccion(actual);
    if (!this.payloadTieneDatos(payload) && !archivos) {
      return true;
    }

    this.savingSection.set(true);
    try {
      const seccion = this.obtenerSeccionGuardado(actual);
      if (this.payloadTieneDatos(payload)) {
        await firstValueFrom(
          this.http.patch(environment.apiBaseUrl + '/usuarios/me/completar-registro/seccion/' + seccion, payload)
        );
      }
      if (archivos) {
        const response = await firstValueFrom(
          this.http.post<any>(environment.apiBaseUrl + '/usuarios/me/completar-registro/seccion/' + seccion + '/archivos', archivos)
        );
        this.registrarArchivosGuardados(response, archivos);
      }
      this.saveDraft();
      if (!forzar) {
        await Swal.fire({
          icon: 'success',
          title: 'Registrado correctamente',
          text: 'El avance de esta sección quedó guardado.',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1600,
          timerProgressBar: true
        });
      }
      return true;
    } catch (error: any) {
      const mensaje = error?.error?.message || error?.message || 'No se pudo guardar el avance de esta sección.';
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar el avance',
        text: mensaje,
        confirmButtonColor: '#800020'
      });
      return false;
    } finally {
      this.savingSection.set(false);
    }
  }
  private async validarSeccionCompletaAntesDeGuardar(seccion: View): Promise<boolean> {
    const seccionNormalizada: View = seccion === 'inicio' ? 'personaPrincipal' : seccion;
    this.actualizarValidacionesCondicionales();

    if (this.getSectionProgress(seccionNormalizada) === 100) {
      return true;
    }

    const camposPorSeccion: Partial<Record<View, string[]>> = {
      personaPrincipal: [
        'pers_nombre', 'pers_primer_apellido', 'pers_curp', 'pers_rfc',
        'pers_fecha_nacimiento', 'pers_sexo_nombre', 'pers_estado_civil_nombre',
        'pers_nacionalidad_nombre', 'pers_entidad_nombre', 'pers_municipio_nombre',
        'pers_semblanza', 'rfcNum'
      ],
      padronInstitucional: [
        'telefono', 'tipoIdentificacionOficial', 'identificacionOficial', 'calle',
        'numeroExterior', 'colonia', 'localidad', 'municipioDomicilio', 'codigoPostal'
      ],
      institucion: [
        'inst_clave_oficial', 'inst_nombre', 'inst_tipo_id', 'inst_pais_nombre',
        'inst_entidad_nombre', 'inst_municipio_nombre', 'inst_estado_usa'
      ],
      'area-conocimiento': ['area_nombre', 'area_clave'],
      'trayectoria-academica': ['acad_nivel_nombre', 'acad_titulo', 'acad_estatus_nombre', 'cert1', 'acad_constancia_snii'],
      'trayectoria-profesional': ['tray_prof_nombramiento', 'tray_prof_institucion', 'tray_prof_fecha_inicio', 'tray_prof_fecha_fin'],
      cursos: ['curso_nombre', 'curso_programa', 'curso_horas_totales', 'curso_fecha_inicio', 'curso_institucion', 'curso_nivel_escolaridad'],
      idiomas: ['idioma_nombre', 'idioma_dominio_nombre', 'idioma_cert_institucion', 'idioma_cert_puntuacion', 'idioma_cert_documento'],
      estancias: ['estancia_nombre_proyecto', 'estancia_tipo_nombre', 'estancia_fecha_inicio', 'estancia_institucion_receptora'],
      aportaciones: ['art_titulo', 'art_nombre_revista', 'art_rol_part_nombre', 'art_estado_nombre', 'art_fondo_prog_nombre'],
      divulgacion: ['divulg_titulo', 'divulg_tipo_div_nombre', 'divulg_medio_nombre', 'divulg_fecha', 'divulg_prod_obtenido_nombre', 'divulg_archivo', 'divulg_evidencia_link'],
      logros: ['logro_nombre', 'logro_anio']
    };

    (camposPorSeccion[seccionNormalizada] || [])
      .filter(campo => this.isConditionalFieldActive(campo))
      .forEach(campo => {
        const control = this.form.get(campo);
        control?.markAsTouched();
        control?.updateValueAndValidity({ emitEvent: false });
      });

    const nombreSeccion = this.getSectionSteps().find(item => item.id === seccionNormalizada)?.title || 'esta sección';
    await Swal.fire({
      icon: 'warning',
      title: 'Sección incompleta',
      text: `Completa los campos obligatorios de ${nombreSeccion} antes de continuar.`,
      confirmButtonColor: '#800020'
    });
    return false;
  }

  private debeGuardarSeccionEnServidor(actual: View, destino: View): boolean {
    if (!['inicio', 'personaPrincipal', 'padronInstitucional', 'institucion', 'area-conocimiento', 'trayectoria-academica', 'trayectoria-profesional', 'cursos', 'idiomas', 'estancias', 'aportaciones', 'congresos', 'divulgacion', 'logros'].includes(actual)) {
      return false;
    }
    return this.obtenerSeccionGuardado(actual) !== this.obtenerSeccionGuardado(destino);
  }

  private obtenerSeccionGuardado(seccion: View): string {
    if (seccion === 'inicio') {
      return 'personaPrincipal';
    }
    return seccion;
  }

  private obtenerOrdenSeccion(seccion: View): number {
    const orden: Record<View, number> = {
      'documentos': -1,
      'inicio': 0,
      'personaPrincipal': 1,
      'padronInstitucional': 2,
      'institucion': 3,
      'area-conocimiento': 4,
      'trayectoria-academica': 5,
      'trayectoria-profesional': 6,
      'cursos': 7,
      'idiomas': 8,
      'estancias': 9,
      'aportaciones': 10,
      'congresos': 11,
      'divulgacion': 12,
      'logros': 13
    };
    return orden[seccion] ?? 999;
  }

  private construirPayloadGuardadoParcial(seccion: View): Record<string, unknown> {
    switch (seccion) {
      case 'inicio':
      case 'personaPrincipal':
        return this.construirPayloadDatosPersonales();
      case 'padronInstitucional':
        return this.construirPayloadPadronInstitucional();
      case 'institucion':
        return this.construirPayloadInstitucion();
      case 'area-conocimiento':
        return this.construirPayloadAreaConocimiento();
      case 'trayectoria-academica':
        return this.construirPayloadTrayectoriaAcademica();
      case 'trayectoria-profesional':
        return this.construirPayloadTrayectoriaProfesional();
      case 'cursos':
        return this.construirPayloadCursos();
      case 'idiomas':
        return this.construirPayloadIdiomas();
      case 'estancias':
        return this.construirPayloadEstancias();
      case 'aportaciones':
        return this.construirPayloadAportaciones();
      case 'congresos':
        return this.construirPayloadCongresos();
      case 'divulgacion':
        return this.construirPayloadDivulgaciones();
      case 'logros':
        return this.construirPayloadLogros();
      default:
        return {};
    }
  }

  private construirPayloadDatosPersonales(): Record<string, unknown> {
    return {
      nombre: this.obtenerTextoFormulario('pers_nombre'),
      apellidoPaterno: this.obtenerTextoFormulario('pers_primer_apellido'),
      apellidoMaterno: this.obtenerTextoFormulario('pers_segundo_apellido'),
      curp: this.obtenerTextoFormulario('pers_curp'),
      rfc: this.obtenerTextoFormulario('pers_rfc'),
      fechaNacimiento: this.obtenerTextoFormulario('pers_fecha_nacimiento'),
      genero: this.mapearGeneroParaBackend(this.obtenerTextoFormulario('pers_sexo_nombre')),
      paisNacimiento: this.obtenerTextoFormulario('pers_pais_nac_nombre'),
      entidadFederativa: this.obtenerTextoFormulario('pers_entidad_nombre'),
      nacionalidad: this.obtenerTextoFormulario('pers_nacionalidad_nombre'),
      municipio: this.obtenerTextoFormulario('pers_municipio_nombre'),
      estadoCivil: this.mapearEstadoCivilParaBackend(this.obtenerTextoFormulario('pers_estado_civil_nombre')),
      interesDescripcion: this.obtenerTextoFormulario('pers_semblanza')
    };
  }

  private construirPayloadPadronInstitucional(): Record<string, unknown> {
    return {
      telefono: this.obtenerTextoFormulario('telefono'),
      celular: this.obtenerTextoFormulario('celular'),
      tipoIdentificacionOficial: this.obtenerTextoFormulario('tipoIdentificacionOficial'),
      identificacionOficial: this.obtenerTextoFormulario('identificacionOficial'),
      calle: this.obtenerTextoFormulario('calle'),
      numeroExterior: this.obtenerTextoFormulario('numeroExterior'),
      numeroInterior: this.obtenerTextoFormulario('numeroInterior'),
      entreCalle: this.obtenerTextoFormulario('entreCalle'),
      yCalle: this.obtenerTextoFormulario('yCalle'),
      colonia: this.obtenerTextoFormulario('colonia'),
      claveEntidadFederativa: this.obtenerTextoFormulario('claveEntidadFederativa'),
      municipioDomicilio: this.obtenerTextoFormulario('municipioDomicilio'),
      claveMunicipio: this.obtenerTextoFormulario('claveMunicipio'),
      localidad: this.obtenerTextoFormulario('localidad'),
      claveLocalidad: this.obtenerTextoFormulario('claveLocalidad'),
      codigoPostal: this.obtenerTextoFormulario('codigoPostal'),
      claveAgeb: this.obtenerTextoFormulario('claveAgeb'),
      otraReferencia: this.obtenerTextoFormulario('otraReferencia'),
      claveRedSocial: this.obtenerTextoFormulario('claveRedSocial'),
      redSocial: this.obtenerTextoFormulario('redSocial')
    };
  }

  private construirPayloadInstitucion(): Record<string, unknown> {
    const pais = this.obtenerTextoFormulario('inst_pais_nombre');
    const entidadOEstado = pais === 'Estados Unidos'
      ? this.obtenerTextoFormulario('inst_estado_usa')
      : this.obtenerTextoFormulario('inst_entidad_nombre');

    return {
      instClaveOficial: this.obtenerTextoFormulario('inst_clave_oficial'),
      instNombre: this.obtenerTextoFormulario('inst_nombre'),
      instTipoId: this.obtenerTextoFormulario('inst_tipo_id'),
      instTipoNombre: this.obtenerTextoFormulario('inst_tipo_nombre'),
      instPaisNombre: pais,
      instEntidadNombre: entidadOEstado,
      instMunicipioNombre: this.obtenerTextoFormulario('inst_municipio_nombre'),
      instNivelUnoNombre: this.obtenerTextoFormulario('inst_nivel_uno_nombre'),
      instNivelDosNombre: this.obtenerTextoFormulario('inst_nivel_dos_nombre')
    };
  }

  private construirPayloadAreaConocimiento(): Record<string, unknown> {
    return {
      areaId: this.obtenerTextoFormulario('area_id'),
      areaNombre: this.obtenerTextoFormulario('area_nombre'),
      areaClave: this.obtenerTextoFormulario('area_clave'),
      areaVersion: this.obtenerTextoFormulario('area_version'),
      campoId: this.obtenerTextoFormulario('campo_id'),
      campoNombre: this.obtenerTextoFormulario('campo_nombre'),
      campoClave: this.obtenerTextoFormulario('campo_clave'),
      disciplinaId: this.obtenerTextoFormulario('disciplina_id'),
      disciplinaNombre: this.obtenerTextoFormulario('disciplina_nombre'),
      disciplinaClave: this.obtenerTextoFormulario('disciplina_clave'),
      subdisciplinaId: this.obtenerTextoFormulario('subdisciplina_id'),
      subdisciplinaNombre: this.obtenerTextoFormulario('subdisciplina_nombre'),
      subdisciplinaClave: this.obtenerTextoFormulario('subdisciplina_clave')
    };
  }


  private construirPayloadTrayectoriaAcademica(): Record<string, unknown> {
    this.sincronizarGradosAcademicosAntesDeEnviar();
    if (this.acadGradosList.length > 0) {
      const esPerfilSnii = !!this.form.get('acad_es_perfil_snii')?.value;
      return {
        academicaJson: JSON.stringify(this.acadGradosList.map(grado => ({
          ...grado,
          esPerfilSnii
        })))
      };
    }
    return {};
  }

  private construirPayloadTrayectoriaProfesional(): Record<string, unknown> {
    const nombramiento = this.obtenerTextoFormulario('tray_prof_nombramiento');
    const institucion = this.obtenerTextoFormulario('tray_prof_institucion');
    const fechaInicio = this.obtenerTextoFormulario('tray_prof_fecha_inicio');
    const fechaFin = this.form.get('tray_prof_es_actual')?.value ? null : this.obtenerTextoFormulario('tray_prof_fecha_fin');
    const logros = this.obtenerTextoFormulario('tray_prof_logros');

    if (!(nombramiento || institucion || fechaInicio || fechaFin || logros)) {
      return {};
    }

    return {
      trayProfNombramiento: nombramiento,
      trayProfInstitucion: institucion,
      trayProfFechaInicio: fechaInicio,
      trayProfFechaFin: fechaFin,
      trayProfEsActual: !!this.form.get('tray_prof_es_actual')?.value,
      trayProfLogros: logros
    };
  }

  private construirPayloadCursos(): Record<string, unknown> {
    this.sincronizarCursosAntesDeEnviar();
    if (this.cursosImpartidosList.length > 0) {
      return {
        cursosJson: JSON.stringify(this.cursosImpartidosList)
      };
    }
    return {};
  }

  private construirPayloadIdiomas(): Record<string, unknown> {
    this.sincronizarIdiomasAntesDeEnviar();
    if (this.idiomasDominioList.length === 0) {
      return {};
    }

    return {
      idiomasJson: JSON.stringify(this.construirIdiomasPayload())
    };
  }

  private construirPayloadEstancias(): Record<string, unknown> {
    this.sincronizarEstanciasAntesDeEnviar();
    if (this.estanciasInvestigacionList.length > 0) {
      return {
        estanciasJson: JSON.stringify(this.estanciasInvestigacionList)
      };
    }
    return {};
  }

  private construirPayloadAportaciones(): Record<string, unknown> {
    this.sincronizarArticulosAntesDeEnviar();
    if (this.articulosCientificosList.length > 0) {
      return {
        articulosJson: JSON.stringify(this.articulosCientificosList)
      };
    }
    return {};
  }

  private construirPayloadCongresos(): Record<string, unknown> {
    const congresosConDatos = this.congresosList
      .filter(c => (c.nombre || '').toString().trim() !== '')
      .map(c => ({
        ...c,
        tipoParticipacion: this.resolverValorConOtro(c.tipoParticipacion, c.tipoParticipacionManual),
        paisSede: this.resolverValorConOtro(c.paisSede, c.paisSedeManual)
      }));

    if (congresosConDatos.length === 0) {
      return {};
    }

    return {
      congresosJson: JSON.stringify(congresosConDatos)
    };
  }

  private construirPayloadDivulgaciones(): Record<string, unknown> {
    this.sincronizarDivulgacionesAntesDeEnviar();
    if (this.divulgacionesCientificasList.length === 0) {
      return {};
    }

    const divulgacionesPayload = this.divulgacionesCientificasList.map((item) => ({
      titulo: item.titulo,
      tipoDivulgacionNombre: item.tipoDivulgacionNombre,
      medioNombre: item.medioNombre,
      dirigidoA: item.dirigidoA,
      productoObtenidoNombre: item.productoObtenidoNombre,
      fecha: item.fecha,
      institucionOrganizadora: item.institucionOrganizadora,
      evidenciaTipo: item.evidenciaTipo,
      evidenciaLink: item.evidenciaLink,
      evidenciaArchivoNombre: item.evidenciaArchivoNombre || (item.evidenciaArchivo instanceof File ? item.evidenciaArchivo.name : '')
    }));

    return {
      divulgacionesJson: JSON.stringify(divulgacionesPayload)
    };
  }

  private construirPayloadLogros(): Record<string, unknown> {
    this.sincronizarLogrosAntesDeEnviar();
    if (this.logrosReconocimientosList.length > 0) {
      return {
        logrosJson: JSON.stringify(this.logrosReconocimientosList)
      };
    }
    return {};
  }
  private obtenerTextoFormulario(controlName: string): string | null {
    const valor = this.form.get(controlName)?.value;
    if (valor === null || valor === undefined) {
      return null;
    }
    const texto = valor.toString().trim();
    return texto ? texto : null;
  }

  private mapearGeneroParaBackend(valor: string | null): string | null {
    if (!valor) {
      return null;
    }
    const generoMap: Record<string, string> = {
      'Mujer': 'FEMENINO',
      'Hombre': 'MASCULINO',
      'Otro': 'OTRO'
    };
    return generoMap[valor] || valor.toUpperCase();
  }

  private mapearEstadoCivilParaBackend(valor: string | null): string | null {
    if (!valor) {
      return null;
    }
    const estadoCivilMap: Record<string, string> = {
      'Soltero(a)': 'SOLTERO',
      'Casado(a)': 'CASADO',
      'Divorciado(a)': 'DIVORCIADO',
      'Viudo(a)': 'VIUDO',
      'Unión Libre': 'UNION_LIBRE'
    };
    return estadoCivilMap[valor] || valor.replace(/\(a\)/g, '').toUpperCase().replace(/\s+/g, '_');
  }

  private payloadTieneDatos(payload: Record<string, unknown>): boolean {
    return Object.values(payload).some((valor) => {
      if (valor === null || valor === undefined) {
        return false;
      }
      if (typeof valor === 'string') {
        return valor.trim().length > 0;
      }
      if (typeof valor === 'boolean') {
        return valor;
      }
      if (typeof valor === 'number') {
        return !Number.isNaN(valor) && valor !== 0;
      }
      if (Array.isArray(valor)) {
        return valor.length > 0;
      }
      if (typeof valor === 'object') {
        return Object.keys(valor as Record<string, unknown>).length > 0;
      }
      return true;
    });
  }
  private saveDraft(): void {
    const rawData = this.form.getRawValue();
    const dataToStore: any = { ...rawData };
    ['cvFile', 'fiscalPdf', 'domicilio', 'cert1', 'cert2', 'divulg_archivo', 'acad_constancia_snii', 'idioma_cert_documento', 'estancia_documento'].forEach(f => delete dataToStore[f]);
    dataToStore['_autoresList'] = this.autoresList;
    dataToStore['_articulosCientificosList'] = this.articulosCientificosList;
    dataToStore['_editingArticuloIndex'] = this.editingArticuloIndex;
    dataToStore['_congresosList'] = this.congresosList;
    dataToStore['_acadGradosList'] = this.acadGradosList;
    dataToStore['_editingGradoIndex'] = this.editingGradoIndex;
    dataToStore['_cursosImpartidosList'] = this.cursosImpartidosList;
    dataToStore['_editingCursoIndex'] = this.editingCursoIndex;
    dataToStore['_idiomasDominioList'] = this.idiomasDominioList.map((item) => ({
      ...item,
      certDocumento: null
    }));
    dataToStore['_editingIdiomaIndex'] = this.editingIdiomaIndex;
    dataToStore['_estanciasInvestigacionList'] = this.estanciasInvestigacionList;
    dataToStore['_editingEstanciaIndex'] = this.editingEstanciaIndex;
    dataToStore['_divulgacionesCientificasList'] = this.divulgacionesCientificasList.map((item) => ({
      ...item,
      evidenciaArchivo: null
    }));
    dataToStore['_editingDivulgacionIndex'] = this.editingDivulgacionIndex;
    dataToStore['_logrosReconocimientosList'] = this.logrosReconocimientosList;
    dataToStore['_editingLogroIndex'] = this.editingLogroIndex;
    sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToStore));
  }

  private loadDraft(): void {
    const saved = sessionStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const savedData = JSON.parse(saved);
        if (Array.isArray(savedData['_autoresList']) && savedData['_autoresList'].length > 0) {
          this.autoresList = savedData['_autoresList'];
        }
        delete savedData['_autoresList'];
        if (Array.isArray(savedData['_articulosCientificosList']) && savedData['_articulosCientificosList'].length > 0) {
          this.articulosCientificosList = savedData['_articulosCientificosList'];
        }
        delete savedData['_articulosCientificosList'];
        this.editingArticuloIndex = savedData['_editingArticuloIndex'] ?? null;
        delete savedData['_editingArticuloIndex'];
        if (Array.isArray(savedData['_congresosList']) && savedData['_congresosList'].length > 0) {
          this.congresosList = savedData['_congresosList'];
        }
        delete savedData['_congresosList'];
        if (Array.isArray(savedData['_acadGradosList']) && savedData['_acadGradosList'].length > 0) {
          this.acadGradosList = savedData['_acadGradosList'];
        }
        delete savedData['_acadGradosList'];
        this.editingGradoIndex = savedData['_editingGradoIndex'] ?? null;
        delete savedData['_editingGradoIndex'];
        if (Array.isArray(savedData['_cursosImpartidosList']) && savedData['_cursosImpartidosList'].length > 0) {
          this.cursosImpartidosList = savedData['_cursosImpartidosList'];
        }
        delete savedData['_cursosImpartidosList'];
        this.editingCursoIndex = savedData['_editingCursoIndex'] ?? null;
        delete savedData['_editingCursoIndex'];
        if (Array.isArray(savedData['_idiomasDominioList']) && savedData['_idiomasDominioList'].length > 0) {
          this.idiomasDominioList = savedData['_idiomasDominioList'].map((item: any) => this.normalizarIdioma(item));
        }
        delete savedData['_idiomasDominioList'];
        this.editingIdiomaIndex = savedData['_editingIdiomaIndex'] ?? null;
        delete savedData['_editingIdiomaIndex'];
        if (Array.isArray(savedData['_estanciasInvestigacionList']) && savedData['_estanciasInvestigacionList'].length > 0) {
          this.estanciasInvestigacionList = savedData['_estanciasInvestigacionList'];
        }
        delete savedData['_estanciasInvestigacionList'];
        this.editingEstanciaIndex = savedData['_editingEstanciaIndex'] ?? null;
        delete savedData['_editingEstanciaIndex'];
        if (Array.isArray(savedData['_divulgacionesCientificasList']) && savedData['_divulgacionesCientificasList'].length > 0) {
          this.divulgacionesCientificasList = savedData['_divulgacionesCientificasList'].map((item: any) => ({
            titulo: (item?.titulo || '').toString(),
            tipoDivulgacionNombre: (item?.tipoDivulgacionNombre || '').toString(),
            medioNombre: (item?.medioNombre || '').toString(),
            dirigidoA: (item?.dirigidoA || '').toString(),
            productoObtenidoNombre: (item?.productoObtenidoNombre || '').toString(),
            fecha: (item?.fecha || '').toString(),
            institucionOrganizadora: (item?.institucionOrganizadora || '').toString(),
            evidenciaTipo: item?.evidenciaTipo === 'LINK' ? 'LINK' : 'PDF',
            evidenciaLink: (item?.evidenciaLink || '').toString(),
            evidenciaArchivo: null,
            evidenciaArchivoNombre: (item?.evidenciaArchivoNombre || '').toString()
          }));
        }
        delete savedData['_divulgacionesCientificasList'];
        this.editingDivulgacionIndex = savedData['_editingDivulgacionIndex'] ?? null;
        delete savedData['_editingDivulgacionIndex'];
        if (Array.isArray(savedData['_logrosReconocimientosList']) && savedData['_logrosReconocimientosList'].length > 0) {
          this.logrosReconocimientosList = savedData['_logrosReconocimientosList'];
        }
        delete savedData['_logrosReconocimientosList'];
        this.editingLogroIndex = savedData['_editingLogroIndex'] ?? null;
        delete savedData['_editingLogroIndex'];
        this.form.patchValue(savedData);
        // Asegurar que los campos de fecha estén correctamente inicializados
        // después de cargar el borrador
        const camposFecha = [
          'curso_fecha_inicio', 'curso_fecha_fin',
          'estancia_fecha_inicio', 'estancia_fecha_fin',
          'tray_prof_fecha_inicio', 'tray_prof_fecha_fin',
          'congreso_fecha', 'divulg_fecha'
        ];
        camposFecha.forEach(campo => {
          const control = this.form.get(campo);
          if (control) {
            const valor = control.value;
            // Validar formato de fecha (YYYY-MM-DD)
            if (valor && typeof valor === 'string' && valor.length > 0) {
              const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
              if (!fechaRegex.test(valor)) {
                // Si no es un formato válido, limpiar el campo
                control.setValue('', { emitEvent: false });
              }
            }
          }
        });
      } catch (e) {
        // Si hay error al parsear, limpiar el sessionStorage
        sessionStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  onFileChange(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const esPdf = (file.type || '').toLowerCase().includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
      if (!esPdf) {
        Swal.fire({
          icon: 'error',
          title: 'Formato no permitido',
          text: 'Solo se permiten archivos PDF',
          confirmButtonColor: '#800020'
        });
        input.value = '';
        return;
      }
      if (file.size > MAX_BYTES) {
        Swal.fire({
          icon: 'error',
          title: 'Archivo muy grande',
          text: `El archivo excede el tamaño máximo permitido de ${MAX_MB}MB`,
          confirmButtonColor: '#800020'
        });
        return;
      }
      this.form.patchValue({ [controlName]: file });
      Swal.fire({
        icon: 'success',
        title: 'Archivo cargado',
        text: `${file.name} se cargó correctamente`,
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  }

  /**
   * 🚀 ENVÍO FINAL (INYECCIÓN)
   */
  async submitFinal(ev?: Event): Promise<void> {
    ev?.preventDefault();
    this.errorMsg = '';
    this.okMsg = '';

    // Verificar autenticación antes de continuar
    if (!this.authService.isLoggedIn()) {
      Swal.fire({
        icon: 'warning',
        title: 'Sesión expirada',
        text: 'Por favor, inicia sesión nuevamente para completar tu registro',
        confirmButtonColor: '#800020',
        confirmButtonText: 'Ir al login'
      }).then(() => {
        this.router.navigate(['/login']);
      });
      return;
    }

    // Actualizar validaciones condicionales antes de validar
    this.sincronizarGradosAcademicosAntesDeEnviar();
    this.sincronizarCursosAntesDeEnviar();
    this.sincronizarIdiomasAntesDeEnviar();
    this.sincronizarEstanciasAntesDeEnviar();
    this.sincronizarArticulosAntesDeEnviar();
    this.sincronizarDivulgacionesAntesDeEnviar();
    this.sincronizarLogrosAntesDeEnviar();
    this.actualizarValidacionesCondicionales();
    
    const primeraSeccionIncompleta = this.seccionesObligatorias.find(
      seccion => this.getSectionProgress(seccion) < 100
    );
    if (primeraSeccionIncompleta) {
      await this.setView(primeraSeccionIncompleta);
      await this.validarSeccionCompletaAntesDeGuardar(primeraSeccionIncompleta);
      return;
    }

    this.submitting.set(true);
    this.reiniciarProgresoEnvio();
    this.actualizarProgresoEnvio(10, 'Validando tu sesión', 'Estamos preparando la información para guardarla.');

    void this.finalizarRegistroPersistido();
  }

  private async finalizarRegistroPersistido(): Promise<void> {
    try {
      this.actualizarProgresoEnvio(30, 'Guardando la última sección', 'Estamos registrando tus logros y reconocimientos.');
      const seccionGuardada = await this.guardarSeccionActualAntesDeNavegar(this.view(), this.view(), true);
      if (!seccionGuardada) {
        return;
      }

      this.actualizarProgresoEnvio(75, 'Finalizando tu registro', 'Validando la información que ya está guardada.');
      await firstValueFrom(
        this.http.post(environment.apiBaseUrl + '/usuarios/me/completar-registro/finalizar', {})
      );

      this.actualizarProgresoEnvio(100, 'Registro completado', 'Tu información se guardó correctamente.');
      sessionStorage.removeItem(this.STORAGE_KEY);
      this.authService.me().subscribe();
      await Swal.fire({
        icon: 'success',
        title: '¡Registro completado!',
        text: 'Su información ha sido guardada exitosamente.',
        confirmButtonColor: '#800020',
        confirmButtonText: 'Ir a mi perfil'
      });
      this.router.navigate(['/app/perfil']);
    } catch (error: any) {
      const seccionesFaltantes = Array.isArray(error?.error?.seccionesFaltantes)
        ? error.error.seccionesFaltantes
        : [];
      const primeraSeccion = error?.error?.primeraSeccion as View | undefined;
      if (seccionesFaltantes.length > 0 && primeraSeccion) {
        const nombres = seccionesFaltantes
          .map((item: any) => item?.nombre)
          .filter((nombre: unknown) => typeof nombre === 'string' && nombre.length > 0);
        await Swal.fire({
          icon: 'warning',
          title: 'Revisa las secciones pendientes',
          text: 'Falta guardar o completar: ' + nombres.join(', ') + '.',
          confirmButtonColor: '#800020',
          confirmButtonText: 'Ir a revisar'
        });
        await this.setView(primeraSeccion);
        return;
      }
      const mensaje = error?.error?.message || error?.message || 'No se pudo finalizar el registro.';
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo completar el registro',
        text: mensaje,
        confirmButtonColor: '#800020'
      });
    } finally {
      this.submitting.set(false);
      this.reiniciarProgresoEnvio();
    }
  }
  private actualizarEstadoProgreso(valor: number, badge: string, title: string, label: string, detail: string): void {
    this.submitProgress.set(Math.max(0, Math.min(100, Math.round(valor))));
    this.submitProgressBadge.set(badge);
    this.submitProgressTitle.set(title);
    this.submitProgressLabel.set(label);
    this.submitProgressDetails.set(detail);
  }

  private actualizarProgresoEnvio(valor: number, titulo: string, detalle: string): void {
    this.actualizarEstadoProgreso(valor, 'Guardando', 'Procesando registro', titulo, detalle);
  }

  private actualizarProgresoMigracion(valor: number, titulo: string, detalle: string): void {
    this.actualizarEstadoProgreso(valor, 'Migración', 'Cargando archivo JSON', titulo, detalle);
  }

  private reiniciarProgresoEnvio(): void {
    this.submitProgress.set(0);
    this.submitProgressBadge.set('Guardando');
    this.submitProgressTitle.set('Procesando registro');
    this.submitProgressLabel.set('Preparando información del registro...');
    this.submitProgressDetails.set('Validando y organizando los datos antes de enviarlos.');
  }

  private finalizarProgresoMigracion(): void {
    this.processingMigration.set(false);
    this.reiniciarProgresoEnvio();
  }

  private getFormValidationErrors() {
    const errors: any = {};
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      if (control?.invalid) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  get f() { return this.form.controls; }

  /**
   * Muestra ayuda contextual según el tipo solicitado
   */
  mostrarAyuda(tipo: string): void {
    const ayudas: { [key: string]: { title: string; html: string } } = {
      'area': {
        title: 'Área principal *',
        html: `
          <p><strong>¿Qué es el área principal?</strong></p>
          <p>El área principal es el nivel más amplio de clasificación según el catálogo SECIHTI. Es un campo <strong>obligatorio</strong>.</p>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>📝 Nombre del área de conocimiento:</strong></p>
          <p>Ingresa el nombre completo del área principal según el catálogo SECIHTI.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Ciencias Físico-Matemáticas y de las Ingenierías</li>
            <li>Ciencias Sociales</li>
            <li>Humanidades y Ciencias de la Conducta</li>
            <li>Ciencias Biológicas y de la Salud</li>
          </ul>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>🔑 Código del área:</strong></p>
          <p>Ingresa el código numérico asignado al área según el catálogo SECIHTI.</p>
          <p><strong>Ejemplo:</strong> 1, 2, 3, etc.</p>
          <p>Este código identifica de manera única el área principal.</p>
        `
      },
      'area-nombre': {
        title: 'Nombre del área de conocimiento',
        html: `
          <p>Ingresa el nombre completo del área principal según el catálogo SECIHTI.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Ciencias Físico-Matemáticas y de las Ingenierías</li>
            <li>Ciencias Sociales</li>
            <li>Humanidades y Ciencias de la Conducta</li>
          </ul>
        `
      },
      'area-codigo': {
        title: 'Código del área',
        html: `
          <p>Ingresa el código numérico asignado al área según el catálogo SECIHTI.</p>
          <p><strong>Ejemplo:</strong> 1, 2, 3, etc.</p>
          <p>Este código identifica de manera única el área principal.</p>
        `
      },
      'campo': {
        title: 'Campo (Opcional)',
        html: `
          <p><strong>¿Qué es el campo?</strong></p>
          <p>El campo es un nivel específico dentro del área principal. Es un campo <strong>opcional</strong> que te permite especificar tu área de estudio.</p>
          <p><strong>Ejemplo:</strong></p>
          <p>Si tu área principal es "Ciencias Físico-Matemáticas y de las Ingenierías", tu campo podría ser "Informática" o "Ciencias de la Computación".</p>
        `
      },
      'campo-nombre': {
        title: 'Nombre del campo de estudio',
        html: `
          <p>Ingresa el nombre del campo específico dentro del área principal.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Ciencias de la Computación</li>
            <li>Informática</li>
            <li>Matemáticas Aplicadas</li>
          </ul>
        `
      },
      'campo-codigo': {
        title: 'Código del campo',
        html: `
          <p>Ingresa el código identificador del campo según el catálogo SECIHTI.</p>
          <p><strong>Ejemplo:</strong> 1.1, 1.2, 2.1, etc.</p>
          <p>El código generalmente sigue el formato: [Código del área].[Número del campo]</p>
        `
      },
      'disciplina': {
        title: 'Disciplina (Opcional)',
        html: `
          <p><strong>¿Qué es la disciplina?</strong></p>
          <p>La disciplina es un nivel más específico dentro del campo. Es un campo <strong>opcional</strong>.</p>
          <p><strong>Ejemplo:</strong></p>
          <p>Si tu campo es "Informática", tu disciplina podría ser "Inteligencia Artificial" o "Sistemas Distribuidos".</p>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>📝 Nombre de la disciplina:</strong></p>
          <p>Ingresa el nombre de la disciplina específica dentro del campo.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Inteligencia Artificial</li>
            <li>Sistemas Distribuidos</li>
            <li>Bases de Datos</li>
            <li>Redes de Computadoras</li>
          </ul>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>🔑 Código de la disciplina:</strong></p>
          <p>Ingresa el código identificador de la disciplina según el catálogo SECIHTI.</p>
          <p><strong>Ejemplo:</strong> 1.1.1, 1.1.2, etc.</p>
          <p>El código generalmente sigue el formato: [Área].[Campo].[Disciplina]</p>
        `
      },
      'disciplina-nombre': {
        title: 'Nombre de la disciplina',
        html: `
          <p>Ingresa el nombre de la disciplina específica dentro del campo.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Inteligencia Artificial</li>
            <li>Sistemas Distribuidos</li>
            <li>Bases de Datos</li>
            <li>Redes de Computadoras</li>
          </ul>
        `
      },
      'disciplina-codigo': {
        title: 'Código de la disciplina',
        html: `
          <p>Ingresa el código identificador de la disciplina según el catálogo SECIHTI.</p>
          <p><strong>Ejemplo:</strong> 1.1.1, 1.1.2, etc.</p>
          <p>El código generalmente sigue el formato: [Área].[Campo].[Disciplina]</p>
        `
      },
      'subdisciplina': {
        title: 'Subdisciplina (Opcional)',
        html: `
          <p><strong>¿Qué es la subdisciplina?</strong></p>
          <p>La subdisciplina es el nivel más específico de clasificación. Es un campo <strong>opcional</strong>.</p>
          <p><strong>Ejemplo:</strong></p>
          <p>Si tu disciplina es "Inteligencia Artificial", tu subdisciplina podría ser "Procesamiento de Lenguaje Natural" o "Aprendizaje Automático".</p>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>📝 Nombre de la subdisciplina:</strong></p>
          <p>Ingresa el nombre de la subdisciplina más específica dentro de la disciplina.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Procesamiento de Lenguaje Natural</li>
            <li>Aprendizaje Automático</li>
            <li>Visión por Computadora</li>
            <li>Robótica</li>
          </ul>
          
          <hr style="margin: 20px 0; border-color: #e5e7eb;">
          
          <p><strong>🔑 Código de la subdisciplina:</strong></p>
          <p>Ingresa el código identificador de la subdisciplina según el catálogo SECIHTI.</p>
          <p><strong>Ejemplo:</strong> 1.1.1.1, 1.1.1.2, etc.</p>
          <p>El código generalmente sigue el formato: [Área].[Campo].[Disciplina].[Subdisciplina]</p>
        `
      },
      'subdisciplina-nombre': {
        title: 'Nombre de la subdisciplina',
        html: `
          <p>Ingresa el nombre de la subdisciplina más específica dentro de la disciplina.</p>
          <p><strong>Ejemplos:</strong></p>
          <ul>
            <li>Procesamiento de Lenguaje Natural</li>
            <li>Aprendizaje Automático</li>
            <li>Visión por Computadora</li>
            <li>Robótica</li>
          </ul>
        `
      },
      'subdisciplina-codigo': {
        title: 'Código de la subdisciplina',
        html: `
          <p>Ingresa el código identificador de la subdisciplina según el catálogo SECIHTI.</p>
          <p><strong>Ejemplo:</strong> 1.1.1.1, 1.1.1.2, etc.</p>
          <p>El código generalmente sigue el formato: [Área].[Campo].[Disciplina].[Subdisciplina]</p>
        `
      }
    };

    const ayuda = ayudas[tipo];
    if (ayuda) {
      Swal.fire({
        title: ayuda.title,
        html: ayuda.html,
        icon: 'info',
        confirmButtonColor: '#800020',
        confirmButtonText: 'Entendido',
        width: '600px'
      });
    }
  }

  // --- AUTORES DINÁMICOS ---
  agregarAutor(): void {
    this.autoresList.push({ nombre: '', orcid: '', orden: this.autoresList.length + 1 });
  }

  eliminarAutor(index: number): void {
    if (this.autoresList.length > 1) {
      this.autoresList.splice(index, 1);
      this.autoresList.forEach((a, i) => a.orden = i + 1);
    }
  }

  trackByAutorIndex(index: number): number {
    return index;
  }

  agregarArticuloCientifico(): void {
    const baseValido = this.validarCamposBaseArticulo();
    if (!baseValido) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Completa los datos del artículo',
        text: 'Título, revista, rol y estado son obligatorios para agregar la aportación.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    const articulo = this.obtenerArticuloDesdeFormulario();
    if (this.editingArticuloIndex !== null && this.editingArticuloIndex >= 0) {
      this.articulosCientificosList.splice(this.editingArticuloIndex, 1);
      this.editingArticuloIndex = null;
    }
    this.articulosCientificosList = [articulo, ...this.articulosCientificosList];
    this.limpiarFormularioArticuloCientifico();
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  editarArticuloCientifico(index: number): void {
    const articulo = this.articulosCientificosList[index];
    if (!articulo) return;
    this.editingArticuloIndex = index;
    this.form.patchValue({
      art_id_externo: articulo.idExterno || '',
      art_eje: articulo.eje || '',
      art_tipo: articulo.tipo || '',
      art_producto_principal: !!articulo.productoPrincipal,
      art_anio: articulo.anio ?? null,
      art_issn: articulo.issn || '',
      art_issn_electronico: articulo.issnElectronico || '',
      art_doi: articulo.doi || '',
      art_nombre_revista: articulo.nombreRevista || '',
      art_titulo: articulo.titulo || '',
      art_rol_part_nombre: articulo.rolParticipacionNombre || '',
      art_estado_nombre: articulo.estadoNombre || 'Publicado',
      art_objetivo_nombre: articulo.objetivoNombre || '',
      art_recibio_apoyo_SECIHTI: !!articulo.recibioApoyoSECIHTI,
      art_fondo_prog_nombre: articulo.fondoProgramaNombre || '',
      art_total_citas: articulo.totalCitas ?? 0
    });

    this.autoresList = articulo.autores.length > 0
      ? articulo.autores.map((a, idx) => ({
          nombre: a.nombre || '',
          orcid: a.orcid || '',
          orden: Number(a.orden) > 0 ? Number(a.orden) : idx + 1
        }))
      : [{ nombre: '', orcid: '', orden: 1 }];

    const primerAutor = this.autoresList[0];
    this.form.patchValue({
      art_autor_nombre_completo: primerAutor?.nombre || '',
      art_autor_orcid: primerAutor?.orcid || '',
      art_autor_orden: primerAutor?.orden ?? 1
    }, { emitEvent: false });

    this.actualizarValidacionesCondicionales();
  }

  eliminarArticuloCientifico(index: number): void {
    if (index < 0 || index >= this.articulosCientificosList.length) return;
    this.articulosCientificosList.splice(index, 1);

    if (this.editingArticuloIndex === index) {
      this.editingArticuloIndex = null;
      this.limpiarFormularioArticuloCientifico();
    } else if (this.editingArticuloIndex !== null && this.editingArticuloIndex > index) {
      this.editingArticuloIndex -= 1;
    }

    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  cancelarEdicionArticuloCientifico(): void {
    this.editingArticuloIndex = null;
    this.limpiarFormularioArticuloCientifico();
    this.actualizarValidacionesCondicionales();
  }

  trackByArticuloCientificoIndex(index: number): number {
    return index;
  }

  // --- CONGRESOS DINÁMICOS ---
  agregarCongreso(): void {
    this.congresosList = [
      { nombre: '', tituloTrabajo: '', tipoParticipacion: '', tipoParticipacionManual: '', fecha: '', paisSede: '', paisSedeManual: '', productoPrincipal: false },
      ...this.congresosList
    ];
  }

  eliminarCongreso(index: number): void {
    if (this.congresosList.length > 1) {
      this.congresosList.splice(index, 1);
    }
  }

  trackByCongresoIndex(index: number): number {
    return index;
  }

  agregarDivulgacionCientifica(): void {
    const baseValido = this.validarCamposBaseDivulgacion();
    if (!baseValido) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Completa los datos de divulgación',
        text: 'Tipo, medio, título, fecha, producto y evidencia son obligatorios.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    const divulgacion = this.obtenerDivulgacionDesdeFormulario();
    if (this.editingDivulgacionIndex !== null && this.editingDivulgacionIndex >= 0) {
      this.divulgacionesCientificasList.splice(this.editingDivulgacionIndex, 1);
      this.editingDivulgacionIndex = null;
    }
    this.divulgacionesCientificasList = [divulgacion, ...this.divulgacionesCientificasList];
    this.limpiarFormularioDivulgacion();
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  editarDivulgacionCientifica(index: number): void {
    const divulgacion = this.divulgacionesCientificasList[index];
    if (!divulgacion) return;
    this.editingDivulgacionIndex = index;
    this.form.patchValue({
      divulg_titulo: divulgacion.titulo || '',
      divulg_tipo_div_nombre: divulgacion.tipoDivulgacionNombre || '',
      divulg_medio_nombre: divulgacion.medioNombre || '',
      divulg_dirigido_a: divulgacion.dirigidoA || '',
      divulg_prod_obtenido_nombre: divulgacion.productoObtenidoNombre || '',
      divulg_fecha: divulgacion.fecha || '',
      divulg_institucion_organizadora: divulgacion.institucionOrganizadora || '',
      divulg_evidencia_link: divulgacion.evidenciaTipo === 'LINK' ? (divulgacion.evidenciaLink || '') : '',
      divulg_archivo: divulgacion.evidenciaTipo === 'PDF' ? (divulgacion.evidenciaArchivo ?? null) : null
    });
    this.actualizarValidacionesCondicionales();
  }

  eliminarDivulgacionCientifica(index: number): void {
    if (index < 0 || index >= this.divulgacionesCientificasList.length) return;
    this.divulgacionesCientificasList.splice(index, 1);
    if (this.editingDivulgacionIndex === index) {
      this.editingDivulgacionIndex = null;
      this.limpiarFormularioDivulgacion();
    } else if (this.editingDivulgacionIndex !== null && this.editingDivulgacionIndex > index) {
      this.editingDivulgacionIndex -= 1;
    }
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  cancelarEdicionDivulgacionCientifica(): void {
    this.editingDivulgacionIndex = null;
    this.limpiarFormularioDivulgacion();
    this.actualizarValidacionesCondicionales();
  }

  trackByDivulgacionCientificaIndex(index: number): number {
    return index;
  }

  agregarLogroReconocimiento(): void {
    const baseValido = this.validarCamposBaseLogro();
    if (!baseValido) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Completa los datos del logro',
        text: 'Nombre del logro y año son obligatorios.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    const logro = this.obtenerLogroDesdeFormulario();
    if (this.editingLogroIndex !== null && this.editingLogroIndex >= 0) {
      this.logrosReconocimientosList.splice(this.editingLogroIndex, 1);
      this.editingLogroIndex = null;
    }
    this.logrosReconocimientosList = [logro, ...this.logrosReconocimientosList];
    this.limpiarFormularioLogro();
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  editarLogroReconocimiento(index: number): void {
    const logro = this.logrosReconocimientosList[index];
    if (!logro) return;
    this.editingLogroIndex = index;
    this.form.patchValue({
      logro_tipo: logro.tipo || '',
      logro_nombre: logro.nombre || '',
      logro_anio: logro.anio ?? null
    });
    this.actualizarValidacionesCondicionales();
  }

  eliminarLogroReconocimiento(index: number): void {
    if (index < 0 || index >= this.logrosReconocimientosList.length) return;
    this.logrosReconocimientosList.splice(index, 1);
    if (this.editingLogroIndex === index) {
      this.editingLogroIndex = null;
      this.limpiarFormularioLogro();
    } else if (this.editingLogroIndex !== null && this.editingLogroIndex > index) {
      this.editingLogroIndex -= 1;
    }
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  cancelarEdicionLogroReconocimiento(): void {
    this.editingLogroIndex = null;
    this.limpiarFormularioLogro();
    this.actualizarValidacionesCondicionales();
  }

  trackByLogroReconocimientoIndex(index: number): number {
    return index;
  }

  agregarIdiomaDominio(): void {
    if (!this.validarCamposBaseIdioma(true)) {
      Swal.fire({
        icon: 'warning',
        title: 'Completa los datos del idioma',
        text: 'El idioma y su dominio son obligatorios. Si indicas una certificación, completa también sus datos y el documento cuando corresponda.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    const idioma = this.obtenerIdiomaDesdeFormulario();
    const duplicado = this.idiomasDominioList.findIndex((item, index) =>
      index !== this.editingIdiomaIndex && item.nombre.localeCompare(idioma.nombre, 'es', { sensitivity: 'base' }) === 0
    );
    if (duplicado >= 0) {
      Swal.fire({
        icon: 'info',
        title: 'Idioma ya registrado',
        text: 'Ese idioma ya está en la lista. Puedes editarlo para actualizar su nivel o certificación.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    if (this.editingIdiomaIndex !== null && this.editingIdiomaIndex >= 0) {
      this.idiomasDominioList.splice(this.editingIdiomaIndex, 1);
      this.editingIdiomaIndex = null;
    }
    this.idiomasDominioList = [idioma, ...this.idiomasDominioList];
    this.limpiarFormularioIdioma();
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  editarIdiomaDominio(index: number): void {
    const idioma = this.idiomasDominioList[index];
    if (!idioma) return;

    this.editingIdiomaIndex = index;
    const documento = idioma.certDocumento instanceof File
      ? idioma.certDocumento
      : idioma.certDocumentoPersistido
        ? { persisted: true, name: idioma.certDocumentoNombre || 'Certificado guardado' }
        : null;
    this.form.patchValue({
      idioma_nombre: idioma.nombre,
      idioma_dominio_nombre: idioma.dominioNombre,
      idioma_conversacion: idioma.conversacion,
      idioma_lectura: idioma.lectura,
      idioma_escritura: idioma.escritura,
      idioma_es_certificado: idioma.esCertificado,
      idioma_cert_institucion: idioma.certInstitucion,
      idioma_cert_puntuacion: idioma.certPuntuacion,
      idioma_vigencia_fin: idioma.vigenciaFin,
      idioma_cert_documento: documento
    });
    this.actualizarValidacionesCondicionales();
  }

  eliminarIdiomaDominio(index: number): void {
    if (index < 0 || index >= this.idiomasDominioList.length) return;
    this.idiomasDominioList.splice(index, 1);
    if (this.editingIdiomaIndex === index) {
      this.editingIdiomaIndex = null;
      this.limpiarFormularioIdioma();
    } else if (this.editingIdiomaIndex !== null && this.editingIdiomaIndex > index) {
      this.editingIdiomaIndex -= 1;
    }
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  cancelarEdicionIdiomaDominio(): void {
    this.editingIdiomaIndex = null;
    this.limpiarFormularioIdioma();
    this.actualizarValidacionesCondicionales();
  }

  trackByIdiomaDominioIndex(index: number): number {
    return index;
  }
  agregarCursoImpartido(): void {
    const baseValido = this.validarCamposBaseCursoImpartido();
    if (!baseValido) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Completa los datos del curso',
        text: 'Nombre, programa, horas, fecha de inicio, institución y nivel son obligatorios.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    const curso = this.obtenerCursoDesdeFormulario();
    if (this.editingCursoIndex !== null && this.editingCursoIndex >= 0) {
      this.cursosImpartidosList.splice(this.editingCursoIndex, 1);
      this.editingCursoIndex = null;
    }
    this.cursosImpartidosList = [curso, ...this.cursosImpartidosList];
    this.limpiarFormularioCursoImpartido();
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  editarCursoImpartido(index: number): void {
    const curso = this.cursosImpartidosList[index];
    if (!curso) return;
    this.editingCursoIndex = index;
    this.cursoNivelManual = this.obtenerTextoManualDesdeValor(curso.nivelEscolaridad || '', this.opcionesNivelCurso);
    this.form.patchValue({
      curso_nombre: curso.nombre || '',
      curso_programa: curso.programa || '',
      curso_horas_totales: curso.horasTotales ?? 0,
      curso_fecha_inicio: curso.fechaInicio || '',
      curso_fecha_fin: curso.fechaFin || '',
      curso_institucion: curso.institucion || '',
      curso_nivel_escolaridad: this.obtenerValorSelectConOtro(curso.nivelEscolaridad || '', this.opcionesNivelCurso),
      curso_producto_principal: !!curso.productoPrincipal,
    });
    this.actualizarValidacionesCondicionales();
  }

  eliminarCursoImpartido(index: number): void {
    if (index < 0 || index >= this.cursosImpartidosList.length) return;
    this.cursosImpartidosList.splice(index, 1);
    if (this.editingCursoIndex === index) {
      this.editingCursoIndex = null;
      this.limpiarFormularioCursoImpartido();
    } else if (this.editingCursoIndex !== null && this.editingCursoIndex > index) {
      this.editingCursoIndex -= 1;
    }
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  cancelarEdicionCursoImpartido(): void {
    this.editingCursoIndex = null;
    this.limpiarFormularioCursoImpartido();
    this.actualizarValidacionesCondicionales();
  }

  trackByCursoImpartidoIndex(index: number): number {
    return index;
  }

  agregarEstanciaInvestigacion(): void {
    const baseValido = this.validarCamposBaseEstancia();
    if (!baseValido) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Completa los datos de la estancia',
        text: 'Nombre, tipo, fecha de inicio e institución receptora son obligatorios.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    const estancia = this.obtenerEstanciaDesdeFormulario();
    if (this.editingEstanciaIndex !== null && this.editingEstanciaIndex >= 0) {
      this.estanciasInvestigacionList.splice(this.editingEstanciaIndex, 1);
      this.editingEstanciaIndex = null;
    }
    this.estanciasInvestigacionList = [estancia, ...this.estanciasInvestigacionList];
    this.limpiarFormularioEstancia();
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  editarEstanciaInvestigacion(index: number): void {
    const estancia = this.estanciasInvestigacionList[index];
    if (!estancia) return;
    this.editingEstanciaIndex = index;
    this.estanciaTipoManual = this.obtenerTextoManualDesdeValor(estancia.tipoNombre || '', this.opcionesTipoEstancia);
    this.form.patchValue({
      estancia_nombre_proyecto: estancia.nombreProyecto || '',
      estancia_tipo_nombre: this.obtenerValorSelectConOtro(estancia.tipoNombre || '', this.opcionesTipoEstancia),
      estancia_logros: estancia.logros || '',
      estancia_fecha_inicio: estancia.fechaInicio || '',
      estancia_fecha_fin: estancia.fechaFin || '',
      estancia_institucion_receptora: estancia.institucionReceptora || '',
    });
    this.actualizarValidacionesCondicionales();
  }

  eliminarEstanciaInvestigacion(index: number): void {
    if (index < 0 || index >= this.estanciasInvestigacionList.length) return;
    this.estanciasInvestigacionList.splice(index, 1);
    if (this.editingEstanciaIndex === index) {
      this.editingEstanciaIndex = null;
      this.limpiarFormularioEstancia();
    } else if (this.editingEstanciaIndex !== null && this.editingEstanciaIndex > index) {
      this.editingEstanciaIndex -= 1;
    }
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  cancelarEdicionEstanciaInvestigacion(): void {
    this.editingEstanciaIndex = null;
    this.limpiarFormularioEstancia();
    this.actualizarValidacionesCondicionales();
  }

  trackByEstanciaInvestigacionIndex(index: number): number {
    return index;
  }

  agregarGradoAcademico(): void {
    const baseValido = this.validarCamposBaseGradoAcademico();
    if (!baseValido) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Completa los datos del grado',
        text: 'Nivel, título y estatus son obligatorios para agregar el grado.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    const grado = this.obtenerGradoAcademicoDesdeFormulario();
    if (this.editingGradoIndex !== null && this.editingGradoIndex >= 0) {
      this.acadGradosList.splice(this.editingGradoIndex, 1);
      this.editingGradoIndex = null;
    }
    this.acadGradosList = [grado, ...this.acadGradosList];
    this.limpiarFormularioGradoAcademico();
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  editarGradoAcademico(index: number): void {
    const grado = this.acadGradosList[index];
    if (!grado) return;
    this.editingGradoIndex = index;
    this.acadEstatusManual = this.obtenerTextoManualDesdeValor(grado.estatusNombre || '', this.opcionesEstatusAcademico);
    this.form.patchValue({
      acad_nivel_nombre: grado.nivelNombre || '',
      acad_titulo: grado.titulo || '',
      acad_estatus_nombre: this.obtenerValorSelectConOtro(grado.estatusNombre || '', this.opcionesEstatusAcademico),
      acad_institucion: grado.institucion || '',
      acad_cedula_profesional: grado.cedulaProfesional || '',
      acad_opcion_titulacion: grado.opcionTitulacion || '',
      acad_titulo_tesis: grado.tituloTesis || '',
      acad_fecha_obtencion: grado.fechaObtencion || ''
    });
    this.actualizarValidacionesCondicionales();
  }

  eliminarGradoAcademico(index: number): void {
    if (index < 0 || index >= this.acadGradosList.length) return;
    this.acadGradosList.splice(index, 1);
    if (this.editingGradoIndex === index) {
      this.editingGradoIndex = null;
      this.limpiarFormularioGradoAcademico();
    } else if (this.editingGradoIndex !== null && this.editingGradoIndex > index) {
      this.editingGradoIndex -= 1;
    }
    this.actualizarValidacionesCondicionales();
    this.saveDraft();
  }

  cancelarEdicionGradoAcademico(): void {
    this.editingGradoIndex = null;
    this.limpiarFormularioGradoAcademico();
    this.actualizarValidacionesCondicionales();
  }

  trackByGradoAcademicoIndex(index: number): number {
    return index;
  }

  private hasMeaningfulValue(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    if (!control) return false;
    const value = control.value;
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim() !== '';
    if (value instanceof File) return true;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  }

  private isFieldComplete(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    if (!control) return false;
    return this.hasMeaningfulValue(fieldName) && control.valid;
  }

  private isConditionalFieldActive(fieldName: string): boolean {
    if (fieldName === 'inst_entidad_nombre') {
      return this.form.get('inst_pais_nombre')?.value === 'México';
    }
    if (fieldName === 'inst_municipio_nombre') {
      const pais = this.form.get('inst_pais_nombre')?.value;
      const entidad = (this.form.get('inst_entidad_nombre')?.value || '').toString().trim();
      return pais === 'México' && entidad !== '';
    }
    if (fieldName === 'inst_estado_usa') {
      return this.form.get('inst_pais_nombre')?.value === 'Estados Unidos';
    }
    if (fieldName === 'idioma_cert_institucion' || fieldName === 'idioma_cert_puntuacion') {
      const esCertificado = !!this.form.get('idioma_es_certificado')?.value;
      const dominio = this.form.get('idioma_dominio_nombre')?.value;
      return esCertificado && (dominio === 'Avanzado' || dominio === 'Excelente');
    }
    if (fieldName === 'idioma_cert_documento') {
      const dominio = this.form.get('idioma_dominio_nombre')?.value;
      return dominio === 'Excelente';
    }
    if (fieldName === 'art_fondo_prog_nombre') {
      return !!this.form.get('art_recibio_apoyo_SECIHTI')?.value;
    }
    if (fieldName === 'divulg_archivo') {
      const producto = this.form.get('divulg_prod_obtenido_nombre')?.value;
      return !!(producto && String(producto).trim() !== '' && !this.esProductoConEvidenciaLink(String(producto)));
    }
    if (fieldName === 'divulg_evidencia_link') {
      const producto = this.form.get('divulg_prod_obtenido_nombre')?.value;
      return !!(producto && this.esProductoConEvidenciaLink(String(producto)));
    }
    if (fieldName === 'acad_constancia_snii') {
      return !!this.form.get('acad_es_perfil_snii')?.value;
    }
    if (fieldName === 'tray_prof_fecha_fin') {
      return !this.form.get('tray_prof_es_actual')?.value;
    }
    return true;
  }

  // Métodos para mejorar UX
  getSectionProgress(section: View): number {
    if (section === 'trayectoria-academica') {
      const listaCompleta = this.acadGradosList.length > 0 && this.acadGradosList.every(grado =>
        !!(grado.nivelNombre?.trim() && grado.titulo?.trim() && grado.estatusNombre?.trim())
      );
      const edicionValida = this.editingGradoIndex === null || this.validarCamposBaseGradoAcademico();
      const tieneGrados = listaCompleta && edicionValida
        || (this.acadGradosList.length === 0 && this.validarCamposBaseGradoAcademico());
      let total = 2;
      let completos = 0;

      if (tieneGrados) completos++;
      if (this.isFieldComplete('cert1')) completos++;

      if (this.isConditionalFieldActive('acad_constancia_snii')) {
        total += 1;
        if (this.isFieldComplete('acad_constancia_snii')) completos++;
      }

      return Math.round((completos / total) * 100);
    }

    if (section === 'cursos') {
      const listaCompleta = this.cursosImpartidosList.length > 0 && this.cursosImpartidosList.every(curso =>
        !!(curso.nombre?.trim() && curso.programa?.trim() && Number(curso.horasTotales) >= 0
          && curso.fechaInicio?.trim() && curso.institucion?.trim() && curso.nivelEscolaridad?.trim())
      );
      const edicionValida = this.editingCursoIndex === null || this.validarCamposBaseCursoImpartido();
      const tieneCursos = listaCompleta && edicionValida
        || (this.cursosImpartidosList.length === 0 && this.validarCamposBaseCursoImpartido());
      return tieneCursos ? 100 : 0;
    }

    if (section === 'idiomas') {
      const listaCompleta = this.idiomasDominioList.length > 0 && this.idiomasDominioList.every(idioma => {
        if (!(idioma.nombre?.trim() && idioma.dominioNombre?.trim())) return false;
        const requiereCertificacion = idioma.dominioNombre === 'Excelente'
          || (idioma.dominioNombre === 'Avanzado' && idioma.esCertificado);
        if (!requiereCertificacion) return true;
        if (!(idioma.certInstitucion?.trim() && idioma.certPuntuacion?.trim())) return false;
        return idioma.dominioNombre !== 'Excelente'
          || idioma.certDocumento instanceof File
          || idioma.certDocumentoPersistido
          || !!this.archivosGuardados['idioma_cert_documento'];
      });
      const edicionValida = this.editingIdiomaIndex === null || this.validarCamposBaseIdioma(false);
      const tieneIdiomas = listaCompleta && edicionValida
        || (this.idiomasDominioList.length === 0 && this.validarCamposBaseIdioma(false));
      return tieneIdiomas ? 100 : 0;
    }

    if (section === 'estancias') {
      const listaCompleta = this.estanciasInvestigacionList.length > 0 && this.estanciasInvestigacionList.every(estancia =>
        !!(estancia.nombreProyecto?.trim() && estancia.tipoNombre?.trim()
          && estancia.fechaInicio?.trim() && estancia.institucionReceptora?.trim())
      );
      const edicionValida = this.editingEstanciaIndex === null || this.validarCamposBaseEstancia();
      const tieneEstancias = listaCompleta && edicionValida
        || (this.estanciasInvestigacionList.length === 0 && this.validarCamposBaseEstancia());
      return tieneEstancias ? 100 : 0;
    }

    if (section === 'aportaciones') {
      const listaCompleta = this.articulosCientificosList.length > 0 && this.articulosCientificosList.every(articulo =>
        !!(articulo.titulo?.trim() && articulo.nombreRevista?.trim()
          && articulo.rolParticipacionNombre?.trim() && articulo.estadoNombre?.trim()
          && (!articulo.recibioApoyoSECIHTI || articulo.fondoProgramaNombre?.trim()))
      );
      const edicionValida = this.editingArticuloIndex === null || this.validarCamposBaseArticulo();
      const tieneAportaciones = listaCompleta && edicionValida
        || (this.articulosCientificosList.length === 0 && this.validarCamposBaseArticulo());
      return tieneAportaciones ? 100 : 0;
    }

    if (section === 'divulgacion') {
      const listaCompleta = this.divulgacionesCientificasList.length > 0 && this.divulgacionesCientificasList.every(divulgacion => {
        if (!(divulgacion.titulo?.trim() && divulgacion.tipoDivulgacionNombre?.trim()
          && divulgacion.medioNombre?.trim() && divulgacion.fecha?.trim()
          && divulgacion.productoObtenidoNombre?.trim())) return false;
        if (this.esProductoConEvidenciaLink(divulgacion.productoObtenidoNombre)) {
          return /^https?:\/\/.+/i.test(divulgacion.evidenciaLink || '');
        }
        return divulgacion.evidenciaArchivo instanceof File
          || !!divulgacion.evidenciaArchivoNombre
          || !!this.archivosGuardados['divulg_archivo'];
      });
      const edicionValida = this.editingDivulgacionIndex === null || this.validarCamposBaseDivulgacion();
      const tieneDivulgaciones = listaCompleta && edicionValida
        || (this.divulgacionesCientificasList.length === 0 && this.validarCamposBaseDivulgacion());
      return tieneDivulgaciones ? 100 : 0;
    }

    if (section === 'logros') {
      const listaCompleta = this.logrosReconocimientosList.length > 0 && this.logrosReconocimientosList.every(logro =>
        !!(logro.nombre?.trim() && logro.anio !== null && logro.anio !== undefined)
      );
      const edicionValida = this.editingLogroIndex === null || this.validarCamposBaseLogro();
      const tieneLogros = listaCompleta && edicionValida
        || (this.logrosReconocimientosList.length === 0 && this.validarCamposBaseLogro());
      return tieneLogros ? 100 : 0;
    }

    // Congresos: dynamic list, check if at least one has data
    if (section === 'congresos') {
      const congresosConDatos = this.congresosList.filter(c => c.nombre && c.nombre.trim() !== '');
      if (congresosConDatos.length === 0) return 0;
      let totalFields = 0;
      let filledFields = 0;
      congresosConDatos.forEach(c => {
        totalFields += 4;
        if (c.nombre && c.nombre.trim()) filledFields++;
        if (c.tipoParticipacion && c.tipoParticipacion.trim()) filledFields++;
        if (c.fecha && c.fecha.trim()) filledFields++;
        if (c.paisSede && c.paisSede.trim()) filledFields++;
      });
      return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
    }

    const sectionFields: { [key: string]: string[] } = {
      'personaPrincipal': [
        'pers_nombre', 'pers_primer_apellido', 'pers_curp', 'pers_rfc',
        'pers_fecha_nacimiento', 'pers_sexo_nombre', 'pers_estado_civil_nombre',
        'pers_nacionalidad_nombre', 'pers_entidad_nombre', 'pers_municipio_nombre',
        'pers_semblanza', 'rfcNum'
      ],
      'padronInstitucional': [
        'telefono', 'tipoIdentificacionOficial', 'identificacionOficial',
        'calle', 'numeroExterior', 'colonia', 'localidad', 'municipioDomicilio', 'codigoPostal'
      ],
      'institucion': [
        'inst_clave_oficial', 'inst_nombre', 'inst_tipo_id',
        'inst_pais_nombre', 'inst_entidad_nombre', 'inst_municipio_nombre', 'inst_estado_usa'
      ],
      'area-conocimiento': ['area_nombre', 'area_clave'],
      'trayectoria-academica': ['acad_nivel_nombre', 'acad_titulo', 'acad_estatus_nombre', 'cert1', 'acad_constancia_snii'],
      'trayectoria-profesional': ['tray_prof_nombramiento', 'tray_prof_institucion', 'tray_prof_fecha_inicio', 'tray_prof_fecha_fin'],
      'cursos': ['curso_nombre', 'curso_programa', 'curso_horas_totales', 'curso_fecha_inicio', 'curso_institucion', 'curso_nivel_escolaridad'],
      'idiomas': ['idioma_nombre', 'idioma_dominio_nombre', 'idioma_cert_institucion', 'idioma_cert_puntuacion', 'idioma_cert_documento'],
      'estancias': ['estancia_nombre_proyecto', 'estancia_tipo_nombre', 'estancia_fecha_inicio', 'estancia_institucion_receptora'],
      'aportaciones': ['art_titulo', 'art_nombre_revista', 'art_anio', 'art_rol_part_nombre', 'art_estado_nombre', 'art_fondo_prog_nombre'],
      'divulgacion': ['divulg_titulo', 'divulg_tipo_div_nombre', 'divulg_medio_nombre', 'divulg_fecha', 'divulg_archivo', 'divulg_evidencia_link'],
      'logros': ['logro_nombre', 'logro_anio'],
    };

    const fields = (sectionFields[section] || []).filter(field => this.isConditionalFieldActive(field));
    if (fields.length === 0) return 0;

    let completed = 0;
    fields.forEach(field => {
      if (this.isFieldComplete(field)) {
        completed++;
      }
    });

    return Math.round((completed / fields.length) * 100);
  }

  isSectionComplete(section: View): boolean {
    return this.getSectionProgress(section) === 100;
  }

  isOptionalSection(section: View): boolean {
    return !this.seccionesObligatorias.includes(section === 'inicio' ? 'personaPrincipal' : section);
  }

  getSectionProgressLabel(section: View): string {
    const progress = this.getSectionProgress(section);
    return `${progress}%`;
  }

  getOverallProgress(): number {
    let totalProgress = 0;
    this.seccionesObligatorias.forEach(section => {
      totalProgress += this.getSectionProgress(section);
    });

    return Math.round(totalProgress / this.seccionesObligatorias.length);
  }

  getSectionSteps(): Array<{id: View, title: string, icon: string, iconImage: string, group: string, order: number, description: string}> {
    return [
      { id: 'personaPrincipal', title: 'Datos personales', icon: 'fa-user', iconImage: 'assets/img/user.png', group: 'General', order: 1, description: 'Información personal básica' },
      { id: 'padronInstitucional', title: 'Padrón institucional', icon: 'fa-id-card', iconImage: 'assets/img/id-insignia.png', group: 'General', order: 2, description: 'Datos DICyFRH y domicilio' },
      { id: 'institucion', title: 'Institución', icon: 'fa-university', iconImage: 'assets/img/teacher_icon_243839.png', group: 'General', order: 3, description: 'Datos de tu institución' },
      { id: 'area-conocimiento', title: 'Área de conocimiento', icon: 'fa-book', iconImage: 'assets/img/id-insignia.png', group: 'Perfil académico', order: 4, description: 'Especialidad y disciplina' },
      { id: 'trayectoria-academica', title: 'Perfil académico', icon: 'fa-graduation-cap', iconImage: 'assets/img/creative-education.png', group: 'Perfil académico', order: 5, description: 'Grados y estudios' },
      { id: 'trayectoria-profesional', title: 'Trayectoria profesional', icon: 'fa-briefcase', iconImage: 'assets/img/empresario.png', group: 'Perfil académico', order: 6, description: 'Experiencia laboral' },
      { id: 'cursos', title: 'Cursos impartidos', icon: 'fa-chalkboard-teacher', iconImage: 'assets/img/teacher_icon_243839.png', group: 'Desarrollo y formación', order: 7, description: 'Docencia y enseñanza' },
      { id: 'idiomas', title: 'Idiomas', icon: 'fa-language', iconImage: 'assets/img/language_translator_icon_150921.png', group: 'Desarrollo y formación', order: 8, description: 'Dominio de idiomas' },
      { id: 'estancias', title: 'Estancias de investigación', icon: 'fa-map-marker-alt', iconImage: 'assets/img/calendario.png', group: 'Desarrollo y formación', order: 9, description: 'Estancias académicas' },
      { id: 'aportaciones', title: 'Aportaciones científicas', icon: 'fa-file-alt', iconImage: 'assets/img/archivo.png', group: 'Producción y participación', order: 10, description: 'Artículos y publicaciones' },
      { id: 'congresos', title: 'Congresos y eventos', icon: 'fa-users', iconImage: 'assets/img/communicate_connection_propaganda_announce_news_icon_143344.png', group: 'Producción y participación', order: 11, description: 'Participación en eventos' },
      { id: 'divulgacion', title: 'Divulgación científica', icon: 'fa-bullhorn', iconImage: 'assets/img/communicate_connection_propaganda_announce_news_icon_143344.png', group: 'Producción y participación', order: 12, description: 'Actividades de divulgación' },
      { id: 'logros', title: 'Logros y reconocimientos', icon: 'fa-trophy', iconImage: 'assets/img/4230509-achievement-trophy_114984.png', group: 'Reconocimientos', order: 13, description: 'Premios y distinciones' }
    ];
  }

  /**
   * Obtiene la imagen del icono para una sección específica
   */
  getSectionIconImage(sectionId: View): string {
    const step = this.getSectionSteps().find(s => s.id === sectionId);
    return step?.iconImage || 'assets/img/user.png';
  }

  /**
   * Verifica si se debe mostrar la opción de certificación
   * Solo se muestra para niveles Avanzado o Excelente
   */
  mostrarCertificacion(): boolean {
    const nivelDominio = this.form.get('idioma_dominio_nombre')?.value || '';
    return nivelDominio === 'Avanzado' || nivelDominio === 'Excelente';
  }

  /**
   * Actualiza las validaciones condicionales antes de validar el formulario
   */
  private actualizarValidacionesCondicionales(): void {
    // Validación condicional: art_fondo_prog_nombre es obligatorio si art_recibio_apoyo_SECIHTI es true
    const recibioApoyo = this.form.get('art_recibio_apoyo_SECIHTI')?.value;
    const fondoProgControl = this.form.get('art_fondo_prog_nombre');
    if (recibioApoyo) {
      fondoProgControl?.setValidators([Validators.required]);
    } else {
      fondoProgControl?.clearValidators();
    }
    fondoProgControl?.updateValueAndValidity({ emitEvent: false });

    // Validación condicional de Idiomas:
    // - Avanzado: requiere institución/puntuación solo si activa certificación
    // - Excelente: certificación obligatoria + documento probatorio obligatorio
    const esCertificado = this.form.get('idioma_es_certificado')?.value;
    const dominioNombre = this.form.get('idioma_dominio_nombre')?.value;
    const esExcelente = dominioNombre === 'Excelente';
    const puedeCertificarse = dominioNombre === 'Avanzado' || esExcelente;
    const requiereDatosCertificacion = (esCertificado && puedeCertificarse) || esExcelente;

    if (requiereDatosCertificacion) {
      this.form.get('idioma_cert_institucion')?.setValidators([Validators.required]);
      this.form.get('idioma_cert_puntuacion')?.setValidators([Validators.required]);
    } else {
      this.form.get('idioma_cert_institucion')?.clearValidators();
      this.form.get('idioma_cert_puntuacion')?.clearValidators();
    }
    this.form.get('idioma_cert_institucion')?.updateValueAndValidity({ emitEvent: false });
    this.form.get('idioma_cert_puntuacion')?.updateValueAndValidity({ emitEvent: false });

    const idiomaDocControl = this.form.get('idioma_cert_documento');
    if (esExcelente) {
      idiomaDocControl?.setValidators([requiredFile()]);
      if (!this.form.get('idioma_es_certificado')?.value) {
        this.form.get('idioma_es_certificado')?.setValue(true, { emitEvent: false });
      }
    } else {
      idiomaDocControl?.clearValidators();
    }
    idiomaDocControl?.updateValueAndValidity({ emitEvent: false });

    // Validación condicional: evidencias de divulgación por tipo de producto
    const prodObtenido = this.form.get('divulg_prod_obtenido_nombre')?.value;
    const archivoControl = this.form.get('divulg_archivo');
    const linkControl = this.form.get('divulg_evidencia_link');
    const producto = (prodObtenido || '').toString().trim();
    const usaLink = this.esProductoConEvidenciaLink(producto);
    if (producto) {
      if (usaLink) {
        linkControl?.setValidators([Validators.required, Validators.pattern('https?://.*')]);
        archivoControl?.clearValidators();
      } else {
        archivoControl?.setValidators([requiredFile()]);
        linkControl?.clearValidators();
      }
    } else {
      archivoControl?.clearValidators();
      linkControl?.clearValidators();
    }
    archivoControl?.updateValueAndValidity({ emitEvent: false });
    linkControl?.updateValueAndValidity({ emitEvent: false });

    // Validación condicional: constancia SNII obligatoria solo si activa el switch
    const esPerfilSnii = !!this.form.get('acad_es_perfil_snii')?.value;
    const constanciaSniiControl = this.form.get('acad_constancia_snii');
    if (esPerfilSnii) {
      constanciaSniiControl?.setValidators([requiredFile()]);
    } else {
      constanciaSniiControl?.clearValidators();
    }
    constanciaSniiControl?.updateValueAndValidity({ emitEvent: false });

    // Validación condicional: inst_entidad_nombre es obligatorio si inst_pais_nombre es 'México'
    // inst_estado_usa es obligatorio si inst_pais_nombre es 'Estados Unidos'
    const paisNombre = this.form.get('inst_pais_nombre')?.value;
    const entidadControl = this.form.get('inst_entidad_nombre');
    const estadoUsaControl = this.form.get('inst_estado_usa');
    const municipioControl = this.form.get('inst_municipio_nombre');
    const entidadSeleccionada = (entidadControl?.value || '').toString().trim();
    
    if (paisNombre === 'México') {
      entidadControl?.setValidators([Validators.required]);
      estadoUsaControl?.clearValidators();
      if (entidadSeleccionada) {
        municipioControl?.setValidators([Validators.required]);
      } else {
        municipioControl?.clearValidators();
      }
    } else if (paisNombre === 'Estados Unidos') {
      estadoUsaControl?.setValidators([Validators.required]);
      entidadControl?.clearValidators();
      municipioControl?.clearValidators();
    } else {
      entidadControl?.clearValidators();
      estadoUsaControl?.clearValidators();
      municipioControl?.clearValidators();
    }
    
    entidadControl?.updateValueAndValidity({ emitEvent: false });
    estadoUsaControl?.updateValueAndValidity({ emitEvent: false });
    municipioControl?.updateValueAndValidity({ emitEvent: false });

    this.actualizarValidacionesGradoAcademicoDinamico();
    this.actualizarValidacionesCursosDinamico();
    this.actualizarValidacionesEstanciasDinamico();
    this.actualizarValidacionesAportacionesDinamico();
    this.actualizarValidacionesDivulgacionDinamico();
    this.actualizarValidacionesLogrosDinamico();
  }

  private actualizarValidacionesGradoAcademicoDinamico(): void {
    const hasLista = this.acadGradosList.length > 0;
    const requiredControls = ['acad_nivel_nombre', 'acad_titulo', 'acad_estatus_nombre'];
    requiredControls.forEach((field) => {
      const control = this.form.get(field);
      if (!control) return;
      if (hasLista) {
        control.clearValidators();
      } else {
        control.setValidators([Validators.required]);
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private actualizarValidacionesCursosDinamico(): void {
    const hasLista = this.cursosImpartidosList.length > 0;
    const requiredFields = [
      'curso_nombre',
      'curso_programa',
      'curso_horas_totales',
      'curso_fecha_inicio',
      'curso_institucion',
      'curso_nivel_escolaridad'
    ];

    requiredFields.forEach((field) => {
      const control = this.form.get(field);
      if (!control) return;

      if (hasLista) {
        control.clearValidators();
      } else if (field === 'curso_horas_totales') {
        control.setValidators([Validators.required, Validators.min(0)]);
      } else {
        control.setValidators([Validators.required]);
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private actualizarValidacionesEstanciasDinamico(): void {
    const hasLista = this.estanciasInvestigacionList.length > 0;
    const requiredFields = [
      'estancia_nombre_proyecto',
      'estancia_tipo_nombre',
      'estancia_fecha_inicio',
      'estancia_institucion_receptora'
    ];

    requiredFields.forEach((field) => {
      const control = this.form.get(field);
      if (!control) return;
      if (hasLista) {
        control.clearValidators();
      } else {
        control.setValidators([Validators.required]);
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private actualizarValidacionesAportacionesDinamico(): void {
    const hasLista = this.articulosCientificosList.length > 0;
    const requiredFields = [
      'art_titulo',
      'art_nombre_revista',
      'art_rol_part_nombre',
      'art_estado_nombre'
    ];

    requiredFields.forEach((field) => {
      const control = this.form.get(field);
      if (!control) return;
      if (hasLista) {
        control.clearValidators();
      } else {
        control.setValidators([Validators.required]);
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private actualizarValidacionesDivulgacionDinamico(): void {
    const hasLista = this.divulgacionesCientificasList.length > 0;
    const requiredFields = [
      'divulg_titulo',
      'divulg_tipo_div_nombre',
      'divulg_medio_nombre',
      'divulg_fecha',
      'divulg_prod_obtenido_nombre',
      'divulg_archivo',
      'divulg_evidencia_link'
    ];

    requiredFields.forEach((field) => {
      const control = this.form.get(field);
      if (!control) return;

      if (hasLista) {
        control.clearValidators();
        control.updateValueAndValidity({ emitEvent: false });
        return;
      }

      if (field === 'divulg_archivo' || field === 'divulg_evidencia_link') {
        // Se manejan por condición de producto en actualizarValidacionesCondicionales
        control.updateValueAndValidity({ emitEvent: false });
        return;
      }

      control.setValidators([Validators.required]);
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private actualizarValidacionesLogrosDinamico(): void {
    const hasLista = this.logrosReconocimientosList.length > 0;
    const requiredFields = ['logro_nombre', 'logro_anio'];

    requiredFields.forEach((field) => {
      const control = this.form.get(field);
      if (!control) return;
      if (hasLista) {
        control.clearValidators();
      } else if (field === 'logro_anio') {
        control.setValidators([Validators.required, Validators.min(0)]);
      } else {
        control.setValidators([Validators.required]);
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  esProductoConEvidenciaLink(producto: string | null | undefined): boolean {
    const p = (producto || '').toString().trim().toLowerCase();
    return p === 'video / grabación' || p === 'video / grabacion' || p === 'entrevista publicada';
  }

  private actualizarVistaTipoInstitucionEnModal(): void {
    const selectTipo = document.getElementById('swal-inst-tipo') as HTMLSelectElement | null;
    const cctWrap = document.getElementById('swal-inst-cct-wrap') as HTMLDivElement | null;
    const cctInput = document.getElementById('swal-inst-cct') as HTMLInputElement | null;
    if (!selectTipo || !cctWrap || !cctInput) return;

    const esEducativa = selectTipo.value === 'EDUCATIVA';
    cctWrap.style.display = esEducativa ? 'block' : 'none';
    if (!esEducativa) {
      cctInput.value = '';
    }
  }

  private validarCamposBaseGradoAcademico(): boolean {
    const nivel = (this.form.get('acad_nivel_nombre')?.value || '').toString().trim();
    const titulo = (this.form.get('acad_titulo')?.value || '').toString().trim();
    const estatus = this.resolverValorConOtro(this.form.get('acad_estatus_nombre')?.value, this.acadEstatusManual);
    return !!(nivel && titulo && estatus);
  }

  private obtenerGradoAcademicoDesdeFormulario(): GradoAcademico {
    return {
      nivelNombre: (this.form.get('acad_nivel_nombre')?.value || '').toString().trim(),
      titulo: (this.form.get('acad_titulo')?.value || '').toString().trim(),
      estatusNombre: this.resolverValorConOtro(this.form.get('acad_estatus_nombre')?.value, this.acadEstatusManual),
      cedulaProfesional: (this.form.get('acad_cedula_profesional')?.value || '').toString().trim(),
      opcionTitulacion: (this.form.get('acad_opcion_titulacion')?.value || '').toString().trim(),
      tituloTesis: (this.form.get('acad_titulo_tesis')?.value || '').toString().trim(),
      fechaObtencion: (this.form.get('acad_fecha_obtencion')?.value || '').toString().trim(),
      institucion: (this.form.get('acad_institucion')?.value || '').toString().trim(),
    };
  }

  private limpiarFormularioGradoAcademico(): void {
    this.acadEstatusManual = '';
    this.form.patchValue({
      acad_nivel_nombre: '',
      acad_titulo: '',
      acad_estatus_nombre: '',
      acad_institucion: '',
      acad_cedula_profesional: '',
      acad_opcion_titulacion: '',
      acad_titulo_tesis: '',
      acad_fecha_obtencion: ''
    }, { emitEvent: false });
  }

  private sincronizarGradosAcademicosAntesDeEnviar(): void {
    const gradoActual = this.obtenerGradoAcademicoDesdeFormulario();
    const tieneActual = this.validarCamposBaseGradoAcademico();

    if (this.editingGradoIndex !== null && tieneActual) {
      this.acadGradosList.splice(this.editingGradoIndex, 1);
      this.acadGradosList = [gradoActual, ...this.acadGradosList];
      this.editingGradoIndex = null;
    } else if (this.acadGradosList.length === 0 && tieneActual) {
      this.acadGradosList = [gradoActual];
    }

    if (this.acadGradosList.length > 0) {
      const principal = this.acadGradosList[0];
      this.acadEstatusManual = this.obtenerTextoManualDesdeValor(principal.estatusNombre || '', this.opcionesEstatusAcademico);
      this.form.patchValue({
        acad_nivel_nombre: principal.nivelNombre || '',
        acad_titulo: principal.titulo || '',
        acad_estatus_nombre: this.obtenerValorSelectConOtro(principal.estatusNombre || '', this.opcionesEstatusAcademico),
        acad_institucion: principal.institucion || '',
        acad_cedula_profesional: principal.cedulaProfesional || '',
        acad_opcion_titulacion: principal.opcionTitulacion || '',
        acad_titulo_tesis: principal.tituloTesis || '',
        acad_fecha_obtencion: principal.fechaObtencion || ''
      }, { emitEvent: false });
    }
  }

  private validarCamposBaseCursoImpartido(): boolean {
    const nombre = (this.form.get('curso_nombre')?.value || '').toString().trim();
    const programa = (this.form.get('curso_programa')?.value || '').toString().trim();
    const horasRaw = this.form.get('curso_horas_totales')?.value;
    const horas = Number(horasRaw);
    const fechaInicio = (this.form.get('curso_fecha_inicio')?.value || '').toString().trim();
    const institucion = (this.form.get('curso_institucion')?.value || '').toString().trim();
    const nivel = this.resolverValorConOtro(this.form.get('curso_nivel_escolaridad')?.value, this.cursoNivelManual);
    return !!(nombre && programa && !Number.isNaN(horas) && horas >= 0 && fechaInicio && institucion && nivel);
  }

  private obtenerCursoDesdeFormulario(): CursoImpartido {
    const horasRaw = this.form.get('curso_horas_totales')?.value;
    const horas = Number(horasRaw);
    return {
      nombre: (this.form.get('curso_nombre')?.value || '').toString().trim(),
      programa: (this.form.get('curso_programa')?.value || '').toString().trim(),
      horasTotales: Number.isNaN(horas) ? 0 : Math.max(0, horas),
      fechaInicio: (this.form.get('curso_fecha_inicio')?.value || '').toString().trim(),
      fechaFin: (this.form.get('curso_fecha_fin')?.value || '').toString().trim(),
      institucion: (this.form.get('curso_institucion')?.value || '').toString().trim(),
      nivelEscolaridad: this.resolverValorConOtro(this.form.get('curso_nivel_escolaridad')?.value, this.cursoNivelManual),
      productoPrincipal: !!this.form.get('curso_producto_principal')?.value,
    };
  }

  private limpiarFormularioCursoImpartido(): void {
    this.cursoNivelManual = '';
    this.form.patchValue({
      curso_nombre: '',
      curso_programa: '',
      curso_horas_totales: 5,
      curso_fecha_inicio: '',
      curso_fecha_fin: '',
      curso_institucion: '',
      curso_nivel_escolaridad: '',
      curso_producto_principal: false
    }, { emitEvent: false });
  }

  private sincronizarCursosAntesDeEnviar(): void {
    const cursoActual = this.obtenerCursoDesdeFormulario();
    const tieneActual = this.validarCamposBaseCursoImpartido();

    if (this.editingCursoIndex !== null && tieneActual) {
      this.cursosImpartidosList.splice(this.editingCursoIndex, 1);
      this.cursosImpartidosList = [cursoActual, ...this.cursosImpartidosList];
      this.editingCursoIndex = null;
    } else if (this.cursosImpartidosList.length === 0 && tieneActual) {
      this.cursosImpartidosList = [cursoActual];
    }

    if (this.cursosImpartidosList.length > 0) {
      const principal = this.cursosImpartidosList[0];
      this.cursoNivelManual = this.obtenerTextoManualDesdeValor(principal.nivelEscolaridad || '', this.opcionesNivelCurso);
      this.form.patchValue({
        curso_nombre: principal.nombre || '',
        curso_programa: principal.programa || '',
        curso_horas_totales: principal.horasTotales ?? 0,
        curso_fecha_inicio: principal.fechaInicio || '',
        curso_fecha_fin: principal.fechaFin || '',
        curso_institucion: principal.institucion || '',
        curso_nivel_escolaridad: this.obtenerValorSelectConOtro(principal.nivelEscolaridad || '', this.opcionesNivelCurso),
        curso_producto_principal: !!principal.productoPrincipal
      }, { emitEvent: false });
    }
  }

  private validarCamposBaseIdioma(marcarCampos = false): boolean {
    this.actualizarValidacionesCondicionales();
    const campos = ['idioma_nombre', 'idioma_dominio_nombre'];
    const esCertificado = !!this.form.get('idioma_es_certificado')?.value;
    const dominio = this.obtenerTextoFormulario('idioma_dominio_nombre');
    if (esCertificado && (dominio === 'Avanzado' || dominio === 'Excelente')) {
      campos.push('idioma_cert_institucion', 'idioma_cert_puntuacion');
    }
    if (dominio === 'Excelente') {
      campos.push('idioma_cert_documento');
    }
    if (marcarCampos) {
      campos.forEach(campo => this.form.get(campo)?.markAsTouched());
    }
    return campos.every(campo => this.form.get(campo)?.valid && this.hasMeaningfulValue(campo));
  }

  private obtenerIdiomaDesdeFormulario(): IdiomaDominio {
    const documento = this.form.get('idioma_cert_documento')?.value;
    const documentoPersistido = !!documento && typeof documento === 'object' && documento.persisted === true;
    return {
      nombre: this.obtenerTextoFormulario('idioma_nombre') ?? '',
      dominioNombre: this.obtenerTextoFormulario('idioma_dominio_nombre') ?? '',
      conversacion: this.obtenerTextoFormulario('idioma_conversacion') ?? '',
      lectura: this.obtenerTextoFormulario('idioma_lectura') ?? '',
      escritura: this.obtenerTextoFormulario('idioma_escritura') ?? '',
      esCertificado: !!this.form.get('idioma_es_certificado')?.value,
      certInstitucion: this.obtenerTextoFormulario('idioma_cert_institucion') ?? '',
      certPuntuacion: this.obtenerTextoFormulario('idioma_cert_puntuacion') ?? '',
      vigenciaFin: this.obtenerTextoFormulario('idioma_vigencia_fin') ?? '',
      certDocumento: documento instanceof File ? documento : null,
      certDocumentoNombre: documento instanceof File ? documento.name : documentoPersistido ? String(documento.name || 'Certificado guardado') : '',
      certDocumentoPersistido: documentoPersistido || !!this.archivosGuardados['idioma_cert_documento']
    };
  }

  private limpiarFormularioIdioma(): void {
    this.form.patchValue({
      idioma_nombre: '',
      idioma_dominio_nombre: '',
      idioma_conversacion: '',
      idioma_lectura: '',
      idioma_escritura: '',
      idioma_es_certificado: false,
      idioma_cert_institucion: '',
      idioma_cert_puntuacion: '',
      idioma_vigencia_fin: '',
      idioma_cert_documento: null
    }, { emitEvent: false });
  }

  private sincronizarIdiomasAntesDeEnviar(): void {
    const idiomaActual = this.obtenerIdiomaDesdeFormulario();
    const tieneActual = this.validarCamposBaseIdioma(false);

    if (this.editingIdiomaIndex !== null && tieneActual) {
      this.idiomasDominioList.splice(this.editingIdiomaIndex, 1);
      this.idiomasDominioList = [idiomaActual, ...this.idiomasDominioList];
      this.editingIdiomaIndex = null;
    } else if (tieneActual && !this.idiomasDominioList.some(item => this.idiomasIguales(item, idiomaActual))) {
      this.idiomasDominioList = [idiomaActual, ...this.idiomasDominioList];
    }

    if (this.idiomasDominioList.length > 0) {
      const principal = this.idiomasDominioList[0];
      const documento = principal.certDocumento instanceof File
        ? principal.certDocumento
        : principal.certDocumentoPersistido
          ? { persisted: true, name: principal.certDocumentoNombre || 'Certificado guardado' }
          : null;
      this.form.patchValue({
        idioma_nombre: principal.nombre,
        idioma_dominio_nombre: principal.dominioNombre,
        idioma_conversacion: principal.conversacion,
        idioma_lectura: principal.lectura,
        idioma_escritura: principal.escritura,
        idioma_es_certificado: principal.esCertificado,
        idioma_cert_institucion: principal.certInstitucion,
        idioma_cert_puntuacion: principal.certPuntuacion,
        idioma_vigencia_fin: principal.vigenciaFin,
        idioma_cert_documento: documento
      }, { emitEvent: false });
      this.actualizarValidacionesCondicionales();
    }
  }

  private idiomasIguales(a: IdiomaDominio, b: IdiomaDominio): boolean {
    return JSON.stringify(this.idiomaSinArchivo(a)) === JSON.stringify(this.idiomaSinArchivo(b));
  }

  private idiomaSinArchivo(item: IdiomaDominio): Record<string, unknown> {
    return {
      nombre: item.nombre,
      dominioNombre: item.dominioNombre,
      conversacion: item.conversacion,
      lectura: item.lectura,
      escritura: item.escritura,
      esCertificado: item.esCertificado,
      certInstitucion: item.certInstitucion,
      certPuntuacion: item.certPuntuacion,
      vigenciaFin: item.vigenciaFin
    };
  }

  private construirIdiomasPayload(): Record<string, unknown>[] {
    return this.idiomasDominioList.map((item, index) => ({
      ...this.idiomaSinArchivo(item),
      certDocumentoCampo: item.certDocumento instanceof File ? 'idiomaCertDocumento_' + index : null,
      certDocumentoNombre: item.certDocumentoNombre || ''
    }));
  }
  private validarCamposBaseEstancia(): boolean {
    const nombre = (this.form.get('estancia_nombre_proyecto')?.value || '').toString().trim();
    const tipo = this.resolverValorConOtro(this.form.get('estancia_tipo_nombre')?.value, this.estanciaTipoManual);
    const fechaInicio = (this.form.get('estancia_fecha_inicio')?.value || '').toString().trim();
    const institucion = (this.form.get('estancia_institucion_receptora')?.value || '').toString().trim();
    return !!(nombre && tipo && fechaInicio && institucion);
  }

  private obtenerEstanciaDesdeFormulario(): EstanciaInvestigacion {
    return {
      nombreProyecto: (this.form.get('estancia_nombre_proyecto')?.value || '').toString().trim(),
      tipoNombre: this.resolverValorConOtro(this.form.get('estancia_tipo_nombre')?.value, this.estanciaTipoManual),
      logros: (this.form.get('estancia_logros')?.value || '').toString().trim(),
      fechaInicio: (this.form.get('estancia_fecha_inicio')?.value || '').toString().trim(),
      fechaFin: (this.form.get('estancia_fecha_fin')?.value || '').toString().trim(),
      institucionReceptora: (this.form.get('estancia_institucion_receptora')?.value || '').toString().trim(),
    };
  }

  private limpiarFormularioEstancia(): void {
    this.estanciaTipoManual = '';
    this.form.patchValue({
      estancia_nombre_proyecto: '',
      estancia_tipo_nombre: '',
      estancia_logros: '',
      estancia_fecha_inicio: '',
      estancia_fecha_fin: '',
      estancia_institucion_receptora: '',
    }, { emitEvent: false });
  }

  private sincronizarEstanciasAntesDeEnviar(): void {
    const estanciaActual = this.obtenerEstanciaDesdeFormulario();
    const tieneActual = this.validarCamposBaseEstancia();

    if (this.editingEstanciaIndex !== null && tieneActual) {
      this.estanciasInvestigacionList.splice(this.editingEstanciaIndex, 1);
      this.estanciasInvestigacionList = [estanciaActual, ...this.estanciasInvestigacionList];
      this.editingEstanciaIndex = null;
    } else if (this.estanciasInvestigacionList.length === 0 && tieneActual) {
      this.estanciasInvestigacionList = [estanciaActual];
    }

    if (this.estanciasInvestigacionList.length > 0) {
      const principal = this.estanciasInvestigacionList[0];
      this.estanciaTipoManual = this.obtenerTextoManualDesdeValor(principal.tipoNombre || '', this.opcionesTipoEstancia);
      this.form.patchValue({
        estancia_nombre_proyecto: principal.nombreProyecto || '',
        estancia_tipo_nombre: this.obtenerValorSelectConOtro(principal.tipoNombre || '', this.opcionesTipoEstancia),
        estancia_logros: principal.logros || '',
        estancia_fecha_inicio: principal.fechaInicio || '',
        estancia_fecha_fin: principal.fechaFin || '',
        estancia_institucion_receptora: principal.institucionReceptora || '',
      }, { emitEvent: false });
    }
  }

  private validarCamposBaseArticulo(): boolean {
    const titulo = (this.form.get('art_titulo')?.value || '').toString().trim();
    const revista = (this.form.get('art_nombre_revista')?.value || '').toString().trim();
    const rol = (this.form.get('art_rol_part_nombre')?.value || '').toString().trim();
    const estado = (this.form.get('art_estado_nombre')?.value || '').toString().trim();
    return !!(titulo && revista && rol && estado);
  }

  private obtenerArticuloDesdeFormulario(): ArticuloCientifico {
    const anioRaw = this.form.get('art_anio')?.value;
    const anioNum = Number(anioRaw);
    const totalCitasRaw = this.form.get('art_total_citas')?.value;
    const totalCitasNum = Number(totalCitasRaw);

    const autoresNormalizados: AutorArticuloItem[] = this.autoresList
      .map((a, idx) => {
        const ordenNum = Number(a?.orden);
        return {
          nombre: (a?.nombre || '').toString().trim(),
          orcid: (a?.orcid || '').toString().trim(),
          orden: Number.isNaN(ordenNum) || ordenNum <= 0 ? idx + 1 : ordenNum
        } as AutorArticuloItem;
      })
      .filter((a) => !!a.nombre)
      .sort((a, b) => a.orden - b.orden);

    return {
      idExterno: (this.form.get('art_id_externo')?.value || '').toString().trim(),
      eje: (this.form.get('art_eje')?.value || '').toString().trim(),
      tipo: (this.form.get('art_tipo')?.value || '').toString().trim(),
      productoPrincipal: !!this.form.get('art_producto_principal')?.value,
      anio: (anioRaw === null || anioRaw === '' || Number.isNaN(anioNum)) ? null : Math.max(1800, Math.trunc(anioNum)),
      issn: (this.form.get('art_issn')?.value || '').toString().trim(),
      issnElectronico: (this.form.get('art_issn_electronico')?.value || '').toString().trim(),
      doi: (this.form.get('art_doi')?.value || '').toString().trim(),
      nombreRevista: (this.form.get('art_nombre_revista')?.value || '').toString().trim(),
      titulo: (this.form.get('art_titulo')?.value || '').toString().trim(),
      rolParticipacionNombre: (this.form.get('art_rol_part_nombre')?.value || '').toString().trim(),
      estadoNombre: (this.form.get('art_estado_nombre')?.value || '').toString().trim(),
      objetivoNombre: (this.form.get('art_objetivo_nombre')?.value || '').toString().trim(),
      recibioApoyoSECIHTI: !!this.form.get('art_recibio_apoyo_SECIHTI')?.value,
      fondoProgramaNombre: (this.form.get('art_fondo_prog_nombre')?.value || '').toString().trim(),
      totalCitas: Number.isNaN(totalCitasNum) ? 0 : Math.max(0, Math.trunc(totalCitasNum)),
      autores: autoresNormalizados
    };
  }

  private limpiarFormularioArticuloCientifico(): void {
    this.form.patchValue({
      art_id_externo: '',
      art_eje: '',
      art_tipo: '',
      art_producto_principal: false,
      art_anio: null,
      art_issn: '',
      art_issn_electronico: '',
      art_doi: '',
      art_nombre_revista: '',
      art_titulo: '',
      art_rol_part_nombre: '',
      art_estado_nombre: 'Publicado',
      art_objetivo_nombre: '',
      art_recibio_apoyo_SECIHTI: false,
      art_fondo_prog_nombre: '',
      art_total_citas: 0,
      art_autor_nombre_completo: '',
      art_autor_orcid: '',
      art_autor_orden: 1
    }, { emitEvent: false });
    this.autoresList = [{ nombre: '', orcid: '', orden: 1 }];
  }

  private sincronizarArticulosAntesDeEnviar(): void {
    const articuloActual = this.obtenerArticuloDesdeFormulario();
    const tieneActual = this.validarCamposBaseArticulo();

    if (this.editingArticuloIndex !== null && tieneActual) {
      this.articulosCientificosList.splice(this.editingArticuloIndex, 1);
      this.articulosCientificosList = [articuloActual, ...this.articulosCientificosList];
      this.editingArticuloIndex = null;
    } else if (this.articulosCientificosList.length === 0 && tieneActual) {
      this.articulosCientificosList = [articuloActual];
    }

    if (this.articulosCientificosList.length > 0) {
      const principal = this.articulosCientificosList[0];
      const autoresPrincipal = principal.autores?.length > 0
        ? principal.autores
        : [{ nombre: '', orcid: '', orden: 1 }];
      this.autoresList = autoresPrincipal.map((a, idx) => ({
        nombre: a.nombre || '',
        orcid: a.orcid || '',
        orden: Number(a.orden) > 0 ? Number(a.orden) : idx + 1
      }));
      const primerAutor = this.autoresList[0];

      this.form.patchValue({
        art_id_externo: principal.idExterno || '',
        art_eje: principal.eje || '',
        art_tipo: principal.tipo || '',
        art_producto_principal: !!principal.productoPrincipal,
        art_anio: principal.anio ?? null,
        art_issn: principal.issn || '',
        art_issn_electronico: principal.issnElectronico || '',
        art_doi: principal.doi || '',
        art_nombre_revista: principal.nombreRevista || '',
        art_titulo: principal.titulo || '',
        art_rol_part_nombre: principal.rolParticipacionNombre || '',
        art_estado_nombre: principal.estadoNombre || 'Publicado',
        art_objetivo_nombre: principal.objetivoNombre || '',
        art_recibio_apoyo_SECIHTI: !!principal.recibioApoyoSECIHTI,
        art_fondo_prog_nombre: principal.fondoProgramaNombre || '',
        art_total_citas: principal.totalCitas ?? 0,
        art_autor_nombre_completo: primerAutor?.nombre || '',
        art_autor_orcid: primerAutor?.orcid || '',
        art_autor_orden: primerAutor?.orden ?? 1
      }, { emitEvent: false });
    }
  }

  private validarCamposBaseDivulgacion(): boolean {
    const tipo = this.resolverValorConOtro(this.form.get('divulg_tipo_div_nombre')?.value, this.divulgTipoManual);
    const medio = this.resolverValorConOtro(this.form.get('divulg_medio_nombre')?.value, this.divulgMedioManual);
    const titulo = (this.form.get('divulg_titulo')?.value || '').toString().trim();
    const fecha = (this.form.get('divulg_fecha')?.value || '').toString().trim();
    const producto = this.resolverValorConOtro(this.form.get('divulg_prod_obtenido_nombre')?.value, this.divulgProductoManual);
    if (!(tipo && medio && titulo && fecha && producto)) return false;

    if (this.esProductoConEvidenciaLink(producto)) {
      const link = (this.form.get('divulg_evidencia_link')?.value || '').toString().trim();
      return /^https?:\/\/.+/i.test(link);
    }
    return this.esArchivoDisponible(this.form.get('divulg_archivo')?.value, 'divulg_archivo');
  }

  private obtenerDivulgacionDesdeFormulario(): DivulgacionCientifica {
    const producto = this.resolverValorConOtro(this.form.get('divulg_prod_obtenido_nombre')?.value, this.divulgProductoManual);
    const usaLink = this.esProductoConEvidenciaLink(producto);
    const archivoValue = this.form.get('divulg_archivo')?.value;
    const evidenciaArchivo = usaLink ? null : (archivoValue instanceof File ? archivoValue : null);
    const evidenciaArchivoNombre = usaLink
      ? ''
      : (evidenciaArchivo?.name || archivoValue?.name || this.archivosGuardados['divulg_archivo']?.nombre || '');
    const evidenciaLink = usaLink ? (this.form.get('divulg_evidencia_link')?.value || '').toString().trim() : '';

    return {
      titulo: (this.form.get('divulg_titulo')?.value || '').toString().trim(),
      tipoDivulgacionNombre: this.resolverValorConOtro(this.form.get('divulg_tipo_div_nombre')?.value, this.divulgTipoManual),
      medioNombre: this.resolverValorConOtro(this.form.get('divulg_medio_nombre')?.value, this.divulgMedioManual),
      dirigidoA: this.resolverValorConOtro(this.form.get('divulg_dirigido_a')?.value, this.divulgDirigidoManual),
      productoObtenidoNombre: producto,
      fecha: (this.form.get('divulg_fecha')?.value || '').toString().trim(),
      institucionOrganizadora: (this.form.get('divulg_institucion_organizadora')?.value || '').toString().trim(),
      evidenciaTipo: usaLink ? 'LINK' : 'PDF',
      evidenciaLink,
      evidenciaArchivo: evidenciaArchivo as File | null,
      evidenciaArchivoNombre
    };
  }

  private limpiarFormularioDivulgacion(): void {
    this.divulgTipoManual = '';
    this.divulgMedioManual = '';
    this.divulgDirigidoManual = '';
    this.divulgProductoManual = '';
    this.form.patchValue({
      divulg_titulo: '',
      divulg_tipo_div_nombre: '',
      divulg_medio_nombre: '',
      divulg_dirigido_a: '',
      divulg_prod_obtenido_nombre: '',
      divulg_fecha: '',
      divulg_institucion_organizadora: '',
      divulg_evidencia_link: '',
      divulg_archivo: null
    }, { emitEvent: false });
  }

  private sincronizarDivulgacionesAntesDeEnviar(): void {
    const divulgacionActual = this.obtenerDivulgacionDesdeFormulario();
    const tieneActual = this.validarCamposBaseDivulgacion();

    if (this.editingDivulgacionIndex !== null && tieneActual) {
      this.divulgacionesCientificasList.splice(this.editingDivulgacionIndex, 1);
      this.divulgacionesCientificasList = [divulgacionActual, ...this.divulgacionesCientificasList];
      this.editingDivulgacionIndex = null;
    } else if (this.divulgacionesCientificasList.length === 0 && tieneActual) {
      this.divulgacionesCientificasList = [divulgacionActual];
    }

    if (this.divulgacionesCientificasList.length > 0) {
      const principal = this.divulgacionesCientificasList[0];
      this.divulgTipoManual = this.obtenerTextoManualDesdeValor(principal.tipoDivulgacionNombre || '', this.opcionesTipoDivulgacion);
      this.divulgMedioManual = this.obtenerTextoManualDesdeValor(principal.medioNombre || '', this.opcionesMedioDivulgacion);
      this.divulgDirigidoManual = this.obtenerTextoManualDesdeValor(principal.dirigidoA || '', this.opcionesDirigidoADivulgacion);
      this.divulgProductoManual = this.obtenerTextoManualDesdeValor(principal.productoObtenidoNombre || '', this.opcionesProductoDivulgacion);
      this.form.patchValue({
        divulg_titulo: principal.titulo || '',
        divulg_tipo_div_nombre: this.obtenerValorSelectConOtro(principal.tipoDivulgacionNombre || '', this.opcionesTipoDivulgacion),
        divulg_medio_nombre: this.obtenerValorSelectConOtro(principal.medioNombre || '', this.opcionesMedioDivulgacion),
        divulg_dirigido_a: this.obtenerValorSelectConOtro(principal.dirigidoA || '', this.opcionesDirigidoADivulgacion),
        divulg_prod_obtenido_nombre: this.obtenerValorSelectConOtro(principal.productoObtenidoNombre || '', this.opcionesProductoDivulgacion),
        divulg_fecha: principal.fecha || '',
        divulg_institucion_organizadora: principal.institucionOrganizadora || '',
        divulg_evidencia_link: principal.evidenciaTipo === 'LINK' ? (principal.evidenciaLink || '') : '',
        divulg_archivo: principal.evidenciaTipo === 'PDF'
          ? (principal.evidenciaArchivo ?? (principal.evidenciaArchivoNombre && this.archivosGuardados['divulg_archivo']
            ? {
                persisted: true,
                documentoId: this.archivosGuardados['divulg_archivo'].documentoId,
                name: principal.evidenciaArchivoNombre
              }
            : null))
          : null
      }, { emitEvent: false });
    }
  }

  private validarCamposBaseLogro(): boolean {
    const nombre = (this.form.get('logro_nombre')?.value || '').toString().trim();
    const anioRaw = this.form.get('logro_anio')?.value;
    const anio = Number(anioRaw);
    return !!(nombre && !Number.isNaN(anio) && anio >= 0);
  }

  private obtenerLogroDesdeFormulario(): LogroReconocimiento {
    const anioRaw = this.form.get('logro_anio')?.value;
    const anio = Number(anioRaw);
    return {
      tipo: (this.form.get('logro_tipo')?.value || '').toString().trim(),
      nombre: (this.form.get('logro_nombre')?.value || '').toString().trim(),
      anio: Number.isNaN(anio) ? null : Math.max(0, Math.trunc(anio))
    };
  }

  private limpiarFormularioLogro(): void {
    this.form.patchValue({
      logro_tipo: '',
      logro_nombre: '',
      logro_anio: null
    }, { emitEvent: false });
  }

  private sincronizarLogrosAntesDeEnviar(): void {
    const logroActual = this.obtenerLogroDesdeFormulario();
    const tieneActual = this.validarCamposBaseLogro();

    if (this.editingLogroIndex !== null && tieneActual) {
      this.logrosReconocimientosList.splice(this.editingLogroIndex, 1);
      this.logrosReconocimientosList = [logroActual, ...this.logrosReconocimientosList];
      this.editingLogroIndex = null;
    } else if (this.logrosReconocimientosList.length === 0 && tieneActual) {
      this.logrosReconocimientosList = [logroActual];
    }

    if (this.logrosReconocimientosList.length > 0) {
      const principal = this.logrosReconocimientosList[0];
      this.form.patchValue({
        logro_tipo: principal.tipo || '',
        logro_nombre: principal.nombre || '',
        logro_anio: principal.anio ?? null
      }, { emitEvent: false });
    }
  }

  private importarGradosAcademicosDesdePerfil(jsonData: any): void {
    const lista = jsonData?.perfil?.trayectoriaAcademica;
    if (!Array.isArray(lista) || lista.length === 0) return;

    const normalizados: GradoAcademico[] = lista
      .map((item: any) => {
        const nivel = item?.nivelEscolaridad;
        const estatus = item?.estatus;
        const opcion = item?.opcionTitulacion;
        const institucion = item?.institucion;
        return {
          nivelNombre: (typeof nivel === 'object' ? nivel?.nombre : nivel || '').toString().trim(),
          titulo: (item?.titulo || '').toString().trim(),
          estatusNombre: (typeof estatus === 'object' ? estatus?.nombre : estatus || '').toString().trim(),
          cedulaProfesional: (item?.cedulaProfesional || '').toString().trim(),
          opcionTitulacion: (typeof opcion === 'object' ? opcion?.nombre : opcion || '').toString().trim(),
          tituloTesis: (item?.tituloTesis || '').toString().trim(),
          fechaObtencion: (item?.fechaObtencion || '').toString().trim(),
          institucion: (typeof institucion === 'object' ? institucion?.nombre : institucion || '').toString().trim(),
        } as GradoAcademico;
      })
      .filter((item: GradoAcademico) => !!(item.nivelNombre && item.titulo && item.estatusNombre));

    if (normalizados.length === 0) return;
    this.acadGradosList = normalizados;
    const principal = this.acadGradosList[0];
    this.form.patchValue({
      acad_nivel_nombre: principal.nivelNombre || '',
      acad_titulo: principal.titulo || '',
      acad_estatus_nombre: principal.estatusNombre || '',
      acad_institucion: principal.institucion || '',
      acad_cedula_profesional: principal.cedulaProfesional || '',
      acad_opcion_titulacion: principal.opcionTitulacion || '',
      acad_titulo_tesis: principal.tituloTesis || '',
      acad_fecha_obtencion: principal.fechaObtencion || ''
    }, { emitEvent: false });
    this.actualizarValidacionesCondicionales();
  }

  private importarCursosImpartidosDesdePerfil(jsonData: any): void {
    const lista = jsonData?.perfil?.cursosImpartidos;
    if (!Array.isArray(lista) || lista.length === 0) return;

    const normalizados: CursoImpartido[] = lista
      .map((item: any) => {
        const institucion = item?.institucion;
        const nivel = item?.nivelEscolaridad;
        const horasRaw = item?.horasTotales;
        const horas = Number(horasRaw);
        return {
          nombre: (item?.nombreCurso || '').toString().trim(),
          programa: (item?.nombrePrograma || '').toString().trim(),
          horasTotales: Number.isNaN(horas) ? 0 : Math.max(0, horas),
          fechaInicio: (item?.fechaInicio || '').toString().trim(),
          fechaFin: (item?.fechaFin || '').toString().trim(),
          institucion: (typeof institucion === 'object' ? institucion?.nombre : institucion || '').toString().trim(),
          nivelEscolaridad: (typeof nivel === 'object' ? nivel?.nombre : nivel || '').toString().trim(),
          productoPrincipal: !!item?.productoPrincipal,
        } as CursoImpartido;
      })
      .filter((item: CursoImpartido) => !!(item.nombre && item.programa && item.fechaInicio && item.institucion && item.nivelEscolaridad));

    if (normalizados.length === 0) return;
    this.cursosImpartidosList = normalizados;
    const principal = this.cursosImpartidosList[0];
    this.form.patchValue({
      curso_nombre: principal.nombre || '',
      curso_programa: principal.programa || '',
      curso_horas_totales: principal.horasTotales ?? 0,
      curso_fecha_inicio: principal.fechaInicio || '',
      curso_fecha_fin: principal.fechaFin || '',
      curso_institucion: principal.institucion || '',
      curso_nivel_escolaridad: principal.nivelEscolaridad || '',
      curso_producto_principal: !!principal.productoPrincipal
    }, { emitEvent: false });
    this.actualizarValidacionesCondicionales();
  }

  private cargarIdiomasGuardados(): void {
    if (!this.authService.isLoggedIn() || this.idiomasDominioList.length > 0) {
      return;
    }
    this.http.get<any[]>(environment.apiBaseUrl + '/trayectoria/idiomas').subscribe({
      next: (lista) => {
        if (!Array.isArray(lista) || lista.length === 0 || this.idiomasDominioList.length > 0) {
          return;
        }
        this.idiomasDominioList = lista
          .map(item => this.normalizarIdioma(item))
          .filter(item => !!(item.nombre && item.dominioNombre));
        if (this.idiomasDominioList.length > 0) {
          this.editarIdiomaDominio(0);
          this.editingIdiomaIndex = null;
          this.saveDraft();
        }
      },
      error: () => {
        // El formulario sigue disponible aunque no existan idiomas previos.
      }
    });
  }

  private importarIdiomasDesdePerfil(jsonData: any): void {
    const lista = jsonData?.perfil?.idiomaLengua?.idiomas;
    if (!Array.isArray(lista) || lista.length === 0) return;

    const normalizados = lista
      .map((item: any) => this.normalizarIdioma(item))
      .filter((item: IdiomaDominio) => !!(item.nombre && item.dominioNombre));
    if (normalizados.length === 0) return;

    this.idiomasDominioList = normalizados;
    this.editarIdiomaDominio(0);
    this.editingIdiomaIndex = null;
  }

  private normalizarIdioma(item: any): IdiomaDominio {
    const nombreRaw = item?.nombre;
    const dominioRaw = item?.dominioNombre ?? item?.dominio;
    const nombre = (typeof nombreRaw === 'object' ? nombreRaw?.nombre : nombreRaw || '').toString().trim();
    const dominioOriginal = (typeof dominioRaw === 'object' ? dominioRaw?.nombre : dominioRaw || '').toString().trim();
    const dominioMap: Record<string, string> = {
      'Nivel universitario': 'Excelente',
      'Intermedio': 'Bueno'
    };
    return {
      nombre,
      dominioNombre: dominioMap[dominioOriginal] || dominioOriginal,
      conversacion: (typeof item?.conversacion === 'object' ? item?.conversacion?.nombre : item?.conversacion || '').toString().trim(),
      lectura: (typeof item?.lectura === 'object' ? item?.lectura?.nombre : item?.lectura || '').toString().trim(),
      escritura: (typeof item?.escritura === 'object' ? item?.escritura?.nombre : item?.escritura || '').toString().trim(),
      esCertificado: !!item?.esCertificado,
      certInstitucion: (item?.certInstitucion ?? item?.nombreInstitucion ?? '').toString().trim(),
      certPuntuacion: (item?.certPuntuacion ?? item?.puntuacion ?? '').toString().trim(),
      vigenciaFin: (item?.vigenciaFin ?? item?.finVigencia ?? '').toString().trim(),
      certDocumento: null,
      certDocumentoNombre: (item?.certDocumentoNombre || this.archivosGuardados['idioma_cert_documento']?.nombre || '').toString().trim(),
      certDocumentoPersistido: !!item?.certDocumentoPersistido || (!!this.archivosGuardados['idioma_cert_documento'] && !!item?.esCertificado)
    };
  }
  private importarEstanciasDesdePerfil(jsonData: any): void {
    const lista = jsonData?.perfil?.estancias;
    if (!Array.isArray(lista) || lista.length === 0) return;

    const normalizadas: EstanciaInvestigacion[] = lista
      .map((item: any) => {
        const tipo = item?.tipo;
        const institucion = item?.institucion;
        return {
          nombreProyecto: (item?.nombre || '').toString().trim(),
          tipoNombre: (typeof tipo === 'object' ? tipo?.nombre : tipo || '').toString().trim(),
          logros: (item?.logros || '').toString().trim(),
          fechaInicio: (item?.fechaInicio || '').toString().trim(),
          fechaFin: (item?.fechaFin || '').toString().trim(),
          institucionReceptora: (typeof institucion === 'object' ? institucion?.nombre : institucion || '').toString().trim(),
        } as EstanciaInvestigacion;
      })
      .filter((item: EstanciaInvestigacion) => !!(item.nombreProyecto && item.tipoNombre && item.fechaInicio && item.institucionReceptora));

    if (normalizadas.length === 0) return;
    this.estanciasInvestigacionList = normalizadas;
    const principal = this.estanciasInvestigacionList[0];
    this.form.patchValue({
      estancia_nombre_proyecto: principal.nombreProyecto || '',
      estancia_tipo_nombre: principal.tipoNombre || '',
      estancia_logros: principal.logros || '',
      estancia_fecha_inicio: principal.fechaInicio || '',
      estancia_fecha_fin: principal.fechaFin || '',
      estancia_institucion_receptora: principal.institucionReceptora || '',
    }, { emitEvent: false });
    this.actualizarValidacionesCondicionales();
  }

  private importarDivulgacionesDesdePerfil(jsonData: any): void {
    const lista = jsonData?.perfil?.divulgacion;
    if (!Array.isArray(lista) || lista.length === 0) return;

    const normalizadas: DivulgacionCientifica[] = lista
      .map((item: any) => {
        const tipo = item?.tipoDivulgacion;
        const medio = item?.tipoMedio;
        const dirigido = item?.dirigidoA;
        const productoArr = Array.isArray(item?.productoObtenido) ? item.productoObtenido : [];
        const productoRaw = productoArr.length > 0 ? productoArr[0] : '';
        const producto = (typeof productoRaw === 'object' ? productoRaw?.nombre : productoRaw || '').toString().trim();
        const usaLink = this.esProductoConEvidenciaLink(producto);
        return {
          titulo: (item?.tituloTrabajo || '').toString().trim(),
          tipoDivulgacionNombre: (typeof tipo === 'object' ? tipo?.nombre : tipo || '').toString().trim(),
          medioNombre: (typeof medio === 'object' ? medio?.nombre : medio || '').toString().trim(),
          dirigidoA: (typeof dirigido === 'object' ? dirigido?.nombre : dirigido || '').toString().trim(),
          productoObtenidoNombre: producto,
          fecha: (item?.fecha || '').toString().trim(),
          institucionOrganizadora: (item?.nombreInstitucion || '').toString().trim(),
          evidenciaTipo: usaLink ? 'LINK' : 'PDF',
          evidenciaLink: '',
          evidenciaArchivo: null,
          evidenciaArchivoNombre: ''
        } as DivulgacionCientifica;
      })
      .filter((item: DivulgacionCientifica) => !!(item.titulo && item.tipoDivulgacionNombre && item.medioNombre && item.productoObtenidoNombre));

    if (normalizadas.length === 0) return;
    this.divulgacionesCientificasList = normalizadas;
    const principal = this.divulgacionesCientificasList[0];
    this.form.patchValue({
      divulg_titulo: principal.titulo || '',
      divulg_tipo_div_nombre: principal.tipoDivulgacionNombre || '',
      divulg_medio_nombre: principal.medioNombre || '',
      divulg_dirigido_a: principal.dirigidoA || '',
      divulg_prod_obtenido_nombre: principal.productoObtenidoNombre || '',
      divulg_fecha: principal.fecha || '',
      divulg_institucion_organizadora: principal.institucionOrganizadora || '',
      divulg_evidencia_link: principal.evidenciaTipo === 'LINK' ? (principal.evidenciaLink || '') : '',
      divulg_archivo: null
    }, { emitEvent: false });
    this.actualizarValidacionesCondicionales();
  }

  private importarLogrosDesdePerfil(jsonData: any): void {
    const lista = jsonData?.perfil?.logros;
    if (!Array.isArray(lista) || lista.length === 0) return;

    const normalizados: LogroReconocimiento[] = lista
      .map((item: any) => {
        const anioRaw = item?.anio;
        const anioNum = Number(anioRaw);
        return {
          tipo: (item?.tipo || '').toString().trim(),
          nombre: (typeof item?.nombre === 'object' ? item?.nombre?.nombre : item?.nombre || '').toString().trim(),
          anio: Number.isNaN(anioNum) ? null : Math.max(0, Math.trunc(anioNum))
        } as LogroReconocimiento;
      })
      .filter((item: LogroReconocimiento) => !!(item.nombre && item.anio !== null));

    if (normalizados.length === 0) return;
    this.logrosReconocimientosList = normalizados;
    const principal = this.logrosReconocimientosList[0];
    this.form.patchValue({
      logro_tipo: principal.tipo || '',
      logro_nombre: principal.nombre || '',
      logro_anio: principal.anio ?? null
    }, { emitEvent: false });
    this.actualizarValidacionesCondicionales();
  }
  private loadCatalogos(): void {
    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/entidades-federativas`).subscribe({
      next: (data) => {
        const items = this.mapCatalogItems(data);
        if (items.length > 0) {
          this.catalogoEntidadesFederativas = items;
          this.entidadesFederativas = items.map(item => item.nombre);
          this.sincronizarValoresCatalogoActuales();
        }
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/nacionalidades`).subscribe({
      next: (data) => {
        this.catalogoNacionalidades = this.mapCatalogItems(data);
        this.sincronizarValoresCatalogoActuales();
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/estados-civiles`).subscribe({
      next: (data) => {
        const items = this.mapCatalogItems(data);
        if (items.length > 0) {
          this.catalogoEstadosCiviles = items;
          this.sincronizarValoresCatalogoActuales();
        }
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/identificaciones-oficiales`).subscribe({
      next: (data) => {
        const items = this.mapCatalogItems(data);
        if (items.length > 0) {
          this.catalogoIdentificaciones = items;
        }
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/redes-sociales`).subscribe({
      next: (data) => {
        this.catalogoRedesSociales = this.mapCatalogItems(data);
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/municipios`).subscribe({
      next: (data) => {
        this.catalogoMunicipios = this.mapCatalogItems(data);
        this.actualizarLocalidadesFiltradas();
        this.sincronizarValoresCatalogoActuales();
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/localidades`).subscribe({
      next: (data) => {
        this.catalogoLocalidades = this.mapCatalogItems(data);
        this.actualizarLocalidadesFiltradas();
        this.sincronizarValoresCatalogoActuales();
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/tipos-institucion`).subscribe({
      next: (data) => {
        const items = this.agregarOpcionCatalogo(this.mapCatalogItems(data), 'OTRO', 'Otro');
        if (items.length > 0) {
          this.catalogoTiposInstitucion = items;
          this.sincronizarValoresCatalogoActuales();
        }
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/grados-estudios`).subscribe({
      next: (data) => {
        const items = this.agregarOpcionCatalogo(this.mapCatalogItems(data), 'OTRO', 'Otro');
        if (items.length > 0) {
          this.catalogoGradosEstudio = items;
          this.sincronizarValoresCatalogoActuales();
        }
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/catalogos/carreras`).subscribe({
      next: (data) => {
        this.catalogoCarreras = this.mapCatalogItems(data);
      },
      error: () => {}
    });

    this.http.get<any[]>(`${environment.apiBaseUrl}/instituciones-educativas/activas`).subscribe({
      next: (data) => {
        this.catalogoInstitucionesEducativas = this.mapInstitucionesEducativas(data);
        this.sincronizarValoresCatalogoActuales();
      },
      error: () => {}
    });
  }
  private configurarSuscripcionesCatalogo(): void {
    this.form.get('pers_entidad_nombre')?.valueChanges.subscribe(() => this.onEntidadFederativaChange());
    this.form.get('pers_estado_civil_nombre')?.valueChanges.subscribe(() => this.onEstadoCivilChange());
    this.form.get('pers_nacionalidad_nombre')?.valueChanges.subscribe(() => this.onNacionalidadCatalogChange());
    this.form.get('municipioDomicilio')?.valueChanges.subscribe(() => this.onMunicipioDomicilioChange());
    this.form.get('localidad')?.valueChanges.subscribe(() => this.onLocalidadChange());
    this.form.get('claveMunicipio')?.valueChanges.subscribe(() => this.actualizarLocalidadesFiltradas());
    this.form.get('inst_tipo_id')?.valueChanges.subscribe(() => this.onTipoInstitucionChange());
    this.form.get('inst_nombre')?.valueChanges.subscribe(() => this.onInstitucionEducativaChange());
    this.form.get('inst_nombre')?.valueChanges.subscribe(() => this.actualizarSeleccionInstitucionDesdeTexto('inst_nombre'));
    this.form.get('acad_institucion')?.valueChanges.subscribe(() => this.actualizarSeleccionInstitucionDesdeTexto('acad_institucion'));
    this.form.get('tray_prof_institucion')?.valueChanges.subscribe(() => this.actualizarSeleccionInstitucionDesdeTexto('tray_prof_institucion'));
    this.form.get('curso_institucion')?.valueChanges.subscribe(() => this.actualizarSeleccionInstitucionDesdeTexto('curso_institucion'));
    this.form.get('acad_titulo')?.valueChanges.subscribe(() => this.actualizarSeleccionCarreraDesdeTexto());
    this.form.get('pers_nacionalidad_nombre')?.valueChanges.subscribe(() => this.actualizarSeleccionNacionalidadDesdeTexto());
    this.form.get('pers_municipio_nombre')?.valueChanges.subscribe(() => this.actualizarSeleccionMunicipioNacimientoDesdeTexto());
    this.form.get('claveEntidadFederativa')?.valueChanges.subscribe(() => this.actualizarSeleccionEntidadDomicilioDesdeClave());
    this.form.get('municipioDomicilio')?.valueChanges.subscribe(() => this.actualizarSeleccionMunicipioDesdeTexto());
    this.form.get('localidad')?.valueChanges.subscribe(() => this.actualizarSeleccionLocalidadDesdeTexto());
    this.form.get('claveRedSocial')?.valueChanges.subscribe(() => this.actualizarSeleccionRedSocialDesdeTexto());
    this.form.get('acad_nivel_nombre')?.valueChanges.subscribe(() => this.actualizarSeleccionGradoDesdeTexto());
    this.form.get('acad_estatus_nombre')?.valueChanges.subscribe(() => this.sincronizarTextoManualSiCorresponde('acad_estatus_nombre', this.opcionesEstatusAcademico, (value) => this.acadEstatusManual = value));
    this.form.get('curso_nivel_escolaridad')?.valueChanges.subscribe(() => this.sincronizarTextoManualSiCorresponde('curso_nivel_escolaridad', this.opcionesNivelCurso, (value) => this.cursoNivelManual = value));
    this.form.get('estancia_tipo_nombre')?.valueChanges.subscribe(() => this.sincronizarTextoManualSiCorresponde('estancia_tipo_nombre', this.opcionesTipoEstancia, (value) => this.estanciaTipoManual = value));
    this.form.get('divulg_tipo_div_nombre')?.valueChanges.subscribe(() => this.sincronizarTextoManualSiCorresponde('divulg_tipo_div_nombre', this.opcionesTipoDivulgacion, (value) => this.divulgTipoManual = value));
    this.form.get('divulg_medio_nombre')?.valueChanges.subscribe(() => this.sincronizarTextoManualSiCorresponde('divulg_medio_nombre', this.opcionesMedioDivulgacion, (value) => this.divulgMedioManual = value));
    this.form.get('divulg_dirigido_a')?.valueChanges.subscribe(() => this.sincronizarTextoManualSiCorresponde('divulg_dirigido_a', this.opcionesDirigidoADivulgacion, (value) => this.divulgDirigidoManual = value));
    this.form.get('divulg_prod_obtenido_nombre')?.valueChanges.subscribe(() => this.sincronizarTextoManualSiCorresponde('divulg_prod_obtenido_nombre', this.opcionesProductoDivulgacion, (value) => this.divulgProductoManual = value));
  }
  onEntidadFederativaChange(): void {
    const nombre = (this.form.get('pers_entidad_nombre')?.value || '').toString().trim();
    const match = this.buscarCatalogoPorNombre(this.catalogoEntidadesFederativas, nombre);
    this.form.patchValue({ pers_entidad_clave: match?.clave || '' }, { emitEvent: false });
  }

  onEstadoCivilChange(): void {
    const nombre = (this.form.get('pers_estado_civil_nombre')?.value || '').toString().trim();
    const match = this.buscarCatalogoPorNombre(this.catalogoEstadosCiviles, nombre);
    this.form.patchValue({ pers_estado_civil_id: match?.clave || '' }, { emitEvent: false });
  }

  onNacionalidadCatalogChange(): void {
    const nombre = (this.form.get('pers_nacionalidad_nombre')?.value || '').toString().trim();
    const match = this.buscarCatalogoPorNombre(this.catalogoNacionalidades, nombre);
    this.form.patchValue({ pers_nacionalidad_id: match?.clave || '' }, { emitEvent: false });
  }

  onMunicipioDomicilioChange(): void {
    const nombre = (this.form.get('municipioDomicilio')?.value || '').toString().trim();
    const match = this.buscarCatalogoPorNombre(this.catalogoMunicipios, nombre);
    const patch: Record<string, string> = {
      claveMunicipio: match?.clave || ''
    };
    const claveEntidad = match ? this.obtenerClaveEntidadFederativaDomicilio() : '';
    if (claveEntidad) {
      patch['claveEntidadFederativa'] = claveEntidad;
    }
    this.form.patchValue(patch, { emitEvent: false });
    this.actualizarLocalidadesFiltradas();
    if (this.catalogoLocalidades.length > 0 && this.puedeSeleccionarMunicipioCatalogo()) {
      this.limpiarSeleccionLocalidadSiNoCorresponde();
    }
  }

  onLocalidadChange(): void {
    const nombre = (this.form.get('localidad')?.value || '').toString().trim();
    const match = this.buscarCatalogoPorNombre(this.obtenerCatalogoLocalidadesDisponibles(), nombre);
    const patch: Record<string, string> = {
      claveLocalidad: match?.clave || ''
    };

    if (match?.parentKey) {
      patch['claveMunicipio'] = match.parentKey;
      const municipio = this.buscarCatalogoPorClave(this.catalogoMunicipios, match.parentKey);
      if (municipio?.nombre) {
        patch['municipioDomicilio'] = municipio.nombre;
        this.selectedMunicipioNombre = municipio.nombre;
      }
    }

    if (match?.extra1) {
      patch['codigoPostal'] = match.extra1;
    }

    const claveEntidad = match ? this.obtenerClaveEntidadFederativaDomicilio() : '';
    if (claveEntidad) {
      patch['claveEntidadFederativa'] = claveEntidad;
    }

    this.form.patchValue(patch, { emitEvent: false });

    if (match?.parentKey || match?.extra1) {
      this.actualizarLocalidadesFiltradas();
    }
  }

  onTipoInstitucionChange(): void {
    const clave = (this.form.get('inst_tipo_id')?.value || '').toString().trim();
    const match = this.catalogoTiposInstitucion.find(item => this.normalizarCatalogo(item.clave) === this.normalizarCatalogo(clave)) || null;

    if (this.esValorOtro(clave)) {
      const actual = (this.form.get('inst_tipo_nombre')?.value || '').toString().trim();
      if (!actual || this.esValorOtro(actual) || this.catalogoTiposInstitucion.some(item => this.normalizarCatalogo(item.nombre) === this.normalizarCatalogo(actual))) {
        this.form.patchValue({ inst_tipo_nombre: '' }, { emitEvent: false });
      }
      return;
    }

    this.form.patchValue({ inst_tipo_nombre: match?.nombre || '' }, { emitEvent: false });
  }

  onInstitucionEducativaChange(): void {
    const nombre = (this.form.get('inst_nombre')?.value || '').toString().trim();
    const match = this.buscarInstitucionEducativaPorNombre(nombre);
    if (!match) {
      if (!nombre) {
        this.form.patchValue({ inst_clave_oficial: '' }, { emitEvent: false });
      }
      return;
    }

    const patch: Record<string, string> = {};
    const cct = (match.cct || '').toString().trim();
    if (cct) {
      patch['inst_clave_oficial'] = cct;
    }

    if (match.nivelEducativo && !(this.form.get('inst_nivel_uno_nombre')?.value || '').toString().trim()) {
      patch['inst_nivel_uno_nombre'] = match.nivelEducativo;
    }
    if (match.entidadFederativa) {
      patch['inst_entidad_nombre'] = match.entidadFederativa;
    }
    if (match.municipio) {
      patch['inst_municipio_nombre'] = match.municipio;
    }
    if ((match.entidadFederativa || match.municipio) && !(this.form.get('inst_pais_nombre')?.value || '').toString().trim()) {
      patch['inst_pais_nombre'] = 'México';
    }

    this.form.patchValue(patch, { emitEvent: false });
  }

  onInstitucionCatalogoChange(controlName: InstitucionCatalogControl, selectedValue: string): void {
    this.asignarSeleccionInstitucion(controlName, selectedValue);
    if (selectedValue === this.catalogoOtroValue) {
      const control = this.form.get(controlName);
      const currentValue = (control?.value || '').toString().trim();
      if (!currentValue || this.buscarInstitucionEducativaPorNombre(currentValue)) {
        control?.setValue('');
      }
      return;
    }

    const institucion = this.buscarInstitucionEducativaPorId(selectedValue);
    this.form.get(controlName)?.setValue(institucion?.nombre || '');
  }

  onCarreraCatalogoChange(selectedValue: string): void {
    this.selectedCarreraClave = selectedValue;
    if (selectedValue === this.catalogoOtroValue) {
      const control = this.form.get('acad_titulo');
      const currentValue = (control?.value || '').toString().trim();
      if (!currentValue || this.buscarCatalogoPorNombre(this.catalogoCarreras, currentValue)) {
        control?.setValue('');
      }
      return;
    }

    const carrera = this.buscarCatalogoPorClave(this.catalogoCarreras, selectedValue);
    this.form.get('acad_titulo')?.setValue(carrera?.nombre || '');
  }

  onNacionalidadCatalogoChange(selectedValue: string): void {
    this.selectedNacionalidadNombre = selectedValue;
    if (selectedValue === this.catalogoOtroValue) {
      const control = this.form.get('pers_nacionalidad_nombre');
      const currentValue = (control?.value || '').toString().trim();
      if (!currentValue || this.buscarCatalogoPorNombre(this.catalogoNacionalidades, currentValue)) {
        control?.setValue('');
      }
      return;
    }
    this.form.get('pers_nacionalidad_nombre')?.setValue(selectedValue || '');
  }

  onMunicipioNacimientoCatalogoChange(selectedValue: string): void {
    this.selectedMunicipioNacimientoNombre = selectedValue;
    const control = this.form.get('pers_municipio_nombre');

    if (selectedValue === this.catalogoOtroValue) {
      const currentValue = (control?.value || '').toString().trim();
      if (!currentValue || this.buscarCatalogoPorNombre(this.catalogoMunicipios, currentValue)) {
        control?.setValue('');
      }
      return;
    }

    control?.setValue(selectedValue || '');
  }

  onEntidadFederativaDomicilioCatalogoChange(selectedValue: string): void {
    this.selectedEntidadDomicilioNombre = selectedValue;
    const match = this.buscarCatalogoPorNombre(this.catalogoEntidadesFederativas, selectedValue);
    const patch: Record<string, string> = {
      claveEntidadFederativa: match?.clave || ''
    };

    if (match && !this.esEntidadFederativaPadronDomicilio(match)) {
      patch['municipioDomicilio'] = '';
      patch['claveMunicipio'] = '';
      patch['localidad'] = '';
      patch['claveLocalidad'] = '';
      patch['codigoPostal'] = '';
      this.selectedMunicipioNombre = '';
      this.selectedLocalidadNombre = '';
    }

    this.form.patchValue(patch, { emitEvent: false });
    this.actualizarLocalidadesFiltradas();
  }

  onMunicipioCatalogoChange(selectedValue: string): void {
    this.selectedMunicipioNombre = selectedValue;
    this.selectedLocalidadNombre = '';

    if (selectedValue === this.catalogoOtroValue) {
      const control = this.form.get('municipioDomicilio');
      const currentValue = (control?.value || '').toString().trim();
      if (!currentValue || this.buscarCatalogoPorNombre(this.catalogoMunicipios, currentValue)) {
        control?.setValue('');
      }
      this.form.patchValue({
        claveMunicipio: '',
        localidad: '',
        claveLocalidad: '',
        codigoPostal: ''
      }, { emitEvent: false });
      this.actualizarLocalidadesFiltradas();
      return;
    }

    this.form.patchValue({
      municipioDomicilio: selectedValue || '',
      localidad: '',
      claveLocalidad: '',
      codigoPostal: ''
    });
  }

  onLocalidadCatalogoChange(selectedValue: string): void {
    this.selectedLocalidadNombre = selectedValue;
    if (selectedValue === this.catalogoOtroValue) {
      const control = this.form.get('localidad');
      const currentValue = (control?.value || '').toString().trim();
      const items = this.obtenerCatalogoLocalidadesDisponibles();
      if (!currentValue || this.buscarCatalogoPorNombre(items, currentValue)) {
        control?.setValue('');
      }
      this.form.patchValue({ claveLocalidad: '' }, { emitEvent: false });
      return;
    }
    this.form.get('localidad')?.setValue(selectedValue || '');
  }

  onRedSocialCatalogoChange(selectedValue: string): void {
    this.selectedRedSocialClave = selectedValue;
    if (selectedValue === this.catalogoOtroValue) {
      const control = this.form.get('claveRedSocial');
      const currentValue = (control?.value || '').toString().trim();
      if (!currentValue || this.buscarCatalogoPorClave(this.catalogoRedesSociales, currentValue)) {
        control?.setValue('');
      }
      return;
    }
    this.form.get('claveRedSocial')?.setValue(selectedValue || '');
  }

  onGradoCatalogoChange(selectedValue: string): void {
    this.selectedGradoNombre = selectedValue;
    if (selectedValue === this.catalogoOtroValue) {
      const control = this.form.get('acad_nivel_nombre');
      const currentValue = (control?.value || '').toString().trim();
      if (!currentValue || this.buscarCatalogoPorNombre(this.catalogoGradosEstudio, currentValue)) {
        control?.setValue('');
      }
      return;
    }
    this.form.get('acad_nivel_nombre')?.setValue(selectedValue || '');
  }

  esValorOtro(value: string | null | undefined): boolean {
    const normalizado = this.normalizarCatalogo((value || '').toString().trim());
    return normalizado === 'otro' || value === this.catalogoOtroValue;
  }

  private resolverValorConOtro(value: string | null | undefined, manualValue: string | null | undefined): string {
    const valor = (value || '').toString().trim();
    if (!this.esValorOtro(valor)) {
      return valor;
    }
    return (manualValue || '').toString().trim();
  }

  private obtenerValorSelectConOtro(value: string | null | undefined, opciones: string[]): string {
    const valor = (value || '').toString().trim();
    if (!valor) {
      return '';
    }
    return opciones.some(opcion => this.normalizarCatalogo(opcion) === this.normalizarCatalogo(valor)) ? valor : 'Otro';
  }

  private obtenerTextoManualDesdeValor(value: string | null | undefined, opciones: string[]): string {
    const valor = (value || '').toString().trim();
    if (!valor) {
      return '';
    }
    return opciones.some(opcion => this.normalizarCatalogo(opcion) === this.normalizarCatalogo(valor)) ? '' : valor;
  }

  private sincronizarTextoManualSiCorresponde(controlName: string, opciones: string[], assign: (value: string) => void): void {
    const valor = (this.form.get(controlName)?.value || '').toString().trim();
    if (!valor || this.esValorOtro(valor)) {
      if (!this.esValorOtro(valor)) {
        assign('');
      }
      return;
    }
    assign(this.obtenerTextoManualDesdeValor(valor, opciones));
  }

  private sincronizarValoresCatalogoActuales(): void {
    if (this.catalogoEntidadesFederativas.length > 0) {
      this.onEntidadFederativaChange();
      this.actualizarSeleccionEntidadDomicilioDesdeClave();
    }
    if (this.catalogoEstadosCiviles.length > 0) {
      this.onEstadoCivilChange();
    }
    if (this.catalogoNacionalidades.length > 0) {
      this.onNacionalidadCatalogChange();
      this.actualizarSeleccionNacionalidadDesdeTexto();
    }
    if (this.catalogoMunicipios.length > 0) {
      this.onMunicipioDomicilioChange();
      this.actualizarSeleccionMunicipioNacimientoDesdeTexto();
      this.actualizarSeleccionMunicipioDesdeTexto();
    }
    if (this.catalogoLocalidades.length > 0) {
      this.onLocalidadChange();
      this.actualizarSeleccionLocalidadDesdeTexto();
    }
    if (this.catalogoTiposInstitucion.length > 0) {
      this.onTipoInstitucionChange();
    }
    if (this.catalogoInstitucionesEducativas.length > 0) {
      this.onInstitucionEducativaChange();
      this.actualizarSeleccionInstitucionDesdeTexto('inst_nombre');
      this.actualizarSeleccionInstitucionDesdeTexto('acad_institucion');
      this.actualizarSeleccionInstitucionDesdeTexto('tray_prof_institucion');
      this.actualizarSeleccionInstitucionDesdeTexto('curso_institucion');
    }
    if (this.catalogoCarreras.length > 0) {
      this.actualizarSeleccionCarreraDesdeTexto();
    }
    if (this.catalogoRedesSociales.length > 0) {
      this.actualizarSeleccionRedSocialDesdeTexto();
    }
    if (this.catalogoGradosEstudio.length > 0) {
      this.actualizarSeleccionGradoDesdeTexto();
    }
    this.sincronizarTextoManualSiCorresponde('acad_estatus_nombre', this.opcionesEstatusAcademico, (value) => this.acadEstatusManual = value);
    this.sincronizarTextoManualSiCorresponde('curso_nivel_escolaridad', this.opcionesNivelCurso, (value) => this.cursoNivelManual = value);
    this.sincronizarTextoManualSiCorresponde('estancia_tipo_nombre', this.opcionesTipoEstancia, (value) => this.estanciaTipoManual = value);
    this.sincronizarTextoManualSiCorresponde('divulg_tipo_div_nombre', this.opcionesTipoDivulgacion, (value) => this.divulgTipoManual = value);
    this.sincronizarTextoManualSiCorresponde('divulg_medio_nombre', this.opcionesMedioDivulgacion, (value) => this.divulgMedioManual = value);
    this.sincronizarTextoManualSiCorresponde('divulg_dirigido_a', this.opcionesDirigidoADivulgacion, (value) => this.divulgDirigidoManual = value);
    this.sincronizarTextoManualSiCorresponde('divulg_prod_obtenido_nombre', this.opcionesProductoDivulgacion, (value) => this.divulgProductoManual = value);
  }
  private actualizarLocalidadesFiltradas(): void {
    const municipioClave = (this.form.get('claveMunicipio')?.value || '').toString().trim();
    let items = [...this.catalogoLocalidades];

    if (municipioClave) {
      items = items.filter(item => this.normalizarCatalogo(item.parentKey) === this.normalizarCatalogo(municipioClave));
    } else {
      const municipioNombre = (this.form.get('municipioDomicilio')?.value || '').toString().trim();
      const municipio = this.buscarCatalogoPorNombre(this.catalogoMunicipios, municipioNombre);
      if (municipio?.clave) {
        items = items.filter(item => this.normalizarCatalogo(item.parentKey) === this.normalizarCatalogo(municipio.clave));
      } else if (municipioNombre) {
        items = [];
      }
    }

    this.catalogoLocalidadesFiltradas = items.slice(0, 500);
    this.actualizarSeleccionLocalidadDesdeTexto();
  }

  private obtenerCatalogoLocalidadesDisponibles(): CatalogItem[] {
    return this.catalogoLocalidadesFiltradas.length > 0 ? this.catalogoLocalidadesFiltradas : this.catalogoLocalidades;
  }

  private obtenerEntidadFederativaPadronDomicilio(): CatalogItem | null {
    return this.catalogoEntidadesFederativas.find(item => this.esEntidadFederativaPadronDomicilio(item)) || null;
  }

  private esEntidadFederativaPadronDomicilio(item: CatalogItem): boolean {
    const nombre = this.normalizarCatalogo(item.nombre);
    const clave = this.normalizarCatalogo(item.clave);
    const abreviatura = this.normalizarCatalogo(item.extra1);
    return nombre === 'mexico'
      || nombre === 'estado de mexico'
      || clave === '15'
      || abreviatura === 'mc';
  }

  private obtenerClaveEntidadFederativaDomicilio(): string {
    const entidad = this.obtenerEntidadFederativaPadronDomicilio();
    return entidad?.clave || (this.form.get('claveEntidadFederativa')?.value || '').toString().trim();
  }

  private limpiarSeleccionLocalidadSiNoCorresponde(): void {
    if (this.selectedLocalidadNombre === this.catalogoOtroValue) {
      this.form.patchValue({ claveLocalidad: '' }, { emitEvent: false });
      return;
    }

    const nombre = (this.form.get('localidad')?.value || '').toString().trim();
    if (!nombre) {
      this.selectedLocalidadNombre = '';
      this.form.patchValue({ claveLocalidad: '' }, { emitEvent: false });
      return;
    }

    const match = this.buscarCatalogoPorNombre(this.obtenerCatalogoLocalidadesDisponibles(), nombre);
    if (!match) {
      this.selectedLocalidadNombre = '';
      this.form.patchValue({ localidad: '', claveLocalidad: '' }, { emitEvent: false });
      return;
    }

    this.form.patchValue({ claveLocalidad: match.clave || '' }, { emitEvent: false });
  }
  private mapCatalogItems(data: any[]): CatalogItem[] {
    if (!Array.isArray(data)) {
      return [];
    }
    return this.ordenarCatalogosPorNombre(
      data
        .map((item) => ({
          clave: (item?.clave || '').toString().trim(),
          nombre: (item?.nombre || '').toString().trim(),
          parentKey: (item?.parentKey || '').toString().trim(),
          extra1: (item?.extra1 || '').toString().trim(),
          extra2: (item?.extra2 || '').toString().trim(),
          extra3: (item?.extra3 || '').toString().trim()
        } as CatalogItem))
        .filter((item) => !!(item.clave || item.nombre))
    );
  }

  private mapInstitucionesEducativas(data: any[]): InstitucionEducativaItem[] {
    if (!Array.isArray(data)) {
      return [];
    }

    const instituciones = data
      .map((item) => ({
        id: item?.id != null ? Number(item.id) : null,
        cct: (item?.cct || '').toString().trim(),
        nombre: (item?.nombre || '').toString().trim(),
        domicilio: (item?.domicilio || '').toString().trim(),
        colonia: (item?.colonia || '').toString().trim(),
        codigoPostal: (item?.codigoPostal || '').toString().trim(),
        municipio: (item?.municipio || '').toString().trim(),
        entidadFederativa: (item?.entidadFederativa || '').toString().trim(),
        telefono: (item?.telefono || '').toString().trim(),
        director: (item?.director || '').toString().trim(),
        correo: (item?.correo || '').toString().trim(),
        nivelEducativo: (item?.nivelEducativo || '').toString().trim(),
        estado: (item?.estado || '').toString().trim()
      } as InstitucionEducativaItem))
      .filter((item) => !!item.nombre);

    return this.ordenarInstitucionesPorNombre(this.deduplicarInstitucionesEducativas(instituciones));
  }

  private buscarCatalogoPorNombre(items: CatalogItem[], nombre: string): CatalogItem | null {
    const buscado = this.normalizarCatalogo(nombre);
    if (!buscado) {
      return null;
    }
    return items.find(item => this.normalizarCatalogo(item.nombre) === buscado) || null;
  }

  private buscarCatalogoPorClave(items: CatalogItem[], clave: string): CatalogItem | null {
    const buscado = this.normalizarCatalogo(clave);
    if (!buscado) {
      return null;
    }
    return items.find(item => this.normalizarCatalogo(item.clave) === buscado) || null;
  }

  private agregarOpcionCatalogo(items: CatalogItem[], clave: string, nombre: string): CatalogItem[] {
    const resultado = [...items];
    const existe = resultado.some(item => this.normalizarCatalogo(item.clave) === this.normalizarCatalogo(clave) || this.normalizarCatalogo(item.nombre) === this.normalizarCatalogo(nombre));
    if (!existe) {
      resultado.push({ clave, nombre });
    }
    return this.ordenarCatalogosPorNombre(resultado);
  }

  private buscarInstitucionEducativaPorNombre(nombre: string): InstitucionEducativaItem | null {
    const buscado = this.obtenerLlaveInstitucionNormalizada(nombre);
    if (!buscado) {
      return null;
    }
    return this.catalogoInstitucionesEducativas.find(item => this.obtenerLlaveInstitucionNormalizada(item.nombre) === buscado) || null;
  }

  private buscarInstitucionEducativaPorId(idValue: string): InstitucionEducativaItem | null {
    const buscado = (idValue || '').toString().trim();
    if (!buscado) {
      return null;
    }
    return this.catalogoInstitucionesEducativas.find(item => String(item.id ?? '').trim() === buscado) || null;
  }

  private actualizarSeleccionInstitucionDesdeTexto(controlName: InstitucionCatalogControl): void {
    const nombre = (this.form.get(controlName)?.value || '').toString().trim();
    if (!nombre && this.obtenerSeleccionInstitucion(controlName) === this.catalogoOtroValue) {
      return;
    }
    const match = this.buscarInstitucionEducativaPorNombre(nombre);
    const selectedValue = match?.id != null ? String(match.id) : (nombre ? this.catalogoOtroValue : '');
    this.asignarSeleccionInstitucion(controlName, selectedValue);
  }

  private actualizarSeleccionCarreraDesdeTexto(): void {
    const nombre = (this.form.get('acad_titulo')?.value || '').toString().trim();
    if (!nombre && this.selectedCarreraClave === this.catalogoOtroValue) {
      return;
    }
    const match = this.buscarCatalogoPorNombre(this.catalogoCarreras, nombre);
    this.selectedCarreraClave = this.esOpcionOtroCatalogoItem(match) ? this.catalogoOtroValue : (match?.clave || (nombre ? this.catalogoOtroValue : ''));
  }

  private actualizarSeleccionNacionalidadDesdeTexto(): void {
    const nombre = (this.form.get('pers_nacionalidad_nombre')?.value || '').toString().trim();
    if (!nombre && this.selectedNacionalidadNombre === this.catalogoOtroValue) {
      return;
    }
    const match = this.buscarCatalogoPorNombre(this.catalogoNacionalidades, nombre);
    this.selectedNacionalidadNombre = this.esOpcionOtroCatalogoItem(match) ? this.catalogoOtroValue : (match?.nombre || (nombre ? this.catalogoOtroValue : ''));
  }

  private actualizarSeleccionMunicipioNacimientoDesdeTexto(): void {
    const nombre = (this.form.get('pers_municipio_nombre')?.value || '').toString().trim();
    if (!nombre && this.selectedMunicipioNacimientoNombre === this.catalogoOtroValue) {
      return;
    }
    const match = this.buscarCatalogoPorNombre(this.catalogoMunicipios, nombre);
    this.selectedMunicipioNacimientoNombre = this.esOpcionOtroCatalogoItem(match)
      ? this.catalogoOtroValue
      : (match?.nombre || (nombre ? this.catalogoOtroValue : ''));
  }

  private actualizarSeleccionEntidadDomicilioDesdeClave(): void {
    const clave = (this.form.get('claveEntidadFederativa')?.value || '').toString().trim();
    const match = this.buscarCatalogoPorClave(this.catalogoEntidadesFederativas, clave)
      || this.catalogoEntidadesFederativas.find(item => this.normalizarCatalogo(item.extra1) === this.normalizarCatalogo(clave))
      || null;
    this.selectedEntidadDomicilioNombre = match?.nombre || '';
  }

  private actualizarSeleccionMunicipioDesdeTexto(): void {
    const nombre = (this.form.get('municipioDomicilio')?.value || '').toString().trim();
    if (!nombre && this.selectedMunicipioNombre === this.catalogoOtroValue) {
      return;
    }
    const match = this.buscarCatalogoPorNombre(this.catalogoMunicipios, nombre);
    this.selectedMunicipioNombre = this.esOpcionOtroCatalogoItem(match) ? this.catalogoOtroValue : (match?.nombre || (nombre ? this.catalogoOtroValue : ''));
  }

  private actualizarSeleccionLocalidadDesdeTexto(): void {
    const nombre = (this.form.get('localidad')?.value || '').toString().trim();
    if (!nombre && this.selectedLocalidadNombre === this.catalogoOtroValue) {
      return;
    }
    const items = this.catalogoLocalidadesFiltradas.length > 0 ? this.catalogoLocalidadesFiltradas : this.catalogoLocalidades;
    const match = this.buscarCatalogoPorNombre(items, nombre);
    this.selectedLocalidadNombre = this.esOpcionOtroCatalogoItem(match) ? this.catalogoOtroValue : (match?.nombre || (nombre ? this.catalogoOtroValue : ''));
  }

  private actualizarSeleccionRedSocialDesdeTexto(): void {
    const clave = (this.form.get('claveRedSocial')?.value || '').toString().trim();
    if (!clave && this.selectedRedSocialClave === this.catalogoOtroValue) {
      return;
    }
    const match = this.buscarCatalogoPorClave(this.catalogoRedesSociales, clave);
    this.selectedRedSocialClave = this.esOpcionOtroCatalogoItem(match) ? this.catalogoOtroValue : (match?.clave || (clave ? this.catalogoOtroValue : ''));
  }

  private actualizarSeleccionGradoDesdeTexto(): void {
    const nombre = (this.form.get('acad_nivel_nombre')?.value || '').toString().trim();
    if (!nombre && this.selectedGradoNombre === this.catalogoOtroValue) {
      return;
    }
    const match = this.buscarCatalogoPorNombre(this.catalogoGradosEstudio, nombre);
    this.selectedGradoNombre = this.esOpcionOtroCatalogoItem(match) ? this.catalogoOtroValue : (match?.nombre || (nombre ? this.catalogoOtroValue : ''));
  }

  mostrarCampoManualCatalogo(selectedValue: string | null | undefined): boolean {
    return selectedValue === this.catalogoOtroValue;
  }

  puedeSeleccionarMunicipioNacimientoCatalogo(): boolean {
    const entidadNombre = (this.form.get('pers_entidad_nombre')?.value || '').toString().trim();
    const entidad = this.buscarCatalogoPorNombre(this.catalogoEntidadesFederativas, entidadNombre);
    return !!entidad && this.esEntidadFederativaPadronDomicilio(entidad);
  }

  mostrarCampoManualMunicipioNacimiento(): boolean {
    return !this.puedeSeleccionarMunicipioNacimientoCatalogo()
      || this.mostrarCampoManualCatalogo(this.selectedMunicipioNacimientoNombre);
  }

  puedeSeleccionarMunicipioCatalogo(): boolean {
    const entidad = this.buscarCatalogoPorNombre(this.catalogoEntidadesFederativas, this.selectedEntidadDomicilioNombre || '');
    return !!entidad && this.esEntidadFederativaPadronDomicilio(entidad);
  }

  mostrarCampoManualMunicipio(): boolean {
    return !this.puedeSeleccionarMunicipioCatalogo() || this.mostrarCampoManualCatalogo(this.selectedMunicipioNombre);
  }

  puedeSeleccionarLocalidad(): boolean {
    return this.puedeSeleccionarMunicipioCatalogo() && !!this.selectedMunicipioNombre;
  }

  mostrarCampoManualLocalidad(): boolean {
    return !this.puedeSeleccionarMunicipioCatalogo() || this.mostrarCampoManualCatalogo(this.selectedLocalidadNombre);
  }

  codigoPostalEsAutomatico(): boolean {
    return this.puedeSeleccionarMunicipioCatalogo() && this.esSeleccionCatalogo(this.selectedLocalidadNombre);
  }

  esSeleccionCatalogo(selectedValue: string | null | undefined): boolean {
    return !!selectedValue && selectedValue !== this.catalogoOtroValue;
  }

  catalogoVisibleSinOtro(items: CatalogItem[]): CatalogItem[] {
    return items.filter(item => !this.esOpcionOtroCatalogoItem(item));
  }

  private esOpcionOtroCatalogoItem(item: CatalogItem | null | undefined): boolean {
    if (!item) {
      return false;
    }
    const clave = this.normalizarCatalogo(item.clave);
    const nombre = this.normalizarCatalogo(item.nombre);
    return clave === 'otro' || nombre === 'otro';
  }

  mostrarCampoManualInstitucion(controlName: InstitucionCatalogControl): boolean {
    return this.obtenerSeleccionInstitucion(controlName) === this.catalogoOtroValue;
  }

  private obtenerSeleccionInstitucion(controlName: InstitucionCatalogControl): string {
    if (controlName === 'inst_nombre') {
      return this.selectedInstitucionRegistroId;
    }
    if (controlName === 'acad_institucion') {
      return this.selectedInstitucionAcademicaId;
    }
    if (controlName === 'tray_prof_institucion') {
      return this.selectedInstitucionProfesionalId;
    }
    return this.selectedInstitucionCursoId;
  }

  private asignarSeleccionInstitucion(controlName: InstitucionCatalogControl, selectedValue: string): void {
    if (controlName === 'inst_nombre') {
      this.selectedInstitucionRegistroId = selectedValue;
      return;
    }
    if (controlName === 'acad_institucion') {
      this.selectedInstitucionAcademicaId = selectedValue;
      return;
    }
    if (controlName === 'tray_prof_institucion') {
      this.selectedInstitucionProfesionalId = selectedValue;
      return;
    }
    this.selectedInstitucionCursoId = selectedValue;
  }

  private obtenerLlaveInstitucionNormalizada(value: string | null | undefined): string {
    return this.normalizarCatalogo(value)
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/s+/g, ' ')
      .trim();
  }

  private contarDatosInstitucion(item: InstitucionEducativaItem): number {
    return [
      item.id,
      item.cct,
      item.nombre,
      item.domicilio,
      item.colonia,
      item.codigoPostal,
      item.municipio,
      item.entidadFederativa,
      item.telefono,
      item.director,
      item.correo,
      item.nivelEducativo,
      item.estado
    ].filter(value => value !== null && value !== undefined && value.toString().trim() !== '').length;
  }

  private deduplicarInstitucionesEducativas(items: InstitucionEducativaItem[]): InstitucionEducativaItem[] {
    const instituciones = new Map<string, InstitucionEducativaItem>();

    items.forEach((item) => {
      const nombreKey = this.obtenerLlaveInstitucionNormalizada(item.nombre);
      const cctKey = this.obtenerLlaveInstitucionNormalizada(item.cct || '');
      const key = nombreKey || (cctKey ? 'cct:' + cctKey : '');

      if (!key) {
        return;
      }

      const actual = instituciones.get(key);
      if (!actual || this.contarDatosInstitucion(item) > this.contarDatosInstitucion(actual)) {
        instituciones.set(key, item);
      }
    });

    return Array.from(instituciones.values());
  }

  private normalizarCatalogo(value: string | null | undefined): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private ordenarCatalogosPorNombre(items: CatalogItem[]): CatalogItem[] {
    return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }

  private ordenarInstitucionesPorNombre(items: InstitucionEducativaItem[]): InstitucionEducativaItem[] {
    return [...items].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }
}







