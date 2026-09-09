import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { AuthService } from '../../core/auth.service';
import { PdfLimiteService } from '../../core/pdf-limite.service';
import { from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

/** Perfil completo del usuario para el CV */
interface PerfilCV {
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  email?: string;
  telefono?: string;
  tipoPerfil?: string;
  gradoAcademico?: string;
  semblanza?: string;
  fotoDocumentoId?: number | null;
}

interface Curso {
  id?: number;
  nombre?: string;
  programa?: string;
  horasTotales?: number;
  fechaInicio?: string;
  fechaFin?: string;
  institucion?: string;
  nivelEscolaridad?: string;
}

interface Idioma {
  id?: number;
  nombre?: string;
  dominioNombre?: string;
  conversacion?: string;
  lectura?: string;
  escritura?: string;
  esCertificado?: boolean;
  certInstitucion?: string;
  certPuntuacion?: string;
  vigenciaFin?: string;
}

interface Logro {
  id?: number;
  tipo?: string;
  nombre?: string;
  anio?: number;
  fecha?: string; // Fecha completa en formato ISO (YYYY-MM-DD)
}

interface Certificacion {
  id: number;
  nombre: string;
  nombreCompleto?: string;
  tipo: string;
  contentType?: string;
  fechaSubida: string;
  sizeBytes: number;
}

interface Articulo {
  id?: number;
  titulo?: string;
  revista?: string;
  anio?: number;
  doi?: string;
  url?: string;
}

interface IncidenciaSocial {
  id?: number;
  titulo?: string;
  ubicacion?: string;
  descripcion?: string;
  fecha?: string;
  anio?: number;
}

interface TrayectoriaAcademica {
  id?: number;
  nivel?: string;
  titulo?: string;
  institucion?: string;
  estatus?: string;
  fechaObtencion?: string;
  cedulaProfesional?: string;
}

interface TrayectoriaProfesional {
  id?: number;
  nombramiento?: string;
  institucion?: string;
  fechaInicio?: string;
  fechaFin?: string;
  esActual?: boolean;
  logros?: string;
}

interface Estancia {
  id?: number;
  tipo?: string;
  nombreProyecto?: string;
  institucionReceptora?: string;
  fechaInicio?: string;
  fechaFin?: string;
  logros?: string;
}

interface Congreso {
  id?: number;
  nombre?: string;
  tituloTrabajo?: string;
  tipoParticipacion?: string;
  fecha?: string;
  paisSede?: string;
}

interface Divulgacion {
  id?: number;
  titulo?: string;
  tipoDivulgacion?: string;
  medioComunicacion?: string;
  dirigidoA?: string;
  fecha?: string;
  institucionOrganizadora?: string;
}

interface PropiedadIntelectual {
  id?: number;
  tipo?: string;
  titulo?: string;
  numeroRegistro?: string;
  institucionOficina?: string;
  pais?: string;
  descripcion?: string;
  fechaRegistro?: string;
  anio?: number;
  documentoId?: number;
}

type ClaveEvidenciaRubro =
  | 'curriculum'
  | 'ine'
  | 'domicilio'
  | 'cedula'
  | 'cert1'
  | 'cert2'
  | 'divulgacion';

interface DocumentoRubro {
  id: number;
  nombre?: string;
  tipo?: string;
  contentType?: string;
  sizeBytes?: number;
  fechaSubida?: string;
  rubroId?: string;
  esEvidenciaRubro?: boolean;
}

interface PersonaPrincipalRubro {
  nombreCompleto?: string;
  email?: string;
  curp?: string;
  rfc?: string;
  telefono?: string;
  tipoPerfil?: string;
  semblanza?: string;
}

interface InstitucionRubro {
  nombre?: string;
  claveOficial?: string;
  tipoNombre?: string;
  paisNombre?: string;
  entidadNombre?: string;
  nivelUnoNombre?: string;
  nivelDosNombre?: string;
}

interface AreaConocimientoRubro {
  areaNombre?: string;
  areaClave?: string;
  campoNombre?: string;
  campoClave?: string;
  disciplinaNombre?: string;
  disciplinaClave?: string;
  subdisciplinaNombre?: string;
  subdisciplinaClave?: string;
}

interface RubrosPerfilResponse {
  personaPrincipal?: PersonaPrincipalRubro;
  institucion?: InstitucionRubro;
  areaConocimiento?: AreaConocimientoRubro;
  evidencias?: Partial<Record<ClaveEvidenciaRubro, DocumentoRubro | null>>;
}

type EvidenciasRubrosResponse = Record<string, DocumentoRubro[]>;

const TABS_VALIDOS = ['institucion', 'areaConocimiento', 'certs', 'cursos', 'herramientas', 'idiomas', 'logros', 'articulos', 'pi', 'incidencia', 'trayAcademica', 'trayProfesional', 'estancias', 'congresos', 'divulgacion'] as const;

@Component({
  selector: 'app-trayectoria',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trayectoria.html',
  styleUrls: ['./trayectoria.css']
})
export class TrayectoriaComponent implements OnInit, AfterViewInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private pdfLimiteService = inject(PdfLimiteService);

  // Datos
  cursos: Curso[] = [];
  idiomas: Idioma[] = [];
  logros: Logro[] = [];
  certificaciones: Certificacion[] = [];
  /** Lista de herramientas con id para eliminar correctamente (evita bug con comillas en nombre). */
  herramientas: Array<{ id: number; nombre: string }> = [];
  articulos: Articulo[] = [];
  incidenciaSocial: IncidenciaSocial[] = [];
  propiedadIntelectual: PropiedadIntelectual[] = [];
  trayAcademica: TrayectoriaAcademica[] = [];
  trayProfesional: TrayectoriaProfesional[] = [];
  estancias: Estancia[] = [];
  congresos: Congreso[] = [];
  divulgaciones: Divulgacion[] = [];

  // Rubros base de "completar-registro" para perfil único
  personaPrincipal: PersonaPrincipalRubro | null = null;
  institucionRubro: InstitucionRubro | null = null;
  areaConocimientoRubro: AreaConocimientoRubro | null = null;
  evidenciasRubros: Partial<Record<ClaveEvidenciaRubro, DocumentoRubro | null>> = {};
  evidenciasRubrosPersonalizadas: Record<string, DocumentoRubro[]> = {};
  pdfLimitMbByKey: Record<string, number> = {};

  // Estados de carga
  loadingCursos = false;
  loadingIdiomas = false;
  loadingLogros = false;
  loadingCertificaciones = false;
  loadingArticulos = false;
  loadingIncidencia = false;
  loadingPI = false;
  loadingTrayAcademica = false;
  loadingTrayProfesional = false;
  loadingEstancias = false;
  loadingCongresos = false;
  loadingDivulgaciones = false;
  loadingRubrosPerfil = false;

  // Formularios
  cursoForm: Curso = {};
  idiomaForm: Idioma = {};
  logroForm: Logro = {};
  articuloForm: Articulo = {};
  incidenciaForm: IncidenciaSocial = {};
  piForm: PropiedadIntelectual = {};
  herramientaInput = '';
  trayAcademicaForm: TrayectoriaAcademica = {};
  trayProfesionalForm: TrayectoriaProfesional = {};
  estanciaForm: Estancia = {};
  congresoForm: Congreso = {};
  divulgacionForm: Divulgacion = {};

  // Modal agregar/editar
  modalTipo: string | null = null;
  modalVisible = false;
  certFileSelected: File | null = null;
  piFileSelected: File | null = null;
  evidenciaModalFile: File | null = null;

  // Generar CV
  generandoCV = false;

  private auth = inject(AuthService);
  private readonly rubroPorModal: Record<string, string> = {
    institucion: 'institucion',
    areaConocimiento: 'areaConocimiento',
    curso: 'cursos',
    herramienta: 'herramientas',
    idioma: 'idiomas',
    logro: 'logros',
    articulo: 'articulos',
    pi: 'pi',
    incidencia: 'incidencia',
    trayAcademica: 'trayAcademica',
    trayProfesional: 'trayProfesional',
    estancia: 'estancias',
    congreso: 'congresos',
    divulgacion: 'divulgacion'
  };
  private readonly evidenciasPorRubro: Record<string, { requerida: boolean; claves: ClaveEvidenciaRubro[] }> = {
    institucion: { requerida: false, claves: [] },
    areaConocimiento: { requerida: false, claves: [] },
    certs: { requerida: false, claves: ['cert1', 'cert2'] },
    herramientas: { requerida: false, claves: [] },
    trayAcademica: { requerida: true, claves: ['cert1'] },
    trayProfesional: { requerida: true, claves: ['cert2'] },
    cursos: { requerida: false, claves: [] },
    idiomas: { requerida: false, claves: ['cert1'] },
    estancias: { requerida: false, claves: [] },
    articulos: { requerida: false, claves: ['cert1'] },
    congresos: { requerida: false, claves: [] },
    divulgacion: { requerida: true, claves: ['divulgacion'] },
    logros: { requerida: false, claves: [] },
    pi: { requerida: false, claves: [] },
    incidencia: { requerida: false, claves: [] }
  };

  ngOnInit(): void {
    window.trayectoriaComponent = this;
    this.cargarLimitesPdf();
    this.cargarTodosLosDatos();
  }

  ngAfterViewInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab');
      if (tab && TABS_VALIDOS.includes(tab as typeof TABS_VALIDOS[number])) {
        this.activarPestana(tab);
      }
    });
    // Por si la página se carga con ?tab= ya en la URL
    const tabInicial = this.route.snapshot.queryParamMap.get('tab');
    if (tabInicial && TABS_VALIDOS.includes(tabInicial as typeof TABS_VALIDOS[number])) {
      setTimeout(() => this.activarPestana(tabInicial), 150);
    }
  }

  private escapeHtml(str: string): string {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Desplaza a la sección indicada (certs | cursos | herramientas | idiomas | logros | articulos | incidencia). */
  activarPestana(tabId: string): void {
    setTimeout(() => {
      const el = document.getElementById(tabId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 200);
  }

  abrirModal(tipo: string): void {
    this.modalTipo = tipo;
    this.modalVisible = true;
    this.certFileSelected = null;
    this.piFileSelected = null;
    this.evidenciaModalFile = null;
    // Reset forms when opening
    const certName = document.getElementById('certName') as HTMLInputElement;
    const certFile = document.getElementById('certFile') as HTMLInputElement;
    if (certName) certName.value = '';
    if (certFile) certFile.value = '';
    const toolInput = document.getElementById('toolInput') as HTMLInputElement;
    if (toolInput) toolInput.value = '';
    const evidenciaFile = document.getElementById('modalEvidenceFile') as HTMLInputElement;
    if (evidenciaFile) evidenciaFile.value = '';
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.modalTipo = null;
    this.certFileSelected = null;
    this.piFileSelected = null;
    this.evidenciaModalFile = null;
    this.cursoForm = {};
    this.idiomaForm = {};
    this.logroForm = {};
    this.articuloForm = {};
    this.incidenciaForm = {};
    this.piForm = {};
    this.trayAcademicaForm = {};
    this.trayProfesionalForm = {};
    this.estanciaForm = {};
    this.congresoForm = {};
    this.divulgacionForm = {};
  }

  abrirModalInstitucion(): void {
    this.abrirModal('institucion');
    const data = this.institucionRubro || {};
    setTimeout(() => {
      (document.getElementById('instNombreModal') as HTMLInputElement).value = data.nombre || '';
      (document.getElementById('instClaveModal') as HTMLInputElement).value = data.claveOficial || '';
      (document.getElementById('instTipoModal') as HTMLInputElement).value = data.tipoNombre || '';
      (document.getElementById('instPaisModal') as HTMLInputElement).value = data.paisNombre || '';
      (document.getElementById('instEntidadModal') as HTMLInputElement).value = data.entidadNombre || '';
      (document.getElementById('instNivel1Modal') as HTMLInputElement).value = data.nivelUnoNombre || '';
      (document.getElementById('instNivel2Modal') as HTMLInputElement).value = data.nivelDosNombre || '';
    }, 50);
  }

  guardarInstitucionRubro(): void {
    const nombre = (document.getElementById('instNombreModal') as HTMLInputElement)?.value?.trim();
    if (!nombre) {
      Swal.fire('Advertencia', 'El nombre de la institución es requerido', 'warning');
      return;
    }

    const payload = {
      nombre,
      claveOficial: (document.getElementById('instClaveModal') as HTMLInputElement)?.value?.trim() || undefined,
      tipoNombre: (document.getElementById('instTipoModal') as HTMLInputElement)?.value?.trim() || undefined,
      paisNombre: (document.getElementById('instPaisModal') as HTMLInputElement)?.value?.trim() || undefined,
      entidadNombre: (document.getElementById('instEntidadModal') as HTMLInputElement)?.value?.trim() || undefined,
      nivelUnoNombre: (document.getElementById('instNivel1Modal') as HTMLInputElement)?.value?.trim() || undefined,
      nivelDosNombre: (document.getElementById('instNivel2Modal') as HTMLInputElement)?.value?.trim() || undefined
    };

    this.http.post(`${environment.apiBaseUrl}/trayectoria/institucion`, payload).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('institucion').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Institución actualizada correctamente'
              : 'Institución actualizada. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          this.cerrarModal();
          this.cargarRubrosPerfil();
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar la institución', 'error');
      }
    });
  }

  eliminarInstitucionRubro(): void {
    Swal.fire({
      title: '¿Eliminar institución?',
      text: 'Se eliminará la información de este rubro',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.http.delete(`${environment.apiBaseUrl}/trayectoria/institucion`).subscribe({
        next: () => {
          Swal.fire('Eliminado', 'Institución eliminada', 'success');
          this.institucionRubro = null;
          this.cerrarModal();
          this.cargarRubrosPerfil();
        },
        error: (err) => {
          Swal.fire('Error', err.error?.message || 'No se pudo eliminar la institución', 'error');
        }
      });
    });
  }

  abrirModalAreaConocimiento(): void {
    this.abrirModal('areaConocimiento');
    const data = this.areaConocimientoRubro || {};
    setTimeout(() => {
      (document.getElementById('areaNombreModal') as HTMLInputElement).value = data.areaNombre || '';
      (document.getElementById('areaClaveModal') as HTMLInputElement).value = data.areaClave || '';
      (document.getElementById('campoNombreModal') as HTMLInputElement).value = data.campoNombre || '';
      (document.getElementById('campoClaveModal') as HTMLInputElement).value = data.campoClave || '';
      (document.getElementById('disciplinaNombreModal') as HTMLInputElement).value = data.disciplinaNombre || '';
      (document.getElementById('disciplinaClaveModal') as HTMLInputElement).value = data.disciplinaClave || '';
      (document.getElementById('subdisciplinaNombreModal') as HTMLInputElement).value = data.subdisciplinaNombre || '';
      (document.getElementById('subdisciplinaClaveModal') as HTMLInputElement).value = data.subdisciplinaClave || '';
    }, 50);
  }

  guardarAreaConocimientoRubro(): void {
    const payload = {
      areaNombre: (document.getElementById('areaNombreModal') as HTMLInputElement)?.value?.trim() || undefined,
      areaClave: (document.getElementById('areaClaveModal') as HTMLInputElement)?.value?.trim() || undefined,
      campoNombre: (document.getElementById('campoNombreModal') as HTMLInputElement)?.value?.trim() || undefined,
      campoClave: (document.getElementById('campoClaveModal') as HTMLInputElement)?.value?.trim() || undefined,
      disciplinaNombre: (document.getElementById('disciplinaNombreModal') as HTMLInputElement)?.value?.trim() || undefined,
      disciplinaClave: (document.getElementById('disciplinaClaveModal') as HTMLInputElement)?.value?.trim() || undefined,
      subdisciplinaNombre: (document.getElementById('subdisciplinaNombreModal') as HTMLInputElement)?.value?.trim() || undefined,
      subdisciplinaClave: (document.getElementById('subdisciplinaClaveModal') as HTMLInputElement)?.value?.trim() || undefined
    };

    this.http.post(`${environment.apiBaseUrl}/trayectoria/area-conocimiento`, payload).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('areaConocimiento').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Área de conocimiento actualizada correctamente'
              : 'Área de conocimiento actualizada. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          this.cerrarModal();
          this.cargarRubrosPerfil();
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar el área de conocimiento', 'error');
      }
    });
  }

  eliminarAreaConocimientoRubro(): void {
    Swal.fire({
      title: '¿Eliminar área de conocimiento?',
      text: 'Se eliminará la información de este rubro',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.http.delete(`${environment.apiBaseUrl}/trayectoria/area-conocimiento`).subscribe({
        next: () => {
          Swal.fire('Eliminada', 'Área de conocimiento eliminada', 'success');
          this.areaConocimientoRubro = null;
          this.cerrarModal();
          this.cargarRubrosPerfil();
        },
        error: (err) => {
          Swal.fire('Error', err.error?.message || 'No se pudo eliminar el área de conocimiento', 'error');
        }
      });
    });
  }

  getModalTitulo(): string {
    const map: Record<string, string> = {
      cert: 'Agregar certificación',
      institucion: 'Editar institución',
      areaConocimiento: 'Editar área de conocimiento',
      curso: 'Agregar curso',
      herramienta: 'Agregar herramienta',
      idioma: 'Agregar idioma',
      logro: 'Agregar logro',
      articulo: 'Agregar artículo',
      pi: 'Agregar propiedad intelectual',
      incidencia: 'Agregar incidencia social',
      trayAcademica: 'Agregar formación académica',
      trayProfesional: 'Agregar experiencia profesional',
      estancia: 'Agregar estancia de investigación',
      congreso: 'Agregar congreso / evento',
      divulgacion: 'Agregar actividad de divulgación'
    };
    return map[this.modalTipo || ''] || 'Agregar';
  }

  private cargarLimitesPdf(): void {
    this.pdfLimiteService.obtenerMapaLimites().subscribe((limites) => {
      this.pdfLimitMbByKey = limites;
    });
  }

  getPdfLimitMb(key: string): number {
    return Number(this.pdfLimitMbByKey[key]) || 2;
  }

  private validarTamanoPdf(file: File, limiteKey: string, input?: HTMLInputElement | null): boolean {
    const maxMb = this.getPdfLimitMb(limiteKey);
    if (file.size <= maxMb * 1024 * 1024) return true;
    if (input) input.value = '';
    Swal.fire('Archivo muy grande', `El archivo excede el tamaño máximo permitido de ${maxMb} MB.`, 'warning');
    return false;
  }
  onPiFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      this.piFileSelected = null;
      return;
    }
    if (!this.esArchivoPdf(file)) {
      this.piFileSelected = null;
      input.value = '';
      Swal.fire('Formato no permitido', 'Solo se aceptan archivos PDF.', 'warning');
      return;
    }
    if (!this.validarTamanoPdf(file, 'perfil.propiedadIntelectual', input)) {
      this.piFileSelected = null;
      return;
    }
    this.piFileSelected = file;
  }

  onCertFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) {
      this.certFileSelected = null;
      return;
    }
    if (!this.esArchivoPdf(file)) {
      this.certFileSelected = null;
      input.value = '';
      Swal.fire('Formato no permitido', 'Solo se aceptan archivos PDF.', 'warning');
      return;
    }
    if (!this.validarTamanoPdf(file, 'perfil.certificaciones', input)) {
      this.certFileSelected = null;
      return;
    }
    this.certFileSelected = file;
  }

  onEvidenciaModalFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    if (!file) {
      this.evidenciaModalFile = null;
      return;
    }

    if (!this.esArchivoPdf(file)) {
      this.evidenciaModalFile = null;
      input.value = '';
      Swal.fire('Formato no permitido', 'La evidencia por rubro solo acepta archivos PDF.', 'warning');
      return;
    }

    if (!this.validarTamanoPdf(file, 'perfil.rubros', input)) {
      this.evidenciaModalFile = null;
      return;
    }
    this.evidenciaModalFile = file;
  }

  getRubroModalActual(): string | null {
    if (!this.modalTipo) return null;
    return this.rubroPorModal[this.modalTipo] || null;
  }

  mostrarBloqueEvidenciaModal(): boolean {
    return !!this.getRubroModalActual();
  }

  getEvidenciasModalActuales(): DocumentoRubro[] {
    const rubro = this.getRubroModalActual();
    if (!rubro) return [];
    return this.getEvidenciasRubro(rubro);
  }

  puedeEliminarEvidenciaModal(doc: DocumentoRubro): boolean {
    return !!doc?.esEvidenciaRubro;
  }

  eliminarEvidenciaModal(doc: DocumentoRubro): void {
    const rubro = this.getRubroModalActual();
    if (!rubro || !doc?.id || !doc.esEvidenciaRubro) return;

    Swal.fire({
      title: '¿Eliminar evidencia?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((r) => {
      if (!r.isConfirmed) return;
      this.http.delete(`${environment.apiBaseUrl}/trayectoria/evidencias/${rubro}/${doc.id}`).subscribe({
        next: () => {
          Swal.fire('Eliminada', 'Evidencia eliminada correctamente', 'success');
          this.cargarEvidenciasRubrosPersonalizadas();
        },
        error: (err) => {
          Swal.fire('Error', err.error?.message || 'No se pudo eliminar la evidencia', 'error');
        }
      });
    });
  }

  private subirEvidenciaModalRubro(rubroId: string): Promise<boolean> {
    if (!this.evidenciaModalFile) {
      return Promise.resolve(true);
    }

    if (!this.esArchivoPdf(this.evidenciaModalFile)) {
      Swal.fire('Formato no permitido', 'La evidencia por rubro solo acepta archivos PDF.', 'warning');
      this.evidenciaModalFile = null;
      const evidenciaFile = document.getElementById('modalEvidenceFile') as HTMLInputElement;
      if (evidenciaFile) evidenciaFile.value = '';
      return Promise.resolve(false);
    }

    const evidenciaFile = document.getElementById('modalEvidenceFile') as HTMLInputElement;
    if (!this.validarTamanoPdf(this.evidenciaModalFile, 'perfil.rubros', evidenciaFile)) {
      this.evidenciaModalFile = null;
      return Promise.resolve(false);
    }

    const formData = new FormData();
    formData.append('file', this.evidenciaModalFile);
    formData.append('nombre', this.evidenciaModalFile.name);

    return this.http.post(`${environment.apiBaseUrl}/trayectoria/evidencias/${rubroId}`, formData)
      .toPromise()
      .then(() => {
        this.evidenciaModalFile = null;
        const evidenciaFile = document.getElementById('modalEvidenceFile') as HTMLInputElement;
        if (evidenciaFile) evidenciaFile.value = '';
        this.cargarEvidenciasRubrosPersonalizadas();
        return true;
      })
      .catch((err) => {
        console.error(`Error al subir evidencia para rubro ${rubroId}:`, err);
        this.evidenciaModalFile = null;
        const evidenciaFile = document.getElementById('modalEvidenceFile') as HTMLInputElement;
        if (evidenciaFile) evidenciaFile.value = '';
        return false;
      });
  }

  private esArchivoPdf(file: File): boolean {
    const mime = (file.type || '').toLowerCase();
    const nombre = (file.name || '').toLowerCase();
    return mime.includes('pdf') || nombre.endsWith('.pdf');
  }

  subirCertificacionModal(event: Event): void {
    event.preventDefault();
    const nombre = (document.getElementById('certName') as HTMLInputElement)?.value?.trim();
    if (!nombre) {
      Swal.fire('Advertencia', 'Ingresa el nombre de la certificación', 'warning');
      return;
    }
    if (!this.certFileSelected) {
      Swal.fire('Advertencia', 'Selecciona un archivo', 'warning');
      return;
    }
    if (!this.esArchivoPdf(this.certFileSelected)) {
      Swal.fire('Formato no permitido', 'Solo se aceptan archivos PDF.', 'warning');
      this.certFileSelected = null;
      const certFile = document.getElementById('certFile') as HTMLInputElement;
      if (certFile) certFile.value = '';
      return;
    }
    const certFile = document.getElementById('certFile') as HTMLInputElement;
    if (!this.validarTamanoPdf(this.certFileSelected, 'perfil.certificaciones', certFile)) {
      this.certFileSelected = null;
      return;
    }

    const formData = new FormData();
    formData.append('file', this.certFileSelected);
    formData.append('nombre', nombre);

    Swal.fire({ title: 'Subiendo...', allowOutsideClick: false });
    Swal.showLoading();

    this.http.post<Certificacion>(`${environment.apiBaseUrl}/trayectoria/certificaciones`, formData).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Certificación subida correctamente', 'success');
        this.certFileSelected = null;
        (document.getElementById('certName') as HTMLInputElement).value = '';
        (document.getElementById('certFile') as HTMLInputElement).value = '';
        this.cerrarModal();
        this.cargarCertificaciones();
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo subir la certificación', 'error');
      }
    });
  }

  agregarHerramientaDesdeModal(): void {
    const input = document.getElementById('toolInput') as HTMLInputElement;
    const herramienta = input?.value?.trim();
    if (!herramienta) {
      Swal.fire('Advertencia', 'Ingresa el nombre de la herramienta', 'warning');
      return;
    }
    if (this.herramientas.length >= 12) {
      Swal.fire('Advertencia', 'Máximo 12 herramientas permitidas', 'warning');
      return;
    }
    if (this.herramientas.some(h => h.nombre === herramienta)) {
      Swal.fire('Advertencia', 'Esta herramienta ya está registrada', 'warning');
      return;
    }
    this.http.post<{ id: number; nombre: string }>(`${environment.apiBaseUrl}/trayectoria/herramientas/agregar`, { nombre: herramienta }).subscribe({
      next: (saved) => {
        this.subirEvidenciaModalRubro('herramientas').then((evidenciaOk) => {
          this.herramientas = [...this.herramientas, { id: saved.id, nombre: saved.nombre }];
          this.renderizarHerramientas();
          if (input) input.value = '';
          this.cerrarModal();
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Herramienta agregada correctamente'
              : 'Herramienta agregada. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo agregar la herramienta', 'error');
      }
    });
  }

  generarCV(): void {
    this.generandoCV = true;
    const api = `${environment.apiBaseUrl}`;

    this.http.get<PerfilCV>(`${api}/usuarios/me`).pipe(
      switchMap(perfil => {
        const nombreCompleto = [perfil.nombre, perfil.apellidoPaterno, perfil.apellidoMaterno].filter(Boolean).join(' ') || 'Currículum vitae';
        const puesto = this.obtenerPuestoCV(perfil);
        const fotoBase64$ = perfil.fotoDocumentoId
          ? this.http.get(`${api}/documentos/${perfil.fotoDocumentoId}`, { responseType: 'blob' }).pipe(
              switchMap(blob => from(this.blobToBase64(blob)))
            )
          : of<string | null>(null);
        return fotoBase64$.pipe(
          map(fotoBase64 => ({ perfil, nombreCompleto, puesto, fotoBase64 }))
        );
      })
    ).subscribe({
      next: ({ perfil, nombreCompleto, puesto, fotoBase64 }) => {
        this.generarPDFConFormato(nombreCompleto, puesto, perfil, fotoBase64);
        this.generandoCV = false;
      },
      error: (err) => {
        this.generandoCV = false;
        Swal.fire('Error', err.error?.message || 'No se pudo generar el CV', 'error');
      }
    });
  }

  private obtenerPuestoCV(perfil: PerfilCV): string {
    const partes: string[] = [];
    if (perfil.tipoPerfil) {
      const tipo = (perfil.tipoPerfil || '').toUpperCase();
      if (tipo === 'INNOVADOR') {
        partes.push('Personas innovadoras');
      } else if (tipo === 'HIBRIDO') {
        partes.push('Personas investigadoras e innovadoras');
      } else {
        partes.push('Personas investigadoras');
      }
    }
    if (perfil.gradoAcademico) partes.push(perfil.gradoAcademico);
    return partes.join(' · ') || 'Mi perfil único SIIMEX';
  }

  private blobToBase64(blob: Blob): Promise<string | null> {
    return new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  }

  private getImageDimensions(dataUrl: string): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(null);
          return;
        }
        resolve({ width, height });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }

  private async generarPDFConFormato(
    nombreCompleto: string,
    puesto: string,
    perfil: PerfilCV,
    fotoBase64: string | null
  ): Promise<void> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const marginBottom = 14;
    const contentW = pageW - marginX * 2;
    const footerY = pageH - 8;

    const borgona = [139, 21, 56] as [number, number, number];
    const borgonaOscuro = [99, 15, 40] as [number, number, number];
    const tinta = [45, 45, 45] as [number, number, number];

    let y = 58;
    let paginaActual = 1;

    const fotoDim = fotoBase64 ? await this.getImageDimensions(fotoBase64) : null;

    const normalizar = (valor?: string | null): string => (valor || '').replace(/\s+/g, ' ').trim();
    const wrap = (texto: string, maxW: number): string[] => doc.splitTextToSize(texto || '', maxW);
    const dibujarLineaJustificada = (linea: string, x: number, yLinea: number, anchoObjetivo: number): void => {
      const texto = normalizar(linea);
      if (!texto) return;
      const palabras = texto.split(' ').filter(Boolean);
      if (palabras.length < 2) {
        doc.text(texto, x, yLinea);
        return;
      }

      const textoBase = palabras.join(' ');
      const anchoTextoBase = doc.getTextWidth(textoBase);
      const huecos = palabras.length - 1;
      const anchoEspacio = doc.getTextWidth(' ');
      const extraPorHueco = (anchoObjetivo - anchoTextoBase) / huecos;
      if (!isFinite(extraPorHueco) || extraPorHueco <= 0.05) {
        doc.text(textoBase, x, yLinea);
        return;
      }

      let cursorX = x;
      palabras.forEach((palabra, idx) => {
        doc.text(palabra, cursorX, yLinea);
        cursorX += doc.getTextWidth(palabra);
        if (idx < huecos) {
          cursorX += anchoEspacio + extraPorHueco;
        }
      });
    };
    const truncarLinea = (texto: string, maxW: number): string => {
      if (!texto) return '';
      let salida = texto;
      while (doc.getTextWidth(salida) > maxW && salida.length > 3) {
        salida = salida.slice(0, -1);
      }
      return salida !== texto ? `${salida.trim()}...` : salida;
    };
    const formatoFecha = (fecha?: string): string => {
      if (!fecha) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const [anio, mes, dia] = fecha.split('-');
        return `${dia}/${mes}/${anio}`;
      }
      return fecha;
    };
    const periodo = (inicio?: string, fin?: string, esActual?: boolean): string => {
      const ini = formatoFecha(inicio);
      const finTxt = esActual ? 'Actual' : formatoFecha(fin);
      if (ini && finTxt) return `${ini} - ${finTxt}`;
      if (ini) return ini;
      if (finTxt) return finTxt;
      return '';
    };

    const dibujarFooter = (): void => {
      doc.setDrawColor(232, 232, 236);
      doc.line(marginX, pageH - 11, pageW - marginX, pageH - 11);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(130, 130, 130);
      doc.text('Generado desde Mi perfil único SIIMEX - COMECyT', marginX, footerY);
      doc.text(`Página ${paginaActual}`, pageW - marginX, footerY, { align: 'right' });
    };

    const dibujarFranjaPrincipal = (): void => {
      const headerH = 46;
      const fotoCajaX = marginX;
      const fotoCajaY = 8;
      const fotoCajaSize = 30;
      const fotoPadding = 1.2;
      const fotoInner = fotoCajaSize - fotoPadding * 2;
      const textoX = fotoCajaX + fotoCajaSize + 7;
      const textoW = pageW - textoX - marginX;

      doc.setFillColor(...borgona);
      doc.rect(0, 0, pageW, headerH, 'F');
      doc.setFillColor(...borgonaOscuro);
      doc.rect(0, headerH - 4, pageW, 4, 'F');

      doc.setFillColor(255, 255, 255);
      doc.roundedRect(fotoCajaX, fotoCajaY, fotoCajaSize, fotoCajaSize, 3, 3, 'F');

      if (fotoBase64) {
        let drawW = fotoInner;
        let drawH = fotoInner;
        let drawX = fotoCajaX + fotoPadding;
        let drawY = fotoCajaY + fotoPadding;

        if (fotoDim) {
          const ratio = fotoDim.width / fotoDim.height;
          if (ratio >= 1) {
            drawW = fotoInner;
            drawH = fotoInner / ratio;
            drawY = fotoCajaY + fotoPadding + (fotoInner - drawH) / 2;
          } else {
            drawH = fotoInner;
            drawW = fotoInner * ratio;
            drawX = fotoCajaX + fotoPadding + (fotoInner - drawW) / 2;
          }
        }

        try {
          doc.addImage(fotoBase64, 'JPEG', drawX, drawY, drawW, drawH);
        } catch {
          try {
            doc.addImage(fotoBase64, 'PNG', drawX, drawY, drawW, drawH);
          } catch {
            doc.setFillColor(230, 230, 230);
            doc.roundedRect(fotoCajaX + fotoPadding, fotoCajaY + fotoPadding, fotoInner, fotoInner, 2, 2, 'F');
          }
        }
      } else {
        doc.setFillColor(236, 236, 236);
        doc.roundedRect(fotoCajaX + fotoPadding, fotoCajaY + fotoPadding, fotoInner, fotoInner, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(145, 145, 145);
        doc.text('SIN FOTO', fotoCajaX + fotoCajaSize / 2, fotoCajaY + fotoCajaSize / 2 + 1, { align: 'center' });
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      const nombreLineas = wrap(nombreCompleto, textoW).slice(0, 2);
      nombreLineas.forEach((linea, idx) => doc.text(linea, textoX, 16 + idx * 6));

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const etiqueta = truncarLinea(puesto || 'Mi perfil único SIIMEX', textoW);
      doc.text(etiqueta, textoX, 29);

      doc.setFontSize(8.4);
      const contacto = [perfil.email ? `Correo: ${perfil.email}` : '', perfil.telefono ? `Tel: ${perfil.telefono}` : '']
        .filter(Boolean)
        .join('  |  ') || 'Contacto no disponible';
      wrap(contacto, textoW).slice(0, 2).forEach((linea, idx) => doc.text(linea, textoX, 35 + idx * 4));

      y = headerH + 8;
    };

    const dibujarEncabezadoContinuacion = (): void => {
      const miniH = 16;
      doc.setFillColor(...borgona);
      doc.rect(0, 0, pageW, miniH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text(truncarLinea(nombreCompleto, pageW - marginX * 2 - 24), marginX, 10.5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('CV SIIMEX', pageW - marginX, 10.5, { align: 'right' });
      y = 24;
    };

    const saltoPaginaSiNecesario = (altoMinimo = 8): void => {
      if (y + altoMinimo <= pageH - marginBottom) return;
      dibujarFooter();
      doc.addPage();
      paginaActual += 1;
      dibujarEncabezadoContinuacion();
    };

    const pintarTituloSeccion = (titulo: string): void => {
      saltoPaginaSiNecesario(12);
      doc.setFillColor(248, 238, 242);
      doc.roundedRect(marginX, y - 3.8, contentW, 8, 1.6, 1.6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...borgona);
      doc.text(titulo, marginX + 3, y + 1.3);
      y += 8;
    };

    const pintarParrafo = (texto: string): void => {
      const limpio = normalizar(texto);
      if (!limpio) return;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...tinta);
      const lineas = wrap(limpio, contentW - 2);
      lineas.forEach((linea, idx) => {
        saltoPaginaSiNecesario(5.2);
        const esUltima = idx === lineas.length - 1;
        if (esUltima) {
          doc.text(linea, marginX + 1, y);
        } else {
          dibujarLineaJustificada(linea, marginX + 1, y, contentW - 2);
        }
        y += 4.8;
      });
      y += 2;
    };

    const pintarItemConVineta = (texto: string): void => {
      const limpio = normalizar(texto);
      if (!limpio) return;
      const lineas = wrap(limpio, contentW - 12);
      lineas.forEach((linea, idx) => {
        saltoPaginaSiNecesario(5.2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.3);
        doc.setTextColor(...tinta);
        if (idx === 0) {
          doc.text('•', marginX + 2, y);
        }
        const esUltima = idx === lineas.length - 1;
        if (esUltima) {
          doc.text(linea, marginX + 6, y);
        } else {
          dibujarLineaJustificada(linea, marginX + 6, y, contentW - 12);
        }
        y += 4.8;
      });
      y += 0.5;
    };

    const pintarSeccion = (titulo: string, items: string[]): void => {
      const limpios = items.map((it) => normalizar(it)).filter(Boolean);
      if (limpios.length === 0) return;
      pintarTituloSeccion(titulo);
      limpios.forEach((it) => pintarItemConVineta(it));
      y += 1.8;
    };

    dibujarFranjaPrincipal();

    if (normalizar(perfil.semblanza)) {
      pintarTituloSeccion('Semblanza');
      pintarParrafo(perfil.semblanza || '');
    }

    const institucionLinea = this.institucionRubro
      ? [
          this.institucionRubro.nombre,
          this.institucionRubro.tipoNombre,
          this.institucionRubro.entidadNombre,
          this.institucionRubro.paisNombre
        ].filter(Boolean).join(' · ')
      : '';
    pintarSeccion('Institución', institucionLinea ? [institucionLinea] : []);

    const areaLinea = this.areaConocimientoRubro
      ? [
          this.areaConocimientoRubro.areaNombre,
          this.areaConocimientoRubro.campoNombre,
          this.areaConocimientoRubro.disciplinaNombre,
          this.areaConocimientoRubro.subdisciplinaNombre
        ].filter(Boolean).join(' · ')
      : '';
    pintarSeccion('Área de conocimiento', areaLinea ? [areaLinea] : []);

    pintarSeccion('Formación académica', this.trayAcademica.map((t) =>
      (t.nivel ? `[${t.nivel}] ` : '') +
      (t.titulo || '') +
      (t.institucion ? ` - ${t.institucion}` : '') +
      (t.fechaObtencion ? ` (${formatoFecha(t.fechaObtencion)})` : '')
    ));

    pintarSeccion('Experiencia profesional', this.trayProfesional.map((t) =>
      (t.nombramiento || '') +
      (t.institucion ? ` - ${t.institucion}` : '') +
      (periodo(t.fechaInicio, t.fechaFin, t.esActual) ? ` (${periodo(t.fechaInicio, t.fechaFin, t.esActual)})` : '')
    ));

    pintarSeccion('Certificaciones', this.certificaciones.map((c) => c.nombre || ''));

    pintarSeccion('Cursos y Diplomados', this.cursos.map((c) =>
      (c.nombre || '') +
      (c.programa ? ` - ${c.programa}` : '') +
      (c.horasTotales ? ` (${c.horasTotales} hrs)` : '') +
      (c.institucion ? ` - ${c.institucion}` : '')
    ));

    pintarSeccion('Herramientas y Tecnologías', this.herramientas.map((h) => h.nombre));

    pintarSeccion('Idiomas', this.idiomas.map((i) =>
      (i.nombre || '') + (i.dominioNombre ? ` - ${i.dominioNombre}` : '')
    ));

    pintarSeccion('Logros', this.logros.map((l) =>
      (l.nombre || '') +
      (l.anio ? ` (${l.anio})` : '') +
      (l.fecha ? ` - ${formatoFecha(l.fecha)}` : '')
    ));

    pintarSeccion('Artículos y Publicaciones', this.articulos.map((a) =>
      (a.titulo || '') +
      (a.revista ? ` - ${a.revista}` : '') +
      (a.anio ? ` (${a.anio})` : '')
    ));

    pintarSeccion('Estancias de investigación', this.estancias.map((e) =>
      (e.tipo ? `[${e.tipo}] ` : '') +
      (e.nombreProyecto || '') +
      (e.institucionReceptora ? ` - ${e.institucionReceptora}` : '') +
      (periodo(e.fechaInicio, e.fechaFin) ? ` (${periodo(e.fechaInicio, e.fechaFin)})` : '')
    ));

    pintarSeccion('Congresos y eventos', this.congresos.map((c) =>
      (c.nombre || '') +
      (c.tipoParticipacion ? ` (${c.tipoParticipacion})` : '') +
      (c.fecha ? ` - ${formatoFecha(c.fecha)}` : '')
    ));

    pintarSeccion('Divulgación científica', this.divulgaciones.map((d) =>
      (d.titulo || '') +
      (d.tipoDivulgacion ? ` [${d.tipoDivulgacion}]` : '') +
      (d.fecha ? ` - ${formatoFecha(d.fecha)}` : '')
    ));

    pintarSeccion('Propiedad intelectual', this.propiedadIntelectual.map((p) =>
      (p.tipo ? `[${p.tipo}] ` : '') +
      (p.titulo || '') +
      (p.numeroRegistro ? ` - ${p.numeroRegistro}` : '') +
      (p.anio ? ` (${p.anio})` : '')
    ));

    pintarSeccion('Incidencia social', this.incidenciaSocial.map((i) =>
      (i.titulo || '') +
      (i.ubicacion ? ` - ${i.ubicacion}` : '') +
      (i.fecha ? ` (${formatoFecha(i.fecha)})` : '')
    ));

    dibujarFooter();

    doc.save('cv-siimex.pdf');
  }

  cargarTodosLosDatos(): void {
    this.cargarRubrosPerfil();
    this.cargarEvidenciasRubrosPersonalizadas();
    this.cargarCursos();
    this.cargarIdiomas();
    this.cargarLogros();
    this.cargarCertificaciones();
    this.cargarHerramientas();
    this.cargarArticulos();
    this.cargarPropiedadIntelectual();
    this.cargarIncidenciaSocial();
    this.cargarTrayAcademica();
    this.cargarTrayProfesional();
    this.cargarEstancias();
    this.cargarCongresos();
    this.cargarDivulgaciones();
  }

  cargarEvidenciasRubrosPersonalizadas(): void {
    this.http.get<EvidenciasRubrosResponse>(`${environment.apiBaseUrl}/trayectoria/evidencias`).subscribe({
      next: (data) => {
        this.evidenciasRubrosPersonalizadas = data || {};
      },
      error: () => {
        this.evidenciasRubrosPersonalizadas = {};
      }
    });
  }

  cargarRubrosPerfil(): void {
    this.loadingRubrosPerfil = true;
    this.http.get<RubrosPerfilResponse>(`${environment.apiBaseUrl}/trayectoria/rubros-perfil`).subscribe({
      next: (data) => {
        this.personaPrincipal = this.tieneValores(data?.personaPrincipal) ? data?.personaPrincipal || null : null;
        this.institucionRubro = this.tieneValores(data?.institucion) ? data?.institucion || null : null;
        this.areaConocimientoRubro = this.tieneValores(data?.areaConocimiento) ? data?.areaConocimiento || null : null;
        this.evidenciasRubros = data?.evidencias || {};
        this.loadingRubrosPerfil = false;
      },
      error: () => {
        this.loadingRubrosPerfil = false;
        this.personaPrincipal = null;
        this.institucionRubro = null;
        this.areaConocimientoRubro = null;
        this.evidenciasRubros = {};
      }
    });
  }

  getEvidenciasRubro(rubroId: string): DocumentoRubro[] {
    const config = this.evidenciasPorRubro[rubroId];
    const docsPorTipo = config
      ? config.claves
      .map(clave => this.evidenciasRubros[clave] || null)
      .filter((doc): doc is DocumentoRubro => !!doc && typeof doc.id === 'number')
      : [];

    const docsPersonalizados = (this.evidenciasRubrosPersonalizadas[rubroId] || [])
      .filter(doc => !!doc && typeof doc.id === 'number')
      .map(doc => ({ ...doc, esEvidenciaRubro: true, rubroId }));

    const docs = [...docsPorTipo, ...docsPersonalizados];

    // Evitar duplicados cuando una evidencia aplica a más de un rubro.
    const ids = new Set<number>();
    return docs.filter(doc => {
      if (ids.has(doc.id)) return false;
      ids.add(doc.id);
      return true;
    });
  }

  getMensajeEvidenciaRubro(rubroId: string): string {
    const config = this.evidenciasPorRubro[rubroId];
    if (!config) return 'No hay configuración de evidencia para este rubro.';
    if (!config.requerida) return 'No se solicita evidencia en este rubro.';
    return 'Sin evidencia cargada para este rubro.';
  }

  abrirEvidenciaRubro(doc: DocumentoRubro | null | undefined): void {
    if (!doc?.id) return;
    this.verCertificacion(doc.id, doc.nombre || `documento-${doc.id}`, doc.contentType);
  }

  trackEvidenciaRubro(index: number, doc: DocumentoRubro): number {
    return doc?.id ?? index;
  }

  private tieneValores(obj: object | null | undefined): boolean {
    if (!obj) return false;
    return Object.values(obj).some(v => v !== null && v !== undefined && `${v}`.trim() !== '');
  }

  // ========== CURSOS ==========
  cargarCursos(): void {
    this.loadingCursos = true;
    this.http.get<Curso[]>(`${environment.apiBaseUrl}/trayectoria/cursos`).subscribe({
      next: (data) => {
        this.cursos = data;
        this.loadingCursos = false;
        this.renderizarCursos();
      },
      error: (err) => {
        console.error('Error al cargar cursos:', err);
        this.loadingCursos = false;
        Swal.fire('Error', 'No se pudieron cargar los cursos', 'error');
      }
    });
  }

  guardarCurso(): void {
    const form = document.getElementById('courseForm') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const cursoData: Curso = {
      nombre: (document.getElementById('courseTitle') as HTMLInputElement).value,
      programa: (document.getElementById('courseProvider') as HTMLInputElement).value || undefined,
      horasTotales: parseInt((document.getElementById('courseHours') as HTMLInputElement).value) || undefined,
      institucion: (document.getElementById('courseInstitucion') as HTMLInputElement)?.value || undefined,
    };

    if (this.cursoForm.id) {
      cursoData.id = this.cursoForm.id;
    }

    this.http.post<Curso>(`${environment.apiBaseUrl}/trayectoria/cursos`, cursoData).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('cursos').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Curso guardado correctamente'
              : 'Curso guardado. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          form.reset();
          form.classList.remove('was-validated');
          this.cursoForm = {};
          this.cerrarModal();
          this.cargarCursos();
        });
      },
      error: (err) => {
        console.error('Error al guardar curso:', err);
        Swal.fire('Error', 'No se pudo guardar el curso', 'error');
      }
    });
  }

  eliminarCurso(id: number): void {
    Swal.fire({
      title: '¿Eliminar curso?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/cursos/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Curso eliminado correctamente', 'success');
            this.cargarCursos();
          },
          error: (err) => {
            console.error('Error al eliminar curso:', err);
            Swal.fire('Error', 'No se pudo eliminar el curso', 'error');
          }
        });
      }
    });
  }

  renderizarCursos(): void {
    const list = document.getElementById('coursesList');
    const empty = document.getElementById('coursesEmpty');
    const countBadge = document.getElementById('courseCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.cursos.length.toString();

    list.innerHTML = '';
    if (this.cursos.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.cursos.forEach(curso => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const escapeHtml = (str: string) => str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">
            <i class="fas fa-book text-borgona me-2"></i>${escapeHtml(curso.nombre || 'Sin título')}
          </div>
          ${curso.programa ? `<div class="text-muted small mb-1"><i class="fas fa-building me-1"></i>${escapeHtml(curso.programa)}</div>` : ''}
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${curso.horasTotales ? `<span class="badge bg-secondary"><i class="fas fa-clock me-1"></i>${curso.horasTotales} hrs</span>` : ''}
            ${curso.institucion ? `<span class="text-muted small"><i class="fas fa-university me-1"></i>${escapeHtml(curso.institucion)}</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-3" role="group">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarCurso(${curso.id})" title="Editar">
            <i class="fas fa-edit"></i> <span class="d-none d-md-inline">Editar</span>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarCurso(${curso.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i> <span class="d-none d-md-inline">Eliminar</span>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarCurso(id: number): void {
    const curso = this.cursos.find(c => c.id === id);
    if (!curso) return;
    this.cursoForm = { ...curso };
    this.abrirModal('curso');
    setTimeout(() => {
      (document.getElementById('courseTitle') as HTMLInputElement).value = curso.nombre || '';
      (document.getElementById('courseProvider') as HTMLInputElement).value = curso.programa || '';
      (document.getElementById('courseHours') as HTMLInputElement).value = curso.horasTotales?.toString() || '';
      const institucionInput = document.getElementById('courseInstitucion') as HTMLInputElement;
      if (institucionInput) institucionInput.value = curso.institucion || '';
      const submitBtn = document.querySelector('#courseForm button[type="submit"]') as HTMLButtonElement;
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Actualizar';
    }, 50);
  }

  // ========== IDIOMAS ==========
  cargarIdiomas(): void {
    this.loadingIdiomas = true;
    this.http.get<Idioma[]>(`${environment.apiBaseUrl}/trayectoria/idiomas`).subscribe({
      next: (data) => {
        this.idiomas = data;
        this.loadingIdiomas = false;
        this.renderizarIdiomas();
      },
      error: (err) => {
        console.error('Error al cargar idiomas:', err);
        this.loadingIdiomas = false;
        Swal.fire('Error', 'No se pudieron cargar los idiomas', 'error');
      }
    });
  }

  guardarIdioma(): void {
    const form = document.getElementById('langForm') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const idiomaData: Idioma = {
      nombre: (document.getElementById('langName') as HTMLInputElement).value,
      dominioNombre: (document.getElementById('langLevel') as HTMLSelectElement).value || undefined,
    };

    if (this.idiomaForm.id) {
      idiomaData.id = this.idiomaForm.id;
    }

    this.http.post<Idioma>(`${environment.apiBaseUrl}/trayectoria/idiomas`, idiomaData).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('idiomas').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Idioma guardado correctamente'
              : 'Idioma guardado. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          form.reset();
          form.classList.remove('was-validated');
          this.idiomaForm = {};
          this.cerrarModal();
          this.cargarIdiomas();
        });
      },
      error: (err) => {
        console.error('Error al guardar idioma:', err);
        Swal.fire('Error', 'No se pudo guardar el idioma', 'error');
      }
    });
  }

  eliminarIdioma(id: number): void {
    Swal.fire({
      title: '¿Eliminar idioma?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/idiomas/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Idioma eliminado correctamente', 'success');
            this.cargarIdiomas();
          },
          error: (err) => {
            console.error('Error al eliminar idioma:', err);
            Swal.fire('Error', 'No se pudo eliminar el idioma', 'error');
          }
        });
      }
    });
  }

  renderizarIdiomas(): void {
    const list = document.getElementById('langsList');
    const empty = document.getElementById('langsEmpty');
    const countBadge = document.getElementById('langCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.idiomas.length.toString();

    list.innerHTML = '';
    if (this.idiomas.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.idiomas.forEach(idioma => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const escapeHtml = (str: string) => str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      const nivelBadge = idioma.dominioNombre ? {
        'basico': 'bg-secondary',
        'intermedio': 'bg-info',
        'avanzado': 'bg-primary',
        'nativo': 'bg-success'
      }[idioma.dominioNombre.toLowerCase()] || 'bg-secondary' : 'bg-secondary';
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">
            <i class="fas fa-language text-borgona me-2"></i>${escapeHtml(idioma.nombre || 'Sin nombre')}
          </div>
          ${idioma.dominioNombre ? `<span class="badge ${nivelBadge}"><i class="fas fa-signal me-1"></i>${escapeHtml(idioma.dominioNombre)}</span>` : ''}
        </div>
        <div class="btn-group ms-3" role="group">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarIdioma(${idioma.id})" title="Editar">
            <i class="fas fa-edit"></i> <span class="d-none d-md-inline">Editar</span>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarIdioma(${idioma.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i> <span class="d-none d-md-inline">Eliminar</span>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarIdioma(id: number): void {
    const idioma = this.idiomas.find(i => i.id === id);
    if (!idioma) return;
    this.idiomaForm = { ...idioma };
    this.abrirModal('idioma');
    setTimeout(() => {
      (document.getElementById('langName') as HTMLInputElement).value = idioma.nombre || '';
      (document.getElementById('langLevel') as HTMLSelectElement).value = idioma.dominioNombre || 'basico';
      const submitBtn = document.querySelector('#langForm button[type="submit"]') as HTMLButtonElement;
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Actualizar';
    }, 50);
  }

  // ========== LOGROS ==========
  cargarLogros(): void {
    this.loadingLogros = true;
    this.http.get<Logro[]>(`${environment.apiBaseUrl}/trayectoria/logros`).subscribe({
      next: (data) => {
        this.logros = data;
        this.loadingLogros = false;
        this.renderizarLogros();
      },
      error: (err) => {
        console.error('Error al cargar logros:', err);
        this.loadingLogros = false;
        Swal.fire('Error', 'No se pudieron cargar los logros', 'error');
      }
    });
  }

  guardarLogro(): void {
    const form = document.getElementById('achievementForm') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const fechaInput = (document.getElementById('achDate') as HTMLInputElement).value;
    let anio: number | undefined;
    if (fechaInput) {
      // Extraer el año de la fecha
      anio = new Date(fechaInput).getFullYear();
    }

    const logroData: Logro = {
      nombre: (document.getElementById('achTitle') as HTMLInputElement).value,
      tipo: (document.getElementById('achDesc') as HTMLTextAreaElement).value || undefined,
      fecha: fechaInput || undefined,
      anio: anio,
    };

    if (this.logroForm.id) {
      logroData.id = this.logroForm.id;
    }

    this.http.post<Logro>(`${environment.apiBaseUrl}/trayectoria/logros`, logroData).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('logros').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Logro guardado correctamente'
              : 'Logro guardado. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          form.reset();
          form.classList.remove('was-validated');
          this.logroForm = {};
          this.cerrarModal();
          this.cargarLogros();
        });
      },
      error: (err) => {
        console.error('Error al guardar logro:', err);
        Swal.fire('Error', 'No se pudo guardar el logro', 'error');
      }
    });
  }

  eliminarLogro(id: number): void {
    Swal.fire({
      title: '¿Eliminar logro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/logros/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Logro eliminado correctamente', 'success');
            this.cargarLogros();
          },
          error: (err) => {
            console.error('Error al eliminar logro:', err);
            Swal.fire('Error', 'No se pudo eliminar el logro', 'error');
          }
        });
      }
    });
  }

  renderizarLogros(): void {
    const list = document.getElementById('achievementsList');
    const empty = document.getElementById('achEmpty');
    const countBadge = document.getElementById('logroCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.logros.length.toString();

    list.innerHTML = '';
    if (this.logros.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.logros.forEach(logro => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const escapeHtml = (str: string) => str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      
      // Formatear fecha si existe
      let fechaFormateada = '';
      if (logro.fecha) {
        try {
          const fecha = new Date(logro.fecha);
          fechaFormateada = fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (e) {
          // Si hay error, usar la fecha tal cual
          fechaFormateada = logro.fecha;
        }
      } else if (logro.anio) {
        fechaFormateada = logro.anio.toString();
      }
      
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">
            <i class="fas fa-trophy text-warning me-2"></i>${escapeHtml(logro.nombre || 'Sin título')}
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${logro.tipo ? `<span class="text-muted small">${escapeHtml(logro.tipo)}</span>` : ''}
            ${fechaFormateada ? `<span class="badge bg-info"><i class="fas fa-calendar me-1"></i>${escapeHtml(fechaFormateada)}</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-3" role="group">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarLogro(${logro.id})" title="Editar">
            <i class="fas fa-edit"></i> <span class="d-none d-md-inline">Editar</span>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarLogro(${logro.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i> <span class="d-none d-md-inline">Eliminar</span>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarLogro(id: number): void {
    const logro = this.logros.find(l => l.id === id);
    if (!logro) return;
    this.logroForm = { ...logro };
    this.abrirModal('logro');
    setTimeout(() => {
      (document.getElementById('achTitle') as HTMLInputElement).value = logro.nombre || '';
      (document.getElementById('achDesc') as HTMLTextAreaElement).value = logro.tipo || '';
      const fechaInput = document.getElementById('achDate') as HTMLInputElement;
      if (logro.fecha) fechaInput.value = logro.fecha;
      else if (logro.anio) fechaInput.value = `${logro.anio}-01-01`;
      else fechaInput.value = '';
      const submitBtn = document.querySelector('#achievementForm button[type="submit"]') as HTMLButtonElement;
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Actualizar';
    }, 50);
  }

  // ========== CERTIFICACIONES ==========
  cargarCertificaciones(): void {
    this.loadingCertificaciones = true;
    // Mostrar indicador de carga en la lista
    const list = document.getElementById('certList');
    const empty = document.getElementById('certEmpty');
    if (list) {
      list.innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm text-borgona" role="status"><span class="visually-hidden">Cargando...</span></div> <span class="ms-2">Cargando certificaciones...</span></li>';
    }
    if (empty) empty.style.display = 'none';

    this.http.get<Certificacion[]>(`${environment.apiBaseUrl}/trayectoria/certificaciones`).subscribe({
      next: (data) => {
        this.certificaciones = data;
        this.loadingCertificaciones = false;
        this.renderizarCertificaciones();
      },
      error: (err) => {
        console.error('Error al cargar certificaciones:', err);
        this.loadingCertificaciones = false;
        if (list) list.innerHTML = '';
        if (empty) empty.style.display = 'block';
        Swal.fire('Error', 'No se pudieron cargar las certificaciones', 'error');
      }
    });
  }

  subirCertificacion(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.esArchivoPdf(file)) {
      input.value = '';
      Swal.fire('Formato no permitido', 'Solo se aceptan archivos PDF.', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    const nombreInput = document.getElementById('certName') as HTMLInputElement;
    if (nombreInput && nombreInput.value) {
      formData.append('nombre', nombreInput.value);
    }

    // Mostrar barra de progreso con SweetAlert
    Swal.fire({
      title: 'Subiendo certificación...',
      html: `
        <div class="mb-3">
          <p>Archivo: <strong>${file.name}</strong></p>
          <p>Tamaño: <strong>${(file.size / (1024 * 1024)).toFixed(2)} MB</strong></p>
        </div>
        <div class="progress" style="height: 25px;">
          <div id="upload-progress" class="progress-bar progress-bar-striped progress-bar-animated bg-borgona" 
               role="progressbar" style="width: 0%">0%</div>
        </div>
      `,
      allowOutsideClick: false,
      didOpen: () => {
        // Simular progreso (ya que no tenemos eventos de progreso reales del HTTP)
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          const progressBar = document.getElementById('upload-progress');
          if (progressBar) {
            progressBar.style.width = `${Math.min(progress, 90)}%`;
            progressBar.textContent = `${Math.min(progress, 90)}%`;
          }
          if (progress >= 90) {
            clearInterval(interval);
          }
        }, 200);
      }
    });

    this.http.post<Certificacion>(`${environment.apiBaseUrl}/trayectoria/certificaciones`, formData).subscribe({
      next: () => {
        // Completar la barra de progreso
        const progressBar = document.getElementById('upload-progress');
        if (progressBar) {
          progressBar.style.width = '100%';
          progressBar.textContent = '100%';
        }
        
        setTimeout(() => {
          Swal.fire('Éxito', 'Certificación subida correctamente', 'success');
          input.value = '';
          if (nombreInput) nombreInput.value = '';
          // Recargar inmediatamente
          this.cargarCertificaciones();
        }, 500);
      },
      error: (err) => {
        console.error('Error al subir certificación:', err);
        Swal.fire('Error', 'No se pudo subir la certificación: ' + (err.error?.message || 'Error desconocido'), 'error');
      }
    });
  }

  verCertificacion(id: number, nombre: string, contentType?: string): void {
    // Obtener el documento del backend
    this.http.get(`${environment.apiBaseUrl}/documentos/${id}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        // Crear una URL temporal para el blob
        const url = window.URL.createObjectURL(blob);
        
        // Determinar si es una imagen o PDF para mostrar en modal o nueva ventana
        const esImagen = contentType?.includes('image') || nombre.toLowerCase().match(/\.(jpg|jpeg|png|gif)$/);
        const esPDF = contentType?.includes('pdf') || nombre.toLowerCase().endsWith('.pdf');
        
        if (esImagen) {
          // Para imágenes, mostrar en un modal de SweetAlert
          Swal.fire({
            title: nombre,
            imageUrl: url,
            imageWidth: '80%',
            imageAlt: nombre,
            showCloseButton: true,
            showConfirmButton: false,
            customClass: {
              popup: 'swal2-image-modal'
            }
          });
        } else if (esPDF) {
          // Para PDFs, abrir en nueva ventana
          window.open(url, '_blank');
        } else {
          // Para otros tipos, descargar directamente
          const link = document.createElement('a');
          link.href = url;
          link.download = nombre;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        
        // Limpiar la URL después de un tiempo
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      },
      error: (err) => {
        console.error('Error al cargar certificación:', err);
        Swal.fire('Error', 'No se pudo cargar la certificación', 'error');
      }
    });
  }

  eliminarCertificacion(id: number): void {
    Swal.fire({
      title: '¿Eliminar certificación?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/certificaciones/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Certificación eliminada correctamente', 'success');
            this.cargarCertificaciones();
          },
          error: (err) => {
            console.error('Error al eliminar certificación:', err);
            Swal.fire('Error', 'No se pudo eliminar la certificación', 'error');
          }
        });
      }
    });
  }

  renderizarCertificaciones(): void {
    const list = document.getElementById('certList');
    const empty = document.getElementById('certEmpty');
    const countBadge = document.getElementById('certCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.certificaciones.length.toString();

    list.innerHTML = '';
    if (this.certificaciones.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.certificaciones.forEach(cert => {
      const li = document.createElement('div');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      const sizeMB = (cert.sizeBytes / (1024 * 1024)).toFixed(2);
      
      // Determinar icono y color según el tipo de archivo
      let icono = 'fa-file';
      let colorIcono = 'text-secondary';
      const nombreLower = cert.nombre?.toLowerCase() || '';
      const contentType = cert.contentType?.toLowerCase() || '';
      
      if (nombreLower.endsWith('.pdf') || contentType.includes('pdf')) {
        icono = 'fa-file-pdf';
        colorIcono = 'text-danger';
      } else if (nombreLower.match(/\.(jpg|jpeg|png|gif)$/) || contentType.includes('image')) {
        icono = 'fa-file-image';
        colorIcono = 'text-info';
      } else if (nombreLower.match(/\.(doc|docx)$/) || contentType.includes('word')) {
        icono = 'fa-file-word';
        colorIcono = 'text-primary';
      } else if (nombreLower.match(/\.(xls|xlsx)$/) || contentType.includes('excel')) {
        icono = 'fa-file-excel';
        colorIcono = 'text-success';
      }
      
      // Obtener extensión del archivo
      const extension = nombreLower.substring(nombreLower.lastIndexOf('.'));
      const tipoArchivo = extension.toUpperCase().replace('.', '') || 'ARCHIVO';
      
      // Escapar caracteres especiales para uso en atributos HTML
      const escapeHtml = (str: string) => {
        if (!str) return '';
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      };
      
      const escapeJs = (str: string) => {
        if (!str) return '';
        return str
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r');
      };
      
      const nombreEscapado = escapeHtml(cert.nombre || 'Sin nombre');
      const nombreJsEscapado = escapeJs(cert.nombre || '');
      const contentTypeJsEscapado = escapeJs(cert.contentType || '');
      
      li.innerHTML = `
        <div class="flex-grow-1">
          <i class="fas ${icono} ${colorIcono} me-2"></i>
          <span class="fw-bold">${nombreEscapado}</span>
          <small class="text-muted ms-2">(${tipoArchivo})</small>
          <br>
          <small class="text-muted">${sizeMB} MB</small>
        </div>
        <div class="btn-group" role="group">
          <button class="btn btn-sm btn-outline-primary me-1" onclick="window.trayectoriaComponent.verCertificacion(${cert.id}, '${nombreJsEscapado}', '${contentTypeJsEscapado}')" title="Ver certificación">
            <i class="fas fa-eye"></i> Ver
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarCertificacion(${cert.id})" title="Eliminar certificación">
            <i class="fas fa-trash-alt"></i> Eliminar
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  // ========== HERRAMIENTAS ==========
  cargarHerramientas(): void {
    this.http.get<Array<{id: number, nombre: string}>>(`${environment.apiBaseUrl}/trayectoria/herramientas`).subscribe({
      next: (data) => {
        this.herramientas = data.map(h => ({ id: h.id, nombre: h.nombre }));
        this.renderizarHerramientas();
      },
      error: (err) => {
        console.error('Error al cargar herramientas:', err);
        // No mostrar error, solo dejar lista vacía
      }
    });
  }

  agregarHerramienta(): void {
    const input = document.getElementById('toolInput') as HTMLInputElement;
    const herramienta = input.value.trim();
    if (!herramienta) {
      Swal.fire('Advertencia', 'Ingresa el nombre de la herramienta', 'warning');
      return;
    }

    if (this.herramientas.length >= 12) {
      Swal.fire('Advertencia', 'Máximo 12 herramientas permitidas', 'warning');
      return;
    }

    if (this.herramientas.some(h => h.nombre === herramienta)) {
      Swal.fire('Advertencia', 'Esta herramienta ya está registrada', 'warning');
      return;
    }

    // Guardar en backend y agregar a la lista con el id devuelto (evita recarga y bugs)
    this.http.post<{id: number, nombre: string}>(`${environment.apiBaseUrl}/trayectoria/herramientas/agregar`, { nombre: herramienta }).subscribe({
      next: (saved) => {
        input.value = '';
        this.herramientas = [...this.herramientas, { id: saved.id, nombre: saved.nombre }];
        this.renderizarHerramientas();
      },
      error: (err) => {
        console.error('Error al agregar herramienta:', err);
        const mensaje = err.error?.message || 'No se pudo agregar la herramienta';
        Swal.fire('Error', mensaje, 'error');
      }
    });
  }

  eliminarHerramienta(id: number): void {
    const item = this.herramientas.find(h => h.id === id);
    const nombre = item?.nombre ?? 'esta herramienta';
    Swal.fire({
      title: '¿Eliminar herramienta?',
      text: `¿Estás seguro de eliminar "${nombre}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/herramientas/${id}`).subscribe({
          next: () => {
            this.herramientas = this.herramientas.filter(h => h.id !== id);
            this.renderizarHerramientas();
          },
          error: (err) => {
            console.error('Error al eliminar herramienta:', err);
            Swal.fire('Error', 'No se pudo eliminar la herramienta', 'error');
          }
        });
      }
    });
  }

  renderizarHerramientas(): void {
    const list = document.getElementById('toolsList');
    const empty = document.getElementById('toolsEmpty');
    const countBadge = document.getElementById('toolCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = `${this.herramientas.length}/12`;

    list.innerHTML = '';
    if (this.herramientas.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.herramientas.forEach(h => {
      const badge = document.createElement('span');
      badge.className = 'badge bg-borgona me-2 mb-2 d-inline-flex align-items-center';
      badge.innerHTML = `
        ${this.escapeHtml(h.nombre)}
        <button class="btn-close btn-close-white ms-2" onclick="window.trayectoriaComponent.eliminarHerramienta(${h.id})" aria-label="Eliminar"></button>
      `;
      list.appendChild(badge);
    });
  }

  // ========== ARTÍCULOS ==========
  cargarArticulos(): void {
    this.loadingArticulos = true;
    this.http.get<Articulo[]>(`${environment.apiBaseUrl}/trayectoria/articulos`).subscribe({
      next: (data) => {
        this.articulos = data;
        this.loadingArticulos = false;
        this.renderizarArticulos();
      },
      error: (err) => {
        console.error('Error al cargar artículos:', err);
        this.loadingArticulos = false;
        Swal.fire('Error', 'No se pudieron cargar los artículos', 'error');
      }
    });
  }

  guardarArticulo(): void {
    const form = document.getElementById('articleForm') as HTMLFormElement;
    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      return;
    }

    const articuloData: any = {
      titulo: (document.getElementById('articleTitle') as HTMLInputElement).value,
      revista: (document.getElementById('articleJournal') as HTMLInputElement).value || undefined,
      anio: (document.getElementById('articleYear') as HTMLInputElement).value ? 
            parseInt((document.getElementById('articleYear') as HTMLInputElement).value) : undefined,
      doi: (document.getElementById('articleDOI') as HTMLInputElement).value || undefined,
    };

    if (this.articuloForm.id) {
      articuloData.id = this.articuloForm.id;
    }

    this.http.post<Articulo>(`${environment.apiBaseUrl}/trayectoria/articulos`, articuloData).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('articulos').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Artículo guardado correctamente'
              : 'Artículo guardado. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          form.reset();
          form.classList.remove('was-validated');
          this.articuloForm = {};
          this.cerrarModal();
          this.cargarArticulos();
        });
      },
      error: (err) => {
        console.error('Error al guardar artículo:', err);
        Swal.fire('Error', 'No se pudo guardar el artículo: ' + (err.error?.message || 'Error desconocido'), 'error');
      }
    });
  }

  eliminarArticulo(id: number): void {
    Swal.fire({
      title: '¿Eliminar artículo?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/articulos/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Artículo eliminado correctamente', 'success');
            this.cargarArticulos();
          },
          error: (err) => {
            console.error('Error al eliminar artículo:', err);
            Swal.fire('Error', 'No se pudo eliminar el artículo', 'error');
          }
        });
      }
    });
  }

  renderizarArticulos(): void {
    const list = document.getElementById('articlesList');
    const empty = document.getElementById('articlesEmpty');
    const countBadge = document.getElementById('articleCount');
    if (!list || !empty) return;

    // Actualizar contador
    if (countBadge) countBadge.textContent = this.articulos.length.toString();

    list.innerHTML = '';
    if (this.articulos.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.articulos.forEach(articulo => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const escapeHtml = (str: string) => str ? str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
      
      // Construir URL del DOI si existe
      let urlDOI = '';
      if (articulo.doi) {
        urlDOI = articulo.doi.startsWith('http') ? articulo.doi : `https://doi.org/${articulo.doi}`;
      }
      
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1">
            <i class="fas fa-file-alt text-borgona me-2"></i>${escapeHtml(articulo.titulo || 'Sin título')}
          </div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${articulo.revista ? `<span class="text-muted small"><i class="fas fa-book me-1"></i>${escapeHtml(articulo.revista)}</span>` : ''}
            ${articulo.anio ? `<span class="badge bg-info"><i class="fas fa-calendar me-1"></i>${articulo.anio}</span>` : ''}
            ${articulo.doi ? `<span class="badge bg-secondary"><i class="fas fa-link me-1"></i>DOI</span>` : ''}
          </div>
          ${urlDOI ? `<div class="mt-1"><a href="${escapeHtml(urlDOI)}" target="_blank" class="text-primary small"><i class="fas fa-external-link-alt me-1"></i>Ver artículo</a></div>` : ''}
        </div>
        <div class="btn-group ms-3" role="group">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarArticulo(${articulo.id})" title="Editar">
            <i class="fas fa-edit"></i> <span class="d-none d-md-inline">Editar</span>
          </button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarArticulo(${articulo.id})" title="Eliminar">
            <i class="fas fa-trash-alt"></i> <span class="d-none d-md-inline">Eliminar</span>
          </button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarArticulo(id: number): void {
    const articulo = this.articulos.find(a => a.id === id);
    if (!articulo) return;
    this.articuloForm = { ...articulo };
    this.abrirModal('articulo');
    setTimeout(() => {
      (document.getElementById('articleTitle') as HTMLInputElement).value = articulo.titulo || '';
      (document.getElementById('articleJournal') as HTMLInputElement).value = articulo.revista || '';
      (document.getElementById('articleYear') as HTMLInputElement).value = articulo.anio?.toString() || '';
      (document.getElementById('articleDOI') as HTMLInputElement).value = articulo.doi || '';
      const urlInput = document.getElementById('articleURL') as HTMLInputElement;
      if (urlInput && articulo.doi) urlInput.value = articulo.doi.startsWith('http') ? articulo.doi : `https://doi.org/${articulo.doi}`;
      const submitBtn = document.querySelector('#articleForm button[type="submit"]') as HTMLButtonElement;
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Actualizar';
    }, 50);
  }

  // ========== PROPIEDAD INTELECTUAL ==========
  cargarPropiedadIntelectual(): void {
    this.loadingPI = true;
    this.http.get<PropiedadIntelectual[]>(`${environment.apiBaseUrl}/trayectoria/propiedad-intelectual`).subscribe({
      next: (data) => {
        this.propiedadIntelectual = data;
        this.loadingPI = false;
        this.renderizarPropiedadIntelectual();
      },
      error: (err) => {
        console.error('Error al cargar propiedad intelectual:', err);
        this.loadingPI = false;
      }
    });
  }

  guardarPropiedadIntelectual(): void {
    const form = document.getElementById('piForm') as HTMLFormElement;
    if (!form?.checkValidity()) {
      form?.classList.add('was-validated');
      return;
    }
    const titulo = (document.getElementById('piTitulo') as HTMLInputElement)?.value?.trim();
    if (!titulo) {
      Swal.fire('Advertencia', 'El título es requerido', 'warning');
      return;
    }
    const doSave = (documentoId?: number) => {
      const payload: PropiedadIntelectual = {
        tipo: (document.getElementById('piTipo') as HTMLSelectElement)?.value || 'OTRO',
        titulo,
        numeroRegistro: (document.getElementById('piNumeroRegistro') as HTMLInputElement)?.value?.trim() || undefined,
        institucionOficina: (document.getElementById('piInstitucion') as HTMLInputElement)?.value?.trim() || undefined,
        pais: (document.getElementById('piPais') as HTMLInputElement)?.value?.trim() || undefined,
        descripcion: (document.getElementById('piDescripcion') as HTMLTextAreaElement)?.value?.trim() || undefined,
        fechaRegistro: (document.getElementById('piFechaRegistro') as HTMLInputElement)?.value || undefined,
        anio: parseInt((document.getElementById('piAnio') as HTMLInputElement)?.value || '', 10) || undefined,
        documentoId
      };
      if (this.piForm.id) payload.id = this.piForm.id;

      this.http.post<PropiedadIntelectual>(`${environment.apiBaseUrl}/trayectoria/propiedad-intelectual`, payload).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('pi').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Registro guardado correctamente'
              : 'Registro guardado. La evidencia del rubro no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          form.reset();
          form.classList.remove('was-validated');
          this.piForm = {};
          this.cerrarModal();
          this.cargarPropiedadIntelectual();
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error');
      }
    });
    };

    if (this.piFileSelected) {
      if (!this.esArchivoPdf(this.piFileSelected)) {
        this.piFileSelected = null;
        const piFile = document.getElementById('piDocumento') as HTMLInputElement;
        if (piFile) piFile.value = '';
        Swal.fire('Formato no permitido', 'Solo se aceptan archivos PDF.', 'warning');
        return;
      }
      const piFile = document.getElementById('piDocumento') as HTMLInputElement;
      if (!this.validarTamanoPdf(this.piFileSelected, 'perfil.propiedadIntelectual', piFile)) {
        this.piFileSelected = null;
        return;
      }

      const formData = new FormData();
      formData.append('file', this.piFileSelected);
      formData.append('nombre', titulo);
      Swal.fire({ title: 'Subiendo documento...', allowOutsideClick: false });
      Swal.showLoading();
      this.http.post<{ id: number }>(`${environment.apiBaseUrl}/trayectoria/propiedad-intelectual/documento`, formData).subscribe({
        next: (r) => {
          Swal.close();
          doSave(r.id);
        },
        error: (err) => {
          Swal.fire('Error', err.error?.message || 'No se pudo subir el documento', 'error');
        }
      });
    } else {
      doSave(this.piForm.documentoId);
    }
  }

  verDocumentoPI(documentoId: number): void {
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const contentType = blob.type;
        const esPDF = contentType?.includes('pdf');
        if (esPDF) {
          window.open(url, '_blank');
        } else {
          const link = document.createElement('a');
          link.href = url;
          link.download = 'documento-pi';
          link.click();
        }
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      },
      error: () => Swal.fire('Error', 'No se pudo cargar el documento', 'error')
    });
  }

  eliminarPropiedadIntelectual(id: number): void {
    Swal.fire({
      title: '¿Eliminar registro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/propiedad-intelectual/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Registro eliminado correctamente', 'success');
            this.cargarPropiedadIntelectual();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  renderizarPropiedadIntelectual(): void {
    const list = document.getElementById('piList');
    const empty = document.getElementById('piEmpty');
    const countBadge = document.getElementById('piCount');
    if (!list || !empty) return;

    if (countBadge) countBadge.textContent = this.propiedadIntelectual.length.toString();
    list.innerHTML = '';
    if (this.propiedadIntelectual.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    const tipoLabels: Record<string, string> = {
      PATENTE: 'Patente',
      MARCA: 'Marca',
      DISENO_INDUSTRIAL: 'Diseño industrial',
      DERECHO_AUTOR: 'Derecho de autor',
      SECRETO_INDUSTRIAL: 'Secreto industrial',
      OTRO: 'Otro'
    };

    this.propiedadIntelectual.forEach(pi => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const tipoLabel = tipoLabels[pi.tipo || ''] || pi.tipo || 'Otro';
      const fecha = pi.fechaRegistro || (pi.anio ? String(pi.anio) : '');
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1"><i class="fas fa-copyright text-borgona me-2"></i>${this.escapeHtml(pi.titulo || 'Sin título')}</div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            <span class="badge bg-borgona">${this.escapeHtml(tipoLabel)}</span>
            ${pi.numeroRegistro ? `<span class="text-muted small">Reg. ${this.escapeHtml(pi.numeroRegistro)}</span>` : ''}
            ${pi.institucionOficina ? `<span class="text-muted small"><i class="fas fa-building me-1"></i>${this.escapeHtml(pi.institucionOficina)}</span>` : ''}
            ${pi.pais ? `<span class="text-muted small"><i class="fas fa-globe me-1"></i>${this.escapeHtml(pi.pais)}</span>` : ''}
            ${fecha ? `<span class="badge bg-secondary">${this.escapeHtml(fecha)}</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-2">
          ${pi.documentoId ? `<button class="btn btn-sm btn-outline-secondary" onclick="window.trayectoriaComponent.verDocumentoPI(${pi.documentoId})" title="Ver documento"><i class="fas fa-file-pdf"></i></button>` : ''}
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarPropiedadIntelectual(${pi.id})" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarPropiedadIntelectual(${pi.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      list.appendChild(li);
    });
  }

  editarPropiedadIntelectual(id: number): void {
    const pi = this.propiedadIntelectual.find(p => p.id === id);
    if (!pi) return;
    this.piForm = { ...pi };
    this.piFileSelected = null;
    this.abrirModal('pi');
    setTimeout(() => {
      (document.getElementById('piTitulo') as HTMLInputElement).value = pi.titulo || '';
      (document.getElementById('piTipo') as HTMLSelectElement).value = pi.tipo || 'OTRO';
      (document.getElementById('piNumeroRegistro') as HTMLInputElement).value = pi.numeroRegistro || '';
      (document.getElementById('piInstitucion') as HTMLInputElement).value = pi.institucionOficina || '';
      (document.getElementById('piPais') as HTMLInputElement).value = pi.pais || '';
      (document.getElementById('piDescripcion') as HTMLTextAreaElement).value = pi.descripcion || '';
      (document.getElementById('piFechaRegistro') as HTMLInputElement).value = pi.fechaRegistro || '';
      (document.getElementById('piAnio') as HTMLInputElement).value = pi.anio?.toString() || '';
      const piDoc = document.getElementById('piDocumento') as HTMLInputElement;
      if (piDoc) piDoc.value = '';
      const submitBtn = document.querySelector('#piForm button[type="submit"]') as HTMLButtonElement;
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-save me-1"></i>Actualizar';
    }, 50);
  }

  // ========== INCIDENCIA SOCIAL ==========
  cargarIncidenciaSocial(): void {
    this.loadingIncidencia = true;
    this.http.get<IncidenciaSocial[]>(`${environment.apiBaseUrl}/trayectoria/incidencia-social`).subscribe({
      next: (data) => {
        this.incidenciaSocial = data;
        this.loadingIncidencia = false;
        this.renderizarIncidenciaSocial();
      },
      error: (err) => {
        console.error('Error al cargar incidencia social:', err);
        this.loadingIncidencia = false;
      }
    });
  }

  guardarIncidenciaSocial(): void {
    const form = document.getElementById('incidenciaForm') as HTMLFormElement;
    if (!form?.checkValidity()) {
      form?.classList.add('was-validated');
      return;
    }
    const titulo = (document.getElementById('incidenciaTitulo') as HTMLInputElement)?.value?.trim();
    if (!titulo) {
      Swal.fire('Advertencia', 'El título / investigación es requerido', 'warning');
      return;
    }
    const payload: IncidenciaSocial = {
      titulo,
      ubicacion: (document.getElementById('incidenciaUbicacion') as HTMLInputElement)?.value?.trim() || undefined,
      descripcion: (document.getElementById('incidenciaDescripcion') as HTMLTextAreaElement)?.value?.trim() || undefined,
      fecha: (document.getElementById('incidenciaFecha') as HTMLInputElement)?.value || undefined,
      anio: parseInt((document.getElementById('incidenciaAnio') as HTMLInputElement)?.value || '', 10) || undefined
    };
    if (this.incidenciaForm.id) payload.id = this.incidenciaForm.id;

    this.http.post<IncidenciaSocial>(`${environment.apiBaseUrl}/trayectoria/incidencia-social`, payload).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('incidencia').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Registro guardado correctamente'
              : 'Registro guardado. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          form.reset();
          form.classList.remove('was-validated');
          this.incidenciaForm = {};
          this.cerrarModal();
          this.cargarIncidenciaSocial();
        });
      },
      error: (err) => {
        Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error');
      }
    });
  }

  eliminarIncidenciaSocial(id: number): void {
    Swal.fire({
      title: '¿Eliminar registro?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/incidencia-social/${id}`).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'Registro eliminado correctamente', 'success');
            this.cargarIncidenciaSocial();
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  editarIncidenciaSocial(id: number): void {
    const inc = this.incidenciaSocial.find(i => i.id === id);
    if (!inc) return;
    this.incidenciaForm = { ...inc };
    this.abrirModal('incidencia');
    setTimeout(() => {
      (document.getElementById('incidenciaTitulo') as HTMLInputElement).value = inc.titulo || '';
      (document.getElementById('incidenciaUbicacion') as HTMLInputElement).value = inc.ubicacion || '';
      (document.getElementById('incidenciaDescripcion') as HTMLTextAreaElement).value = inc.descripcion || '';
      (document.getElementById('incidenciaFecha') as HTMLInputElement).value = inc.fecha || '';
      (document.getElementById('incidenciaAnio') as HTMLInputElement).value = inc.anio?.toString() || '';
    }, 50);
  }

  renderizarIncidenciaSocial(): void {
    const list = document.getElementById('incidenciaList');
    const empty = document.getElementById('incidenciaEmpty');
    const countBadge = document.getElementById('incidenciaCount');
    if (!list || !empty) return;

    if (countBadge) countBadge.textContent = this.incidenciaSocial.length.toString();
    list.innerHTML = '';
    if (this.incidenciaSocial.length === 0) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';

    this.incidenciaSocial.forEach(inc => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      const tit = this.escapeHtml(inc.titulo || 'Sin título');
      const ubi = inc.ubicacion ? this.escapeHtml(inc.ubicacion) : '';
      const desc = inc.descripcion ? this.escapeHtml(inc.descripcion.slice(0, 150)) + (inc.descripcion.length > 150 ? '...' : '') : '';
      const fecha = inc.fecha || (inc.anio ? String(inc.anio) : '');
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1"><i class="fas fa-handshake-angle text-borgona me-2"></i>${tit}</div>
          ${ubi ? `<div class="small text-muted mb-1"><i class="fas fa-map-marker-alt me-1"></i>${ubi}</div>` : ''}
          ${desc ? `<p class="mb-1 small">${desc}</p>` : ''}
          ${fecha ? `<span class="badge bg-secondary">${this.escapeHtml(fecha)}</span>` : ''}
        </div>
        <div class="btn-group ms-2">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarIncidenciaSocial(${inc.id})" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarIncidenciaSocial(${inc.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </div>
      `;
      list.appendChild(li);
    });
  }
  // ========== TRAYECTORIA ACADÉMICA ==========
  cargarTrayAcademica(): void {
    this.loadingTrayAcademica = true;
    this.http.get<TrayectoriaAcademica[]>(`${environment.apiBaseUrl}/trayectoria/academica`).subscribe({
      next: (data) => {
        this.trayAcademica = [...(data || [])].sort((a, b) => (b.id || 0) - (a.id || 0));
        this.loadingTrayAcademica = false;
        this.renderizarTrayAcademica();
      },
      error: () => { this.loadingTrayAcademica = false; }
    });
  }

  guardarTrayAcademica(): void {
    const form = document.getElementById('trayAcadForm') as HTMLFormElement;
    if (!form?.checkValidity()) { form?.classList.add('was-validated'); return; }
    const payload: TrayectoriaAcademica = {
      nivel: (document.getElementById('trayAcadNivel') as HTMLSelectElement)?.value || undefined,
      titulo: (document.getElementById('trayAcadTitulo') as HTMLInputElement)?.value?.trim() || undefined,
      institucion: (document.getElementById('trayAcadInstitucion') as HTMLInputElement)?.value?.trim() || undefined,
      estatus: (document.getElementById('trayAcadEstatus') as HTMLSelectElement)?.value || undefined,
      fechaObtencion: (document.getElementById('trayAcadFecha') as HTMLInputElement)?.value || undefined,
      cedulaProfesional: (document.getElementById('trayAcadCedula') as HTMLInputElement)?.value?.trim() || undefined,
    };
    if (this.trayAcademicaForm.id) payload.id = this.trayAcademicaForm.id;
    this.http.post<TrayectoriaAcademica>(`${environment.apiBaseUrl}/trayectoria/academica`, payload).subscribe({
      next: (saved) => {
        const isEdit = !!this.trayAcademicaForm.id;
        if (isEdit && saved?.id) {
          this.trayAcademica = this.trayAcademica.map((item) => (item.id === saved.id ? saved : item));
        } else if (saved) {
          this.trayAcademica = [saved, ...this.trayAcademica.filter((item) => item.id !== saved.id)];
        }
        this.trayAcademica = [...this.trayAcademica].sort((a, b) => (b.id || 0) - (a.id || 0));
        this.renderizarTrayAcademica();
        this.subirEvidenciaModalRubro('trayAcademica').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Formación académica guardada'
              : 'Formación académica guardada. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          this.cerrarModal();
        });
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error'); }
    });
  }

  editarTrayAcademica(id: number): void {
    const item = this.trayAcademica.find(t => t.id === id);
    if (!item) return;
    this.trayAcademicaForm = { ...item };
    this.abrirModal('trayAcademica');
    setTimeout(() => {
      (document.getElementById('trayAcadNivel') as HTMLSelectElement).value = item.nivel || '';
      (document.getElementById('trayAcadTitulo') as HTMLInputElement).value = item.titulo || '';
      (document.getElementById('trayAcadInstitucion') as HTMLInputElement).value = item.institucion || '';
      (document.getElementById('trayAcadEstatus') as HTMLSelectElement).value = item.estatus || '';
      (document.getElementById('trayAcadFecha') as HTMLInputElement).value = item.fechaObtencion || '';
      (document.getElementById('trayAcadCedula') as HTMLInputElement).value = item.cedulaProfesional || '';
    }, 50);
  }

  eliminarTrayAcademica(id: number): void {
    Swal.fire({ title: '¿Eliminar formación?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' }).then((r) => {
      if (r.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/academica/${id}`).subscribe({
          next: () => { Swal.fire('Eliminado', 'Registro eliminado', 'success'); this.cargarTrayAcademica(); },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  renderizarTrayAcademica(): void {
    const list = document.getElementById('trayAcadList');
    const empty = document.getElementById('trayAcadEmpty');
    const count = document.getElementById('trayAcadCount');
    if (!list || !empty) return;
    if (count) count.textContent = this.trayAcademica.length.toString();
    list.innerHTML = '';
    if (this.trayAcademica.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    this.trayAcademica.forEach(t => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1"><i class="fas fa-graduation-cap text-borgona me-2"></i>${this.escapeHtml(t.titulo || 'Sin título')}</div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${t.nivel ? `<span class="badge bg-borgona">${this.escapeHtml(t.nivel)}</span>` : ''}
            ${t.institucion ? `<span class="text-muted small"><i class="fas fa-university me-1"></i>${this.escapeHtml(t.institucion)}</span>` : ''}
            ${t.estatus ? `<span class="badge bg-secondary">${this.escapeHtml(t.estatus)}</span>` : ''}
            ${t.fechaObtencion ? `<span class="badge bg-info"><i class="fas fa-calendar me-1"></i>${this.escapeHtml(t.fechaObtencion)}</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-2">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarTrayAcademica(${t.id})" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarTrayAcademica(${t.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </div>`;
      list.appendChild(li);
    });
  }

  // ========== TRAYECTORIA PROFESIONAL ==========
  cargarTrayProfesional(): void {
    this.loadingTrayProfesional = true;
    this.http.get<TrayectoriaProfesional[]>(`${environment.apiBaseUrl}/trayectoria/profesional`).subscribe({
      next: (data) => {
        this.trayProfesional = [...(data || [])].sort((a, b) => (b.id || 0) - (a.id || 0));
        this.loadingTrayProfesional = false;
        this.renderizarTrayProfesional();
      },
      error: () => { this.loadingTrayProfesional = false; }
    });
  }

  guardarTrayProfesional(): void {
    const form = document.getElementById('trayProfForm') as HTMLFormElement;
    if (!form?.checkValidity()) { form?.classList.add('was-validated'); return; }
    const payload: TrayectoriaProfesional = {
      nombramiento: (document.getElementById('trayProfNombramiento') as HTMLInputElement)?.value?.trim() || undefined,
      institucion: (document.getElementById('trayProfInstitucion') as HTMLInputElement)?.value?.trim() || undefined,
      fechaInicio: (document.getElementById('trayProfFechaInicio') as HTMLInputElement)?.value || undefined,
      fechaFin: (document.getElementById('trayProfFechaFin') as HTMLInputElement)?.value || undefined,
      esActual: (document.getElementById('trayProfEsActual') as HTMLInputElement)?.checked || false,
      logros: (document.getElementById('trayProfLogros') as HTMLTextAreaElement)?.value?.trim() || undefined,
    };
    if (this.trayProfesionalForm.id) payload.id = this.trayProfesionalForm.id;
    this.http.post<TrayectoriaProfesional>(`${environment.apiBaseUrl}/trayectoria/profesional`, payload).subscribe({
      next: (saved) => {
        const isEdit = !!this.trayProfesionalForm.id;
        if (isEdit && saved?.id) {
          this.trayProfesional = this.trayProfesional.map((item) => (item.id === saved.id ? saved : item));
        } else if (saved) {
          this.trayProfesional = [saved, ...this.trayProfesional.filter((item) => item.id !== saved.id)];
        }
        this.trayProfesional = [...this.trayProfesional].sort((a, b) => (b.id || 0) - (a.id || 0));
        this.renderizarTrayProfesional();
        this.subirEvidenciaModalRubro('trayProfesional').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Experiencia guardada'
              : 'Experiencia guardada. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          this.cerrarModal();
        });
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error'); }
    });
  }

  editarTrayProfesional(id: number): void {
    const item = this.trayProfesional.find(t => t.id === id);
    if (!item) return;
    this.trayProfesionalForm = { ...item };
    this.abrirModal('trayProfesional');
    setTimeout(() => {
      (document.getElementById('trayProfNombramiento') as HTMLInputElement).value = item.nombramiento || '';
      (document.getElementById('trayProfInstitucion') as HTMLInputElement).value = item.institucion || '';
      (document.getElementById('trayProfFechaInicio') as HTMLInputElement).value = item.fechaInicio || '';
      (document.getElementById('trayProfFechaFin') as HTMLInputElement).value = item.fechaFin || '';
      (document.getElementById('trayProfEsActual') as HTMLInputElement).checked = item.esActual || false;
      (document.getElementById('trayProfLogros') as HTMLTextAreaElement).value = item.logros || '';
    }, 50);
  }

  eliminarTrayProfesional(id: number): void {
    Swal.fire({ title: '¿Eliminar experiencia?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' }).then((r) => {
      if (r.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/profesional/${id}`).subscribe({
          next: () => { Swal.fire('Eliminado', 'Registro eliminado', 'success'); this.cargarTrayProfesional(); },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  renderizarTrayProfesional(): void {
    const list = document.getElementById('trayProfList');
    const empty = document.getElementById('trayProfEmpty');
    const count = document.getElementById('trayProfCount');
    if (!list || !empty) return;
    if (count) count.textContent = this.trayProfesional.length.toString();
    list.innerHTML = '';
    if (this.trayProfesional.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    this.trayProfesional.forEach(t => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1"><i class="fas fa-briefcase text-borgona me-2"></i>${this.escapeHtml(t.nombramiento || 'Sin puesto')}</div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${t.institucion ? `<span class="text-muted small"><i class="fas fa-building me-1"></i>${this.escapeHtml(t.institucion)}</span>` : ''}
            ${t.fechaInicio ? `<span class="badge bg-info"><i class="fas fa-calendar me-1"></i>${this.escapeHtml(t.fechaInicio)}${t.esActual ? ' - Actual' : (t.fechaFin ? ' - ' + this.escapeHtml(t.fechaFin) : '')}</span>` : ''}
            ${t.esActual ? `<span class="badge bg-success">Actual</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-2">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarTrayProfesional(${t.id})" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarTrayProfesional(${t.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </div>`;
      list.appendChild(li);
    });
  }

  // ========== ESTANCIAS ==========
  cargarEstancias(): void {
    this.loadingEstancias = true;
    this.http.get<Estancia[]>(`${environment.apiBaseUrl}/trayectoria/estancias`).subscribe({
      next: (data) => { this.estancias = data; this.loadingEstancias = false; this.renderizarEstancias(); },
      error: () => { this.loadingEstancias = false; }
    });
  }

  guardarEstancia(): void {
    const form = document.getElementById('estanciaFormEl') as HTMLFormElement;
    if (!form?.checkValidity()) { form?.classList.add('was-validated'); return; }
    const payload: Estancia = {
      tipo: (document.getElementById('estanciaTipo') as HTMLSelectElement)?.value || undefined,
      nombreProyecto: (document.getElementById('estanciaNombre') as HTMLInputElement)?.value?.trim() || undefined,
      institucionReceptora: (document.getElementById('estanciaInstitucion') as HTMLInputElement)?.value?.trim() || undefined,
      fechaInicio: (document.getElementById('estanciaFechaInicio') as HTMLInputElement)?.value || undefined,
      fechaFin: (document.getElementById('estanciaFechaFin') as HTMLInputElement)?.value || undefined,
      logros: (document.getElementById('estanciaLogros') as HTMLTextAreaElement)?.value?.trim() || undefined,
    };
    if (this.estanciaForm.id) payload.id = this.estanciaForm.id;
    this.http.post<Estancia>(`${environment.apiBaseUrl}/trayectoria/estancias`, payload).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('estancias').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Estancia guardada'
              : 'Estancia guardada. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          this.cerrarModal();
          this.cargarEstancias();
        });
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error'); }
    });
  }

  editarEstancia(id: number): void {
    const item = this.estancias.find(e => e.id === id);
    if (!item) return;
    this.estanciaForm = { ...item };
    this.abrirModal('estancia');
    setTimeout(() => {
      (document.getElementById('estanciaTipo') as HTMLSelectElement).value = item.tipo || '';
      (document.getElementById('estanciaNombre') as HTMLInputElement).value = item.nombreProyecto || '';
      (document.getElementById('estanciaInstitucion') as HTMLInputElement).value = item.institucionReceptora || '';
      (document.getElementById('estanciaFechaInicio') as HTMLInputElement).value = item.fechaInicio || '';
      (document.getElementById('estanciaFechaFin') as HTMLInputElement).value = item.fechaFin || '';
      (document.getElementById('estanciaLogros') as HTMLTextAreaElement).value = item.logros || '';
    }, 50);
  }

  eliminarEstancia(id: number): void {
    Swal.fire({ title: '¿Eliminar estancia?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' }).then((r) => {
      if (r.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/estancias/${id}`).subscribe({
          next: () => { Swal.fire('Eliminado', 'Estancia eliminada', 'success'); this.cargarEstancias(); },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  renderizarEstancias(): void {
    const list = document.getElementById('estanciasList');
    const empty = document.getElementById('estanciasEmpty');
    const count = document.getElementById('estanciaCount');
    if (!list || !empty) return;
    if (count) count.textContent = this.estancias.length.toString();
    list.innerHTML = '';
    if (this.estancias.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    this.estancias.forEach(e => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1"><i class="fas fa-plane text-borgona me-2"></i>${this.escapeHtml(e.nombreProyecto || 'Sin nombre')}</div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${e.tipo ? `<span class="badge bg-borgona">${this.escapeHtml(e.tipo)}</span>` : ''}
            ${e.institucionReceptora ? `<span class="text-muted small"><i class="fas fa-university me-1"></i>${this.escapeHtml(e.institucionReceptora)}</span>` : ''}
            ${e.fechaInicio ? `<span class="badge bg-info"><i class="fas fa-calendar me-1"></i>${this.escapeHtml(e.fechaInicio)}${e.fechaFin ? ' - ' + this.escapeHtml(e.fechaFin) : ''}</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-2">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarEstancia(${e.id})" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarEstancia(${e.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </div>`;
      list.appendChild(li);
    });
  }

  // ========== CONGRESOS ==========
  cargarCongresos(): void {
    this.loadingCongresos = true;
    this.http.get<Congreso[]>(`${environment.apiBaseUrl}/trayectoria/congresos`).subscribe({
      next: (data) => {
        this.congresos = data || [];
        this.loadingCongresos = false;
      },
      error: (err) => {
        console.error('Error al cargar congresos:', err);
        this.loadingCongresos = false;
        Swal.fire('Error', 'No se pudieron cargar los congresos', 'error');
      }
    });
  }

  guardarCongreso(): void {
    const form = document.getElementById('congresoFormEl') as HTMLFormElement;
    if (!form?.checkValidity()) { form?.classList.add('was-validated'); return; }
    const payload: Congreso = {
      nombre: (document.getElementById('congresoNombre') as HTMLInputElement)?.value?.trim() || undefined,
      tituloTrabajo: (document.getElementById('congresoTitulo') as HTMLInputElement)?.value?.trim() || undefined,
      tipoParticipacion: (document.getElementById('congresoTipo') as HTMLSelectElement)?.value || undefined,
      fecha: (document.getElementById('congresoFecha') as HTMLInputElement)?.value || undefined,
      paisSede: (document.getElementById('congresoPais') as HTMLSelectElement)?.value || undefined,
    };
    if (this.congresoForm.id) payload.id = this.congresoForm.id;
    this.http.post<any>(`${environment.apiBaseUrl}/trayectoria/congresos`, payload).subscribe({
      next: (res) => {
        this.subirEvidenciaModalRubro('congresos').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Congreso guardado'
              : 'Congreso guardado. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          if (!this.congresoForm.id && res?.id) {
            this.congresos = [...this.congresos, { ...payload, id: res.id }];
          }
          this.cerrarModal();
          this.cargarCongresos();
        });
      },
      error: (err) => {
        console.error('Error al guardar congreso:', err);
        Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error');
      }
    });
  }

  editarCongreso(id: number): void {
    const item = this.congresos.find(c => c.id === id);
    if (!item) return;
    this.congresoForm = { ...item };
    this.abrirModal('congreso');
    setTimeout(() => {
      (document.getElementById('congresoNombre') as HTMLInputElement).value = item.nombre || '';
      (document.getElementById('congresoTitulo') as HTMLInputElement).value = item.tituloTrabajo || '';
      (document.getElementById('congresoTipo') as HTMLSelectElement).value = item.tipoParticipacion || '';
      (document.getElementById('congresoFecha') as HTMLInputElement).value = item.fecha || '';
      (document.getElementById('congresoPais') as HTMLSelectElement).value = item.paisSede || '';
    }, 50);
  }

  eliminarCongreso(id: number): void {
    Swal.fire({ title: '¿Eliminar congreso?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' }).then((r) => {
      if (r.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/congresos/${id}`).subscribe({
          next: () => {
            this.congresos = this.congresos.filter(c => c.id !== id);
            Swal.fire('Eliminado', 'Congreso eliminado', 'success');
          },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  // ========== DIVULGACIÓN ==========
  cargarDivulgaciones(): void {
    this.loadingDivulgaciones = true;
    this.http.get<Divulgacion[]>(`${environment.apiBaseUrl}/trayectoria/divulgacion`).subscribe({
      next: (data) => { this.divulgaciones = data; this.loadingDivulgaciones = false; this.renderizarDivulgaciones(); },
      error: () => { this.loadingDivulgaciones = false; }
    });
  }

  guardarDivulgacion(): void {
    const form = document.getElementById('divulgacionFormEl') as HTMLFormElement;
    if (!form?.checkValidity()) { form?.classList.add('was-validated'); return; }
    const payload: Divulgacion = {
      titulo: (document.getElementById('divulgacionTitulo') as HTMLInputElement)?.value?.trim() || undefined,
      tipoDivulgacion: (document.getElementById('divulgacionTipo') as HTMLSelectElement)?.value || undefined,
      medioComunicacion: (document.getElementById('divulgacionMedio') as HTMLSelectElement)?.value || undefined,
      dirigidoA: (document.getElementById('divulgacionDirigido') as HTMLSelectElement)?.value || undefined,
      fecha: (document.getElementById('divulgacionFecha') as HTMLInputElement)?.value || undefined,
      institucionOrganizadora: (document.getElementById('divulgacionInstitucion') as HTMLInputElement)?.value?.trim() || undefined,
    };
    if (this.divulgacionForm.id) payload.id = this.divulgacionForm.id;
    this.http.post<Divulgacion>(`${environment.apiBaseUrl}/trayectoria/divulgacion`, payload).subscribe({
      next: () => {
        this.subirEvidenciaModalRubro('divulgacion').then((evidenciaOk) => {
          Swal.fire(
            evidenciaOk ? 'Éxito' : 'Advertencia',
            evidenciaOk
              ? 'Actividad de divulgación guardada'
              : 'Actividad guardada. La evidencia no se pudo subir.',
            evidenciaOk ? 'success' : 'warning'
          );
          this.cerrarModal();
          this.cargarDivulgaciones();
        });
      },
      error: (err) => { Swal.fire('Error', err.error?.message || 'No se pudo guardar', 'error'); }
    });
  }

  editarDivulgacion(id: number): void {
    const item = this.divulgaciones.find(d => d.id === id);
    if (!item) return;
    this.divulgacionForm = { ...item };
    this.abrirModal('divulgacion');
    setTimeout(() => {
      (document.getElementById('divulgacionTitulo') as HTMLInputElement).value = item.titulo || '';
      (document.getElementById('divulgacionTipo') as HTMLSelectElement).value = item.tipoDivulgacion || '';
      (document.getElementById('divulgacionMedio') as HTMLSelectElement).value = item.medioComunicacion || '';
      (document.getElementById('divulgacionDirigido') as HTMLSelectElement).value = item.dirigidoA || '';
      (document.getElementById('divulgacionFecha') as HTMLInputElement).value = item.fecha || '';
      (document.getElementById('divulgacionInstitucion') as HTMLInputElement).value = item.institucionOrganizadora || '';
    }, 50);
  }

  eliminarDivulgacion(id: number): void {
    Swal.fire({ title: '¿Eliminar actividad?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar' }).then((r) => {
      if (r.isConfirmed) {
        this.http.delete(`${environment.apiBaseUrl}/trayectoria/divulgacion/${id}`).subscribe({
          next: () => { Swal.fire('Eliminado', 'Actividad eliminada', 'success'); this.cargarDivulgaciones(); },
          error: () => Swal.fire('Error', 'No se pudo eliminar', 'error')
        });
      }
    });
  }

  renderizarDivulgaciones(): void {
    const list = document.getElementById('divulgacionList');
    const empty = document.getElementById('divulgacionEmpty');
    const count = document.getElementById('divulgacionCount');
    if (!list || !empty) return;
    if (count) count.textContent = this.divulgaciones.length.toString();
    list.innerHTML = '';
    if (this.divulgaciones.length === 0) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    this.divulgaciones.forEach(d => {
      const li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      li.innerHTML = `
        <div class="flex-grow-1">
          <div class="fw-bold mb-1"><i class="fas fa-bullhorn text-borgona me-2"></i>${this.escapeHtml(d.titulo || 'Sin título')}</div>
          <div class="d-flex flex-wrap gap-2 align-items-center">
            ${d.tipoDivulgacion ? `<span class="badge bg-borgona">${this.escapeHtml(d.tipoDivulgacion)}</span>` : ''}
            ${d.medioComunicacion ? `<span class="text-muted small"><i class="fas fa-tv me-1"></i>${this.escapeHtml(d.medioComunicacion)}</span>` : ''}
            ${d.fecha ? `<span class="badge bg-info"><i class="fas fa-calendar me-1"></i>${this.escapeHtml(d.fecha)}</span>` : ''}
          </div>
        </div>
        <div class="btn-group ms-2">
          <button class="btn btn-sm btn-outline-primary" onclick="window.trayectoriaComponent.editarDivulgacion(${d.id})" title="Editar"><i class="fas fa-edit"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="window.trayectoriaComponent.eliminarDivulgacion(${d.id})" title="Eliminar"><i class="fas fa-trash-alt"></i></button>
        </div>`;
      list.appendChild(li);
    });
  }
}

// Exponer el componente globalmente para los onclick
declare global {
  interface Window {
    trayectoriaComponent: TrayectoriaComponent;
  }
}


