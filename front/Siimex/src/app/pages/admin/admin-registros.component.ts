import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { jsPDF } from 'jspdf';
import { firstValueFrom, Subscription, timer, exhaustMap, takeWhile } from 'rxjs';
import { environment } from '../../../environments/environment';
import Swal, { sanitizeHtml } from '../../core/safe-swal';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';
import { AdminExpedientesService, ExportacionExpedientes, SolicitudExpedientes } from './admin-expedientes.service';

interface RegistroItem {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string | null;
  lastLoginAt?: string | null;
  curp?: string;
  rfc?: string;
  tipoPerfil?: string;
  telefono?: string;
  genero?: string;
  entidadFederativa?: string;
  municipio?: string;
  bloqueadoListaNegra?: boolean;
  fotoDocumentoId?: number | null;
  fotoUrl?: string | SafeResourceUrl | null;
  roles?: string[];
}

interface RegistrosPagina {
  content: RegistroItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  totalRegistros: number;
  entidades?: string[];
  municipios?: string[];
}

/** Detalle completo del usuario (respuesta de GET /admin/registros/:id) */
interface UsuarioDetalle {
  id: number;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  email?: string;
  username?: string;
  lastLoginAt?: string | null;
  visibilidadPerfil?: string;
  enabled?: boolean;
  locked?: boolean;
  roles?: string[];
  fotoDocumentoId?: number | null;
  curp?: string;
  rfc?: string;
  tipoPerfil?: string;
  telefono?: string;
  fechaNacimiento?: string;
  genero?: string;
  nacionalidad?: string;
  paisNacimiento?: string;
  entidadFederativa?: string;
  municipio?: string;
  bloqueadoListaNegra?: boolean;
  estadoCivil?: string;
  createdAt?: string;
  updatedAt?: string;
  semblanza?: string;
  institucion?: { nombre?: string; claveOficial?: string; tipoNombre?: string; paisNombre?: string; entidadNombre?: string; nivelUnoNombre?: string; nivelDosNombre?: string } | null;
  areaConocimiento?: { areaNombre?: string; areaClave?: string; campoNombre?: string; campoClave?: string; disciplinaNombre?: string; disciplinaClave?: string; subdisciplinaNombre?: string; subdisciplinaClave?: string } | null;
  interesHabilidad?: { interesDescripcion?: string; habilidadDescripcion?: string; habilidadNivel?: string } | null;
  perfilMigracion?: { migracionId?: string; cvu?: string; login?: string; correoAlterno?: string; nivelAcademico?: string; tituloTratamiento?: string; filtro?: string; institucionReceptora?: string; createdDate?: string; lastModifiedDate?: string } | null;
  curriculumDocumentoId?: number | null;
  ineDocumentoId?: number | null;
  domicilioDocumentoId?: number | null;
  cedulaDocumentoId?: number | null;
  evidencias?: {
    curriculum?: { nombre?: string | null } | null;
    ine?: { nombre?: string | null } | null;
    domicilio?: { nombre?: string | null } | null;
    cedula?: { nombre?: string | null } | null;
    cert1?: { nombre?: string | null } | null;
    cert2?: { nombre?: string | null } | null;
    divulgacion?: { nombre?: string | null } | null;
  } | null;
  evidenciasRubrosPersonalizadas?: Record<string, Array<{ nombre?: string }>>;
  trayectoriaAcademica?: { id: number; nivelNombre?: string; titulo?: string; estatusNombre?: string; cedulaProfesional?: string; opcionTitulacion?: string; tituloTesis?: string; fechaObtencion?: string; institucion?: string }[];
  trayectoriaProfesional?: { id: number; nombramiento?: string; fechaInicio?: string; fechaFin?: string; esActual?: boolean; logros?: string; institucion?: string }[];
  estancias?: { id: number; nombreProyecto?: string; tipoNombre?: string; logros?: string; fechaInicio?: string; fechaFin?: string; institucionReceptora?: string }[];
  congresos?: { id: number; nombreEvento?: string; tituloTrabajo?: string; tipoParticipacionNombre?: string; fecha?: string; paisSede?: string }[];
  divulgaciones?: { id: number; titulo?: string; tipoDivulgacionNombre?: string; medioNombre?: string; dirigidoA?: string; productoObtenidoNombre?: string; fecha?: string; institucionOrganizadora?: string }[];
  articulos?: { id: number; titulo?: string; tipo?: string; anio?: number; issn?: string; doi?: string; nombreRevista?: string; rolParticipacionNombre?: string; estadoNombre?: string; productoPrincipal?: boolean; autores?: { nombreCompleto?: string; orcid?: string; orden?: number }[] }[];
  cursos?: { id: number; nombre?: string; programa?: string; horasTotales?: number; fechaInicio?: string; fechaFin?: string; institucion?: string; nivelEscolaridad?: string }[];
  idiomas?: { id: number; nombre?: string; dominioNombre?: string; conversacion?: string; lectura?: string; escritura?: string; esCertificado?: boolean; certInstitucion?: string; certPuntuacion?: string; vigenciaFin?: string }[];
  logros?: { id: number; tipo?: string; nombre?: string; anio?: number }[];
  herramientas?: { id: number; nombre?: string }[];
  incidenciaSocial?: { id: number; titulo?: string; ubicacion?: string; descripcion?: string; fecha?: string; anio?: number }[];
  propiedadIntelectual?: { id: number; tipo?: string; titulo?: string; numeroRegistro?: string; institucionOficina?: string; pais?: string; fechaRegistro?: string; anio?: number; descripcion?: string }[];
}

interface ConvocatoriaAdminOption {
  id: number;
  titulo?: string;
  folioConvocatoria?: string | null;
  vigente?: boolean;
  fechaApertura?: string | null;
  fechaCierre?: string | null;
}

interface PostulacionEvaluadorOption {
  id: number;
  folio?: string | null;
  nombre?: string | null;
  correo?: string | null;
  estado?: string | null;
  evaluadorEmail?: string | null;
}

@Component({
  selector: 'app-admin-registros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-registros.component.html',
  styleUrls: ['./admin-registros.component.css']
})
export class AdminRegistrosComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private expedientes = inject(AdminExpedientesService);
  loading = true;
  error: string | null = null;
  registros: RegistroItem[] = [];
  usuarioSeleccionadoId: number | null = null;
  filtroTexto = '';
  filtroPerfil = '';
  filtroSexo = '';
  filtroEntidad = '';
  filtroMunicipio = '';
  paginaActual = 0;
  readonly registrosPorPagina = 10;
  totalFiltrados = 0;
  totalRegistros = 0;
  entidadesUnicas: string[] = [];
  municipiosUnicos: string[] = [];
  exportando = false;
  private opcionesCargadas = false;
  private cargaRegistros?: Subscription;
  private fotosRegistros: Subscription[] = [];
  private urlsFotos: string[] = [];
  private busquedaTimer?: ReturnType<typeof setTimeout>;
  private destruido = false;
  readonly usuariosZip = new Set<number>();
  zipEstado: ExportacionExpedientes | null = null;
  zipIniciando = false;
  zipCancelando = false;
  zipDescargando = false;
  zipError: string | null = null;
  zipAviso: string | null = null;
  zipPausado = false;
  private zipPolling?: Subscription;
  private zipSolicitud?: Subscription;
  private zipFrame?: HTMLIFrameElement;
  private readonly zipStorageKey = 'siimex_admin_exportacion';

  readonly GENEROS = [
    { value: 'MASCULINO', label: 'Masculino' },
    { value: 'FEMENINO', label: 'Femenino' },
    { value: 'OTRO', label: 'Otro' }
  ];
  modalVisible = false;
  modalNuevoVisible = false;
  detalleLoading = false;
  detalle: UsuarioDetalle | null = null;
  /** URL de la foto de perfil (blob) para mostrar en el modal */
  fotoUrl: string | null = null;
  accionEnProceso = false;
  cvGenerando = false;
  creando = false;
  creandoError: string | null = null;
  nuevoUsuario: {
    email: string;
    password: string;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    curp: string;
    rfc: string;
    fechaNacimiento: string;
    genero: string;
    nacionalidad: string;
    paisNacimiento: string;
    entidadFederativa: string;
    municipio: string;
    estadoCivil: string;
    tipoPerfil: string;
    telefono: string;
    rol: string;
  } = this.getNuevoUsuarioInicial();

  get registrosPaginados(): RegistroItem[] {
    return this.registros;
  }

  get totalPaginasRegistros(): number {
    return Math.max(1, Math.ceil(this.totalFiltrados / this.registrosPorPagina));
  }

  get registroInicioVisible(): number {
    if (this.totalFiltrados === 0) return 0;
    return this.paginaActual * this.registrosPorPagina + 1;
  }

  get registroFinVisible(): number {
    return Math.min((this.paginaActual + 1) * this.registrosPorPagina, this.totalFiltrados);
  }

  get paginasRegistros(): number[] {
    const total = this.totalPaginasRegistros;
    if (total <= 1) return [];
    const ventana = 5;
    let inicio = Math.max(0, this.paginaActual - Math.floor(ventana / 2));
    let fin = Math.min(total - 1, inicio + ventana - 1);
    inicio = Math.max(0, fin - ventana + 1);
    const paginas: number[] = [];
    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }
    return paginas;
  }
  get usuarioSeleccionado(): RegistroItem | null {
    if (this.usuarioSeleccionadoId == null) return null;
    return this.registros.find((r) => r.id === this.usuarioSeleccionadoId) || null;
  }

  get etiquetaEstadoSeleccionado(): string {
    if (!this.usuarioSeleccionado) return 'Suspender/Reactivar';
    if (this.detalle && this.detalle.id === this.usuarioSeleccionado.id) {
      return this.detalle.enabled ? 'Suspender' : 'Reactivar';
    }
    return 'Suspender/Reactivar';
  }

  tieneFiltrosActivos(): boolean {
    return !!(this.filtroTexto?.trim() || this.filtroPerfil || this.filtroSexo || this.filtroEntidad || this.filtroMunicipio);
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroPerfil = '';
    this.filtroSexo = '';
    this.filtroEntidad = '';
    this.filtroMunicipio = '';
    this.reiniciarPaginacion();
  }

  reiniciarPaginacion(conDemora = false): void {
    this.usuariosZip.clear();
    clearTimeout(this.busquedaTimer);
    this.cargaRegistros?.unsubscribe();
    this.liberarFotosRegistros();
    this.paginaActual = 0;
    this.usuarioSeleccionadoId = null;
    this.detalle = null;
    if (conDemora) {
      this.loading = true;
      this.busquedaTimer = setTimeout(() => this.cargarRegistros(), 350);
    } else {
      this.cargarRegistros();
    }
  }

  cambiarPagina(pagina: number): void {
    if (this.loading || pagina < 0 || pagina >= this.totalPaginasRegistros || pagina === this.paginaActual) return;
    this.paginaActual = pagina;
    this.usuarioSeleccionadoId = null;
    this.detalle = null;
    this.cargarRegistros();
  }

  paginaAnterior(): void {
    this.cambiarPagina(this.paginaActual - 1);
  }

  paginaSiguiente(): void {
    this.cambiarPagina(this.paginaActual + 1);
  }

  private getNuevoUsuarioInicial() {
    return {
      email: '',
      password: '',
      nombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      curp: '',
      rfc: '',
      fechaNacimiento: '',
      genero: '',
      nacionalidad: '',
      paisNacimiento: '',
      entidadFederativa: '',
      municipio: '',
      estadoCivil: 'SOLTERO',
      tipoPerfil: 'INVESTIGADOR',
      telefono: '',
      rol: 'ROLE_USER'
    };
  }

  ngOnInit(): void {
    this.cargarRegistros();
    try {
      const id = sessionStorage.getItem(this.zipStorageKey);
      if (id && /^[0-9a-f-]{36}$/i.test(id)) this.seguirExportacion(id);
    } catch { /* Session storage may be disabled by the browser. */ }
  }

  ngOnDestroy(): void {
    this.destruido = true;
    clearTimeout(this.busquedaTimer);
    this.cargaRegistros?.unsubscribe();
    this.liberarFotosRegistros();
    this.zipPolling?.unsubscribe();
    this.zipSolicitud?.unsubscribe();
    this.zipFrame?.remove();
    if (this.fotoUrl) URL.revokeObjectURL(this.fotoUrl);
  }

  abrirModalNuevo(): void {
    this.nuevoUsuario = this.getNuevoUsuarioInicial();
    this.creandoError = null;
    this.modalNuevoVisible = true;
  }

  cerrarModalNuevo(): void {
    this.modalNuevoVisible = false;
    this.creandoError = null;
  }

  crearUsuario(): void {
    if (this.creando) return;
    this.creandoError = null;
    this.creando = true;

    const payload: Record<string, unknown> = {
      email: this.nuevoUsuario.email.trim(),
      password: this.nuevoUsuario.password,
      nombre: this.nuevoUsuario.nombre.trim(),
      apellidoPaterno: this.nuevoUsuario.apellidoPaterno.trim(),
      apellidoMaterno: (this.nuevoUsuario.apellidoMaterno || '').trim(),
      curp: this.nuevoUsuario.curp.trim().toUpperCase(),
      fechaNacimiento: this.nuevoUsuario.fechaNacimiento,
      genero: this.nuevoUsuario.genero,
      estadoCivil: this.nuevoUsuario.estadoCivil || 'SOLTERO',
      tipoPerfil: this.nuevoUsuario.tipoPerfil || 'INVESTIGADOR',
      rol: this.nuevoUsuario.rol || 'ROLE_USER'
    };
    if (this.nuevoUsuario.rfc?.trim()) payload['rfc'] = this.nuevoUsuario.rfc.trim().toUpperCase();
    if (this.nuevoUsuario.nacionalidad?.trim()) payload['nacionalidad'] = this.nuevoUsuario.nacionalidad.trim();
    if (this.nuevoUsuario.paisNacimiento?.trim()) payload['paisNacimiento'] = this.nuevoUsuario.paisNacimiento.trim();
    if (this.nuevoUsuario.entidadFederativa?.trim()) payload['entidadFederativa'] = this.nuevoUsuario.entidadFederativa.trim();
    if (this.nuevoUsuario.municipio?.trim()) payload['municipio'] = this.nuevoUsuario.municipio.trim();
    if (this.nuevoUsuario.telefono?.trim()) payload['telefono'] = this.nuevoUsuario.telefono.trim();

    this.http.post<{ id: number; email: string; message: string }>(`${environment.apiBaseUrl}/admin/registros`, payload).subscribe({
      next: (res) => {
        this.creando = false;
        this.cerrarModalNuevo();
        this.opcionesCargadas = false;
        this.cargarRegistros();
        alert(`Usuario creado: ${res.email}`);
      },
      error: (err: { error?: { message?: string } }) => {
        this.creando = false;
        this.creandoError = err?.error?.message || 'Error al crear el usuario';
      }
    });
  }

  cargarRegistros(): void {
    clearTimeout(this.busquedaTimer);
    this.cargaRegistros?.unsubscribe();
    this.liberarFotosRegistros();
    this.loading = true;
    this.error = null;
    this.usuarioSeleccionadoId = null;
    this.detalle = null;
    const params = this.parametrosListado(this.paginaActual, this.registrosPorPagina)
      .set('incluirOpciones', !this.opcionesCargadas);
    this.cargaRegistros = this.http.get<RegistrosPagina>(`${environment.apiBaseUrl}/admin/registros/paginado`, { params }).subscribe({
      next: (data) => {
        this.registros = data.content;
        this.totalFiltrados = data.totalElements;
        this.totalRegistros = data.totalRegistros;
        this.paginaActual = data.page;
        if (data.entidades && data.municipios) {
          this.entidadesUnicas = data.entidades;
          this.municipiosUnicos = data.municipios;
          this.opcionesCargadas = true;
        }
        // A deletion in the last page can leave the requested page outside the new range.
        if (this.paginaActual >= this.totalPaginasRegistros && this.paginaActual > 0) {
          this.paginaActual = this.totalPaginasRegistros - 1;
          this.cargarRegistros();
          return;
        }
        this.loading = false;
        this.cargarFotosPaginaActual();
        this.cdr.markForCheck();
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'No se pudo cargar el listado';
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  private parametrosListado(page: number, size: number): HttpParams {
    return new HttpParams().set('page', page).set('size', size)
      .set('busqueda', this.filtroTexto.trim()).set('perfil', this.filtroPerfil)
      .set('sexo', this.filtroSexo).set('entidad', this.filtroEntidad).set('municipio', this.filtroMunicipio);
  }

  getNombreCompleto(r: RegistroItem | UsuarioDetalle): string {
    const parts = [r.nombre, r.apellidoPaterno, r.apellidoMaterno].filter(Boolean);
    return parts.join(' ') || '—';
  }

  /** Inicial para avatar cuando no hay foto. */
  getInicial(r: RegistroItem | UsuarioDetalle): string {
    const n = (r.nombre || '').trim();
    if (n) return n.charAt(0).toUpperCase();
    const a = (r.apellidoPaterno || '').trim();
    if (a) return a.charAt(0).toUpperCase();
    return '?';
  }

  getFotoUrlRegistro(r: RegistroItem): string | SafeResourceUrl {
    if (r.fotoUrl) return r.fotoUrl;
    return '';
  }

  private cargarFotosPaginaActual(): void {
    this.registrosPaginados
      .filter(r => r.fotoDocumentoId && !r.fotoUrl)
      .forEach(r => this.cargarFotoRegistro(r));
  }

  private liberarFotosRegistros(): void {
    this.fotosRegistros.forEach(s => s.unsubscribe());
    this.fotosRegistros = [];
    this.urlsFotos.forEach(url => URL.revokeObjectURL(url));
    this.urlsFotos = [];
  }

  trackRegistro(_index: number, registro: RegistroItem): number {
    return registro.id;
  }

  get zipActivo(): boolean {
    return this.zipIniciando || this.zipCancelando || this.zipEstado?.estado === 'EN_COLA' || this.zipEstado?.estado === 'PREPARANDO';
  }

  get paginaIncluidaEnZip(): boolean {
    return this.registros.length > 0 && this.registros.every(r => this.usuariosZip.has(r.id));
  }

  get paginaParcialEnZip(): boolean {
    return !this.paginaIncluidaEnZip && this.registros.some(r => this.usuariosZip.has(r.id));
  }

  incluirEnZip(id: number): void {
    if (this.usuariosZip.has(id)) this.usuariosZip.delete(id);
    else this.usuariosZip.add(id);
  }

  incluirPaginaEnZip(): void {
    const quitar = this.paginaIncluidaEnZip;
    this.registros.forEach(r => quitar ? this.usuariosZip.delete(r.id) : this.usuariosZip.add(r.id));
  }

  async prepararExpedientes(tipo: 'usuario' | 'seleccion' | 'filtrados'): Promise<void> {
    if (this.zipActivo || this.loading || this.zipDescargando) return;
    let solicitud: SolicitudExpedientes;
    let cantidad: number;
    if (tipo === 'usuario') {
      if (!this.usuarioSeleccionado) return;
      solicitud = { ids: [this.usuarioSeleccionado.id] };
      cantidad = 1;
    } else if (tipo === 'seleccion') {
      if (!this.usuariosZip.size) return;
      solicitud = { ids: Array.from(this.usuariosZip).sort((a, b) => a - b) };
      cantidad = this.usuariosZip.size;
    } else {
      if (!this.totalFiltrados) return;
      solicitud = { busqueda: this.filtroTexto.trim(), perfil: this.filtroPerfil, sexo: this.filtroSexo,
        entidad: this.filtroEntidad, municipio: this.filtroMunicipio };
      cantidad = this.totalFiltrados;
    }
    const confirmacion = await Swal.fire({
      title: `Preparar ${cantidad} expediente(s)`,
      text: 'El ZIP contendra informacion personal y documentos originales. Resguarda el archivo. Se incluiran todos los seleccionados, no solo esta pagina.' +
        (this.zipEstado?.estado === 'LISTO' ? ' El ZIP temporal anterior sera reemplazado.' : ''),
      icon: 'warning', showCancelButton: true, confirmButtonText: 'Preparar ZIP', cancelButtonText: 'Cancelar', confirmButtonColor: '#6a0032'
    });
    if (!confirmacion.isConfirmed || this.destruido || this.zipActivo) return;
    this.zipPolling?.unsubscribe();
    this.zipIniciando = true;
    this.zipEstado = null;
    this.zipPausado = false;
    this.olvidarExportacion();
    this.zipError = null;
    this.zipAviso = null;
    this.zipSolicitud = this.expedientes.iniciar(solicitud).subscribe({
      next: estado => {
        this.zipIniciando = false;
        this.zipEstado = estado;
        try { sessionStorage.setItem(this.zipStorageKey, estado.id); } catch { /* Optional resume support. */ }
        this.seguirExportacion(estado.id);
        this.cdr.markForCheck();
      },
      error: error => {
        this.zipIniciando = false;
        this.zipError = error?.error?.message || 'No se pudo iniciar la exportacion. Intenta nuevamente.';
        if (error?.status === 409) this.recuperarExportacionZip();
        this.cdr.markForCheck();
      }
    });
  }

  private recuperarExportacionZip(): void {
    this.zipSolicitud = this.expedientes.actual().subscribe({
      next: estado => {
        if (!estado) return;
        this.zipEstado = estado;
        try { sessionStorage.setItem(this.zipStorageKey, estado.id); } catch { /* Optional resume support. */ }
        this.seguirExportacion(estado.id);
        this.cdr.markForCheck();
      },
      error: () => { this.cdr.markForCheck(); }
    });
  }

  private seguirExportacion(id: string): void {
    this.zipPolling?.unsubscribe();
    this.zipPausado = false;
    this.zipError = null;
    this.zipPolling = timer(0, 1200).pipe(
      exhaustMap(() => this.expedientes.consultar(id)),
      takeWhile(estado => estado.estado === 'EN_COLA' || estado.estado === 'PREPARANDO', true)
    ).subscribe({
      next: estado => {
        this.zipEstado = estado;
        if (estado.estado === 'ERROR' || estado.estado === 'CANCELADO') this.olvidarExportacion();
        this.cdr.markForCheck();
      },
      error: error => {
        if ([401, 403, 404, 410].includes(error?.status)) {
          this.olvidarExportacion();
          this.zipEstado = null;
          this.zipError = 'La exportacion ya no esta disponible. Puedes generar un ZIP nuevo.';
        } else {
          this.zipPausado = true;
          this.zipError = 'Se interrumpio la consulta de progreso. La preparacion continua en el servidor.';
        }
        this.cdr.markForCheck();
      }
    });
  }

  reanudarProgresoZip(): void {
    if (this.zipEstado) this.seguirExportacion(this.zipEstado.id);
    else {
      try {
        const id = sessionStorage.getItem(this.zipStorageKey);
        if (id) this.seguirExportacion(id);
      } catch { /* No stored export. */ }
    }
  }

  cancelarExportacionZip(): void {
    if (!this.zipEstado || this.zipCancelando) return;
    this.zipCancelando = true;
    this.zipSolicitud = this.expedientes.cancelar(this.zipEstado.id).subscribe({
      next: estado => {
        this.zipPolling?.unsubscribe();
        this.zipEstado = estado;
        this.zipCancelando = false;
        this.zipPausado = false;
        this.zipError = null;
        this.olvidarExportacion();
        this.cdr.markForCheck();
      },
      error: error => {
        this.zipCancelando = false;
        this.zipError = error?.error?.message || 'No se pudo cancelar; intenta nuevamente.';
        this.cdr.markForCheck();
      }
    });
  }

  descargarExpedientesZip(): void {
    if (this.zipEstado?.estado !== 'LISTO' || this.zipDescargando) return;
    const estado = this.zipEstado;
    this.zipDescargando = true;
    this.zipError = null;
    this.zipSolicitud = this.expedientes.autorizarDescarga(estado.id).subscribe({
      next: () => {
        // Native download streams to the browser's download manager, not into a giant JavaScript Blob.
        if (!this.zipFrame) {
          this.zipFrame = document.createElement('iframe');
          this.zipFrame.name = 'siimex-descarga-expedientes';
          this.zipFrame.title = 'Descarga de expedientes';
          this.zipFrame.style.display = 'none';
          document.body.appendChild(this.zipFrame);
        }
        const link = document.createElement('a');
        link.href = this.expedientes.urlDescarga(estado.id);
        link.target = this.zipFrame.name;
        link.download = estado.nombreArchivo;
        document.body.appendChild(link);
        link.click();
        link.remove();
        this.zipDescargando = false;
        this.zipAviso = 'Descarga iniciada. Consulta el avance de transferencia en las descargas del navegador. El 100% indica que el ZIP esta preparado.';
        this.cdr.markForCheck();
      },
      error: error => {
        this.zipDescargando = false;
        this.zipError = error?.error?.message || 'No se pudo autorizar la descarga. Vuelve a intentarlo.';
        this.cdr.markForCheck();
      }
    });
  }

  private olvidarExportacion(): void {
    try { sessionStorage.removeItem(this.zipStorageKey); } catch { /* Optional resume support. */ }
  }

  getGeneroDisplay(genero: string | undefined): string {
    if (!genero) return '—';
    const m: Record<string, string> = { MASCULINO: 'Masculino', FEMENINO: 'Femenino', OTRO: 'Otro' };
    return m[genero] || genero;
  }

  private cargarFotoRegistro(r: RegistroItem): void {
    if (!r.fotoDocumentoId) return;
    this.fotosRegistros.push(this.http.get(`${environment.apiBaseUrl}/documentos/${r.fotoDocumentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        this.urlsFotos.push(url);
        r.fotoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.cdr.detectChanges();
      },
      error: () => { r.fotoUrl = null; this.cdr.detectChanges(); }
    }));
  }

  /** Formatea fecha ISO al formato legible (fecha y hora local). */
  formatearFecha(iso: string | null | undefined): string {
    if (!iso) return 'Nunca';
    try {
      const d = new Date(iso);
      return d.toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
    } catch {
      return iso;
    }
  }

  verDetalle(id: number): void {
    this.usuarioSeleccionadoId = id;
    this.detalle = null;
    this.fotoUrl = null;
    this.modalVisible = true;
    this.detalleLoading = true;
    this.http.get<UsuarioDetalle>(`${environment.apiBaseUrl}/admin/registros/${id}`).subscribe({
      next: (data) => {
        this.detalle = data;
        this.detalleLoading = false;
        if (data.fotoDocumentoId) {
          this.cargarFoto(data.fotoDocumentoId);
        }
      },
      error: () => {
        this.detalleLoading = false;
        this.cerrarModal();
      }
    });
  }

  private cargarFoto(documentoId: number): void {
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        if (this.fotoUrl) URL.revokeObjectURL(this.fotoUrl);
        this.fotoUrl = url;
      },
      error: () => {
        this.fotoUrl = null;
      }
    });
  }

  cerrarModal(): void {
    this.modalVisible = false;
    this.detalle = null;
    if (this.fotoUrl) {
      URL.revokeObjectURL(this.fotoUrl);
      this.fotoUrl = null;
    }
  }

  private get usuarioIdEnDetalle(): number | null {
    return this.detalle?.id ?? null;
  }

  seleccionarUsuario(r: RegistroItem): void {
    this.usuarioSeleccionadoId = r.id;
  }

  estaSeleccionado(r: RegistroItem): boolean {
    return this.usuarioSeleccionadoId === r.id;
  }

  verDetalleSeleccionado(): void {
    const seleccionado = this.usuarioSeleccionado;
    if (!seleccionado) {
      alert('Selecciona un usuario para ver su detalle.');
      return;
    }
    this.verDetalle(seleccionado.id);
  }

  async visualizarCvSeleccionado(): Promise<void> {
    if (!(await this.cargarDetalleSeleccionado())) return;
    await this.visualizarCvSiimex();
  }

  async descargarCvSeleccionado(): Promise<void> {
    if (!(await this.cargarDetalleSeleccionado())) return;
    await this.descargarCvSiimex();
  }

  async alternarEstadoSeleccionado(): Promise<void> {
    if (!(await this.cargarDetalleSeleccionado())) return;
    if (this.detalle?.enabled) {
      this.confirmarSuspender();
    } else {
      this.confirmarReactivar();
    }
  }

  async restablecerPasswordSeleccionado(): Promise<void> {
    if (!(await this.cargarDetalleSeleccionado())) return;
    this.confirmarRestablecerPassword();
  }

  async toggleAdminSeleccionado(): Promise<void> {
    if (!(await this.cargarDetalleSeleccionado())) return;
    this.toggleAdmin();
  }

  async toggleEvaluadorSeleccionado(): Promise<void> {
    if (!(await this.cargarDetalleSeleccionado())) return;
    this.toggleEvaluador();
  }

  async eliminarSeleccionado(): Promise<void> {
    if (!(await this.cargarDetalleSeleccionado())) return;
    this.confirmarEliminar();
  }

  private async cargarDetalleSeleccionado(): Promise<boolean> {
    const seleccionado = this.usuarioSeleccionado;
    if (!seleccionado) {
      alert('Selecciona un usuario para ejecutar la acción.');
      return false;
    }
    if (this.detalle && this.detalle.id === seleccionado.id) return true;
    try {
      this.detalle = await firstValueFrom(
        this.http.get<UsuarioDetalle>(`${environment.apiBaseUrl}/admin/registros/${seleccionado.id}`)
      );
      return true;
    } catch (err: any) {
      alert(err?.error?.message || 'No se pudo cargar el detalle del usuario seleccionado.');
      return false;
    }
  }

  confirmarSuspender(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null) return;
    if (!confirm('¿Suspender la cuenta de este usuario? No podrá iniciar sesión hasta que se reactive.')) return;
    this.accionEnProceso = true;
    this.http.patch<{ message: string }>(`${environment.apiBaseUrl}/admin/registros/${id}/suspender`, {}).subscribe({
      next: () => {
        this.accionEnProceso = false;
        if (this.detalle) this.detalle.enabled = false;
        if (this.detalle) this.detalle.locked = true;
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al suspender');
      }
    });
  }

  confirmarReactivar(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null) return;
    if (!confirm('¿Reactivar la cuenta de este usuario?')) return;
    this.accionEnProceso = true;
    this.http.patch<{ message: string }>(`${environment.apiBaseUrl}/admin/registros/${id}/reactivar`, {}).subscribe({
      next: () => {
        this.accionEnProceso = false;
        if (this.detalle) this.detalle.enabled = true;
        if (this.detalle) this.detalle.locked = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al reactivar');
      }
    });
  }

  confirmarRestablecerPassword(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null) return;
    const nuevaPassword = prompt('Nueva contraseña (dejar vacío para generar una temporal):');
    if (nuevaPassword === null) return; // canceló
    this.accionEnProceso = true;
    const body = nuevaPassword.trim() ? { nuevaPassword: nuevaPassword.trim() } : {};
    this.http.post<{ message: string; nuevaPassword?: string }>(`${environment.apiBaseUrl}/admin/registros/${id}/reset-password`, body).subscribe({
      next: (res) => {
        this.accionEnProceso = false;
        const msg = res.nuevaPassword ? `Contraseña actualizada. Contraseña temporal: ${res.nuevaPassword}` : res.message;
        alert(msg);
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al restablecer contraseña');
      }
    });
  }

  async visualizarCvSiimex(): Promise<void> {
    await this.generarCvSiimex('visualizar');
  }

  async descargarCvSiimex(): Promise<void> {
    await this.generarCvSiimex('descargar');
  }

  private async generarCvSiimex(modo: 'visualizar' | 'descargar'): Promise<void> {
    if (!this.detalle || this.cvGenerando) return;
    this.cvGenerando = true;

    try {
      const detalle = this.detalle;
      const normalizar = (v?: string | null): string => (v || '').replace(/\s+/g, ' ').trim();
      const nombreCompleto = this.getNombreCompleto(detalle);
      const tipoPerfil = this.obtenerEtiquetaTipoPerfil(detalle.tipoPerfil);
      const gradoAcademico = this.obtenerGradoAcademicoMasAltoAdmin(detalle);
      const subtitulo = [tipoPerfil, gradoAcademico].filter(Boolean).join(' · ') || 'Mi perfil único SIIMEX';

      const fotoBase64 = detalle.fotoDocumentoId ? await this.obtenerFotoBase64(detalle.fotoDocumentoId) : null;
      const fotoDim = fotoBase64 ? await this.getImageDimensions(fotoBase64) : null;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginX = 14;
      const marginBottom = 14;
      const contentW = pageW - marginX * 2;
      const borgona: [number, number, number] = [128, 0, 32];
      const tinta: [number, number, number] = [45, 45, 45];

      let y = 56;
      let pagina = 1;

      const wrap = (txt: string, maxW: number): string[] => doc.splitTextToSize(normalizar(txt), maxW);
      const formatoFecha = (fecha?: string | null): string => this.formatoFechaCorta(fecha);
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

        if (!isFinite(extraPorHueco) || extraPorHueco <= 0.04) {
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

      const dibujarFooter = (): void => {
        doc.setDrawColor(230, 230, 235);
        doc.line(marginX, pageH - 11, pageW - marginX, pageH - 11);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 130);
        doc.text('SIIMEX · CV generado desde panel admin', marginX, pageH - 7.5);
        doc.text(`Página ${pagina}`, pageW - marginX, pageH - 7.5, { align: 'right' });
      };

      const asegurarEspacio = (alto = 8): void => {
        if (y + alto <= pageH - marginBottom) return;
        dibujarFooter();
        doc.addPage();
        pagina += 1;
        doc.setFillColor(...borgona);
        doc.rect(0, 0, pageW, 14, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(nombreCompleto, marginX, 9.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text('CV SIIMEX', pageW - marginX, 9.5, { align: 'right' });
        y = 22;
      };

      const pintarTitulo = (titulo: string): void => {
        asegurarEspacio(11);
        doc.setFillColor(247, 236, 241);
        doc.roundedRect(marginX, y - 3.5, contentW, 8, 1.5, 1.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...borgona);
        doc.text(titulo, marginX + 2.5, y + 1.5);
        y += 8;
      };

      const pintarLista = (items: string[]): void => {
        items.map(normalizar).filter(Boolean).forEach((item) => {
          const lineas = wrap(item, contentW - 10);
          lineas.forEach((linea, idx) => {
            asegurarEspacio(5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.3);
            doc.setTextColor(...tinta);
            if (idx === 0) doc.text('•', marginX + 1.5, y);
            dibujarLineaJustificada(linea, marginX + 5.5, y, contentW - 10);
            y += 4.7;
          });
          y += 0.6;
        });
      };

      const pintarParrafo = (texto: string): void => {
        const lineas = wrap(texto, contentW - 2);
        lineas.forEach((linea) => {
          asegurarEspacio(5);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9.5);
          doc.setTextColor(...tinta);
          dibujarLineaJustificada(linea, marginX + 1, y, contentW - 2);
          y += 4.8;
        });
        y += 1.2;
      };

      // Encabezado principal
      doc.setFillColor(...borgona);
      doc.rect(0, 0, pageW, 44, 'F');
      doc.setFillColor(95, 0, 24);
      doc.rect(0, 40, pageW, 4, 'F');

      const fotoBoxX = marginX;
      const fotoBoxY = 8;
      const fotoBoxW = 30;
      const fotoBoxH = 30;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(fotoBoxX, fotoBoxY, fotoBoxW, fotoBoxH, 3, 3, 'F');
      if (fotoBase64) {
        const pad = 1.2;
        const innerW = fotoBoxW - pad * 2;
        const innerH = fotoBoxH - pad * 2;
        let drawW = innerW;
        let drawH = innerH;
        let drawX = fotoBoxX + pad;
        let drawY = fotoBoxY + pad;
        if (fotoDim) {
          const ratio = fotoDim.width / fotoDim.height;
          if (ratio >= 1) {
            drawW = innerW;
            drawH = innerW / ratio;
            drawY += (innerH - drawH) / 2;
          } else {
            drawH = innerH;
            drawW = innerH * ratio;
            drawX += (innerW - drawW) / 2;
          }
        }
        try {
          doc.addImage(fotoBase64, 'JPEG', drawX, drawY, drawW, drawH);
        } catch {
          try {
            doc.addImage(fotoBase64, 'PNG', drawX, drawY, drawW, drawH);
          } catch {
            doc.setFillColor(230, 230, 230);
            doc.roundedRect(fotoBoxX + 1.5, fotoBoxY + 1.5, fotoBoxW - 3, fotoBoxH - 3, 2, 2, 'F');
          }
        }
      } else {
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(fotoBoxX + 1.5, fotoBoxY + 1.5, fotoBoxW - 3, fotoBoxH - 3, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('SIN FOTO', fotoBoxX + fotoBoxW / 2, fotoBoxY + fotoBoxH / 2 + 1, { align: 'center' });
      }

      const textX = fotoBoxX + fotoBoxW + 7;
      const textW = pageW - textX - marginX;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      wrap(nombreCompleto, textW).slice(0, 2).forEach((linea, idx) => doc.text(linea, textX, 16 + idx * 6));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(subtitulo, textX, 29);
      doc.setFontSize(8.4);
      const contacto = [detalle.email ? `Correo: ${detalle.email}` : '', detalle.telefono ? `Tel: ${detalle.telefono}` : '']
        .filter(Boolean)
        .join('  |  ') || 'Contacto no disponible';
      wrap(contacto, textW).slice(0, 2).forEach((linea, idx) => doc.text(linea, textX, 35 + idx * 4));

      // Secciones CV
      if (normalizar(detalle.semblanza)) {
        pintarTitulo('Semblanza');
        pintarParrafo(detalle.semblanza || '');
      }

      const institucion = detalle.institucion
        ? [detalle.institucion.nombre, detalle.institucion.tipoNombre, detalle.institucion.entidadNombre, detalle.institucion.paisNombre]
            .filter(Boolean)
            .join(' · ')
        : '';
      if (institucion) {
        pintarTitulo('Institución');
        pintarLista([institucion]);
      }

      const area = detalle.areaConocimiento
        ? [detalle.areaConocimiento.areaNombre, detalle.areaConocimiento.campoNombre, detalle.areaConocimiento.disciplinaNombre, detalle.areaConocimiento.subdisciplinaNombre]
            .filter(Boolean)
            .join(' · ')
        : '';
      if (area) {
        pintarTitulo('Área de conocimiento');
        pintarLista([area]);
      }

      if (detalle.trayectoriaAcademica?.length) {
        pintarTitulo('Formación académica');
        pintarLista(detalle.trayectoriaAcademica.map((t) =>
          `${t.nivelNombre ? `[${t.nivelNombre}] ` : ''}${t.titulo || ''}${t.institucion ? ` - ${t.institucion}` : ''}${t.fechaObtencion ? ` (${formatoFecha(t.fechaObtencion)})` : ''}`
        ));
      }

      if (detalle.trayectoriaProfesional?.length) {
        pintarTitulo('Experiencia profesional');
        pintarLista(detalle.trayectoriaProfesional.map((t) => {
          const ini = formatoFecha(t.fechaInicio);
          const fin = t.esActual ? 'Actual' : formatoFecha(t.fechaFin);
          const rango = ini || fin ? ` (${[ini, fin].filter(Boolean).join(' - ')})` : '';
          return `${t.nombramiento || ''}${t.institucion ? ` - ${t.institucion}` : ''}${rango}`;
        }));
      }

      if (detalle.cursos?.length) {
        pintarTitulo('Cursos impartidos');
        pintarLista(detalle.cursos.map((c) =>
          `${c.nombre || ''}${c.programa ? ` - ${c.programa}` : ''}${c.horasTotales ? ` (${c.horasTotales} h)` : ''}${c.institucion ? ` - ${c.institucion}` : ''}`
        ));
      }

      if (detalle.idiomas?.length) {
        pintarTitulo('Idiomas');
        pintarLista(detalle.idiomas.map((i) => `${i.nombre || ''}${i.dominioNombre ? ` - ${i.dominioNombre}` : ''}`));
      }

      if (detalle.logros?.length) {
        pintarTitulo('Logros y reconocimientos');
        pintarLista(detalle.logros.map((l) => `${l.nombre || ''}${l.anio ? ` (${l.anio})` : ''}`));
      }

      if (detalle.articulos?.length) {
        pintarTitulo('Artículos y aportaciones');
        pintarLista(detalle.articulos.map((a) =>
          `${a.titulo || ''}${a.nombreRevista ? ` - ${a.nombreRevista}` : ''}${a.anio ? ` (${a.anio})` : ''}`
        ));
      }

      if (detalle.estancias?.length) {
        pintarTitulo('Estancias de investigación');
        pintarLista(detalle.estancias.map((e) =>
          `${e.tipoNombre ? `[${e.tipoNombre}] ` : ''}${e.nombreProyecto || ''}${e.institucionReceptora ? ` - ${e.institucionReceptora}` : ''}`
        ));
      }

      if (detalle.congresos?.length) {
        pintarTitulo('Congresos y eventos');
        pintarLista(detalle.congresos.map((c) =>
          `${c.nombreEvento || ''}${c.tipoParticipacionNombre ? ` (${c.tipoParticipacionNombre})` : ''}${c.fecha ? ` - ${formatoFecha(c.fecha)}` : ''}`
        ));
      }

      if (detalle.divulgaciones?.length) {
        pintarTitulo('Divulgación científica');
        pintarLista(detalle.divulgaciones.map((d) =>
          `${d.titulo || ''}${d.tipoDivulgacionNombre ? ` [${d.tipoDivulgacionNombre}]` : ''}${d.fecha ? ` - ${formatoFecha(d.fecha)}` : ''}`
        ));
      }

      if (detalle.propiedadIntelectual?.length) {
        pintarTitulo('Propiedad intelectual');
        pintarLista(detalle.propiedadIntelectual.map((p) =>
          `${p.tipo ? `[${p.tipo}] ` : ''}${p.titulo || ''}${p.numeroRegistro ? ` - ${p.numeroRegistro}` : ''}${p.anio ? ` (${p.anio})` : ''}`
        ));
      }

      if (detalle.incidenciaSocial?.length) {
        pintarTitulo('Incidencia social');
        pintarLista(detalle.incidenciaSocial.map((i) =>
          `${i.titulo || ''}${i.ubicacion ? ` - ${i.ubicacion}` : ''}${i.fecha ? ` (${formatoFecha(i.fecha)})` : ''}`
        ));
      }

      dibujarFooter();

      const nombreArchivo = `cv-siimex-${detalle.id}.pdf`;
      if (modo === 'descargar') {
        doc.save(nombreArchivo);
      } else {
        const blob = doc.output('blob');
        this.abrirPdfEnPestana(blob, nombreArchivo, () => doc.save(nombreArchivo));
      }
    } catch (e) {
      alert(modo === 'descargar'
        ? 'No se pudo descargar el CV SIIMEX del usuario.'
        : 'No se pudo visualizar el CV SIIMEX del usuario.');
    } finally {
      this.cvGenerando = false;
    }
  }

  private obtenerEtiquetaTipoPerfil(tipoPerfil?: string): string {
    const tipo = (tipoPerfil || '').toUpperCase();
    if (tipo === 'INNOVADOR') return 'Personas innovadoras';
    if (tipo === 'HIBRIDO') return 'Personas investigadoras e innovadoras';
    return 'Personas investigadoras';
  }

  private obtenerGradoAcademicoMasAltoAdmin(detalle: UsuarioDetalle): string {
    const items = detalle.trayectoriaAcademica || [];
    if (!items.length) return '';
    return [...items]
      .sort((a, b) => this.prioridadGradoAdmin(b.nivelNombre) - this.prioridadGradoAdmin(a.nivelNombre))
      .map(i => i.nivelNombre || '')
      .find(Boolean) || '';
  }

  private prioridadGradoAdmin(nivel?: string): number {
    const n = (nivel || '').toLowerCase();
    if (n.includes('doctorado') || n.includes('phd') || n.includes('doctor')) return 500;
    if (n.includes('maestr')) return 400;
    if (n.includes('especialidad')) return 300;
    if (n.includes('licenciatura') || n.includes('ingenier') || n.includes('arquitect')) return 200;
    if (n.includes('tsu') || n.includes('técnico superior') || n.includes('tecnico superior') || n.includes('tecnico')) return 100;
    return 10;
  }

  private formatoFechaCorta(fecha?: string | null): string {
    if (!fecha) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const [anio, mes, dia] = fecha.split('-');
      return `${dia}/${mes}/${anio}`;
    }
    return fecha;
  }


  private abrirPdfEnPestana(blob: Blob, nombreArchivo: string, fallback?: () => void): void {
    const win = window.open('', '_blank');
    if (!win) {
      fallback?.();
      return;
    }

    const pdfBlob = blob.type?.toLowerCase().includes('pdf') ? blob : new Blob([blob], { type: 'application/pdf' });
    const url = URL.createObjectURL(pdfBlob);
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
    download.download = nombreArchivo || 'documento.pdf';
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
    setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  private async obtenerFotoBase64(documentoId: number): Promise<string | null> {
    try {
      const blob = await firstValueFrom(
        this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' })
      );
      return await this.blobToBase64(blob);
    } catch {
      return null;
    }
  }

  private blobToBase64(blob: Blob): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
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

  /** Exportar reporte de registros a Excel. */
  async exportarExcel(): Promise<void> {
    if (this.exportando) return;
    this.exportando = true;
    try {
      const items = await this.cargarRegistrosParaExportar();
      const headers = ['ID', 'Nombre', 'Email', 'Perfil', 'Sexo', 'Entidad federativa', 'Municipio', 'CURP', 'RFC', 'Teléfono', 'Último acceso'];
      const rows = items.map(r => [
        r.id,
        this.getNombreCompleto(r),
        r.email || '',
        r.tipoPerfil || '',
        this.getGeneroDisplay(r.genero),
        r.entidadFederativa || '',
        r.municipio || '',
        r.curp || '',
        r.rfc || '',
        r.telefono || '',
        this.formatearFecha(r.lastLoginAt)
      ]);
      await exportRowsAsXlsx(headers, rows, `reporte_registros_${this.timestamp()}.xlsx`, 'Registros');
    } catch {
      alert('No se pudo completar la exportacion. Intenta nuevamente.');
    } finally {
      this.exportando = false;
      this.cdr.markForCheck();
    }
  }

  /** Exportar reporte para imprimir / guardar como PDF. */
  async exportarPdf(): Promise<void> {
    if (this.exportando) return;
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;
    this.exportando = true;
    try {
      const items = await this.cargarRegistrosParaExportar();
      const rows = items.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${this.html(this.getNombreCompleto(r))}</td>
        <td>${this.html(r.email || '')}</td>
        <td>${this.html(r.tipoPerfil || '')}</td>
        <td>${this.html(this.getGeneroDisplay(r.genero))}</td>
        <td>${this.html(r.entidadFederativa || '')}</td>
        <td>${this.html(r.municipio || '')}</td>
        <td>${this.html(r.curp || '')}</td>
        <td>${this.html(r.telefono || '')}</td>
        <td>${this.html(this.formatearFecha(r.lastLoginAt))}</td>
      </tr>
    `).join('');

      const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"/><title>Reporte de Registros</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;margin:24px;color:#1a1a1a}
h1{margin:0 0 8px;color:#6a0032}
.meta{margin:0 0 16px;color:#555;font-size:13px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #e5e7eb;padding:8px 10px;text-align:left}
th{background:#f8fafc;font-weight:600}</style>
</head>
<body>
<h1>Reporte de Registros de Usuarios</h1>
<p class="meta">Generado: ${new Date().toLocaleString('es-MX')} | Total: ${items.length} registro(s)</p>
<table>
<thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Perfil</th><th>Sexo</th><th>Entidad</th><th>Municipio</th><th>CURP</th><th>Teléfono</th><th>Último acceso</th></tr></thead>
<tbody>${rows || '<tr><td colspan="10">Sin datos</td></tr>'}
</tbody>
</table>
</body>
</html>`;

      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 300);
    } catch {
      win.close();
      alert('No se pudo completar la exportacion. Intenta nuevamente.');
    } finally {
      this.exportando = false;
      this.cdr.markForCheck();
    }
  }

  private async cargarRegistrosParaExportar(): Promise<RegistroItem[]> {
    // Capture filters once; exporting must not fall back to the expensive legacy endpoint.
    const params = this.parametrosListado(0, 100);
    const items: RegistroItem[] = [];
    let page = 0;
    let totalPages = 1;
    while (page < totalPages) {
      if (this.destruido) throw new Error('Vista cerrada');
      const data = await firstValueFrom(this.http.get<RegistrosPagina>(
        `${environment.apiBaseUrl}/admin/registros/paginado`, { params: params.set('page', page) }));
      items.push(...data.content);
      totalPages = data.totalPages;
      page++;
    }
    return items;
  }

  private html(v: string): string {
    return (v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private timestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  }

  esAdmin(r: RegistroItem | UsuarioDetalle): boolean {
    const roles = (r as any).roles;
    if (!roles) return false;
    if (Array.isArray(roles)) return roles.includes('ROLE_ADMIN');
    if (roles instanceof Set) return (roles as Set<string>).has('ROLE_ADMIN');
    return false;
  }

  esEvaluador(r: RegistroItem | UsuarioDetalle): boolean {
    const roles = (r as any).roles;
    if (!roles) return false;
    if (Array.isArray(roles)) return roles.includes('ROLE_EVALUADOR');
    if (roles instanceof Set) return (roles as Set<string>).has('ROLE_EVALUADOR');
    return false;
  }

  rubrosConEvidencias(detalle: UsuarioDetalle | null): string[] {
    const rubros = detalle?.evidenciasRubrosPersonalizadas;
    if (!rubros) return [];
    return Object.keys(rubros).filter(key => Array.isArray(rubros[key]) && rubros[key].length > 0);
  }

  etiquetaRubro(rubro: string): string {
    const etiquetas: Record<string, string> = {
      institucion: 'Institución',
      areaConocimiento: 'Área de conocimiento',
      certs: 'Certificaciones',
      cursos: 'Cursos',
      herramientas: 'Herramientas',
      idiomas: 'Idiomas',
      logros: 'Logros',
      articulos: 'Artículos',
      pi: 'Propiedad intelectual',
      incidencia: 'Incidencia social',
      trayAcademica: 'Trayectoria académica',
      trayProfesional: 'Trayectoria profesional',
      estancias: 'Estancias',
      congresos: 'Congresos',
      divulgacion: 'Divulgación'
    };
    return etiquetas[rubro] || rubro;
  }

  toggleAdmin(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null || !this.detalle) return;
    const esAdminActual = this.esAdmin(this.detalle);
    const msg = esAdminActual
      ? '¿Revocar rol de administrador a este usuario?'
      : '¿Otorgar rol de administrador a este usuario?';
    if (!confirm(msg)) return;
    this.accionEnProceso = true;
    this.http.patch<{ status: string; roles: string[] }>(`${environment.apiBaseUrl}/admin/registros/${id}/toggle-admin`, { admin: !esAdminActual }).subscribe({
      next: (res) => {
        this.accionEnProceso = false;
        if (this.detalle) this.detalle.roles = res.roles;
        const reg = this.registros.find(r => r.id === id);
        if (reg) reg.roles = res.roles;
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al cambiar rol');
      }
    });
  }

  toggleEvaluador(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null || !this.detalle) return;
    const esEvaluadorActual = this.esEvaluador(this.detalle);
    if (!esEvaluadorActual) {
      void this.iniciarFlujoAsignarEvaluador();
      return;
    }
    if (!confirm('¿Revocar rol de evaluador a este usuario?')) return;
    this.accionEnProceso = true;
    this.http.patch<{ status: string; roles: string[] }>(`${environment.apiBaseUrl}/admin/registros/${id}/toggle-evaluador`, { evaluador: false }).subscribe({
      next: (res) => {
        this.accionEnProceso = false;
        if (this.detalle) this.detalle.roles = res.roles;
        const reg = this.registros.find(r => r.id === id);
        if (reg) reg.roles = res.roles;
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al cambiar rol');
      }
    });
  }

  private async iniciarFlujoAsignarEvaluador(): Promise<void> {
    const id = this.usuarioIdEnDetalle;
    if (id == null || !this.detalle) return;

    const emailEvaluador = this.normalizarEmail(this.detalle.email);
    if (!emailEvaluador) {
      await Swal.fire({
        icon: 'warning',
        title: 'Sin correo',
        text: 'El usuario no tiene correo configurado. No se puede asignar como evaluador.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    this.accionEnProceso = true;
    try {
      const convocatorias = await firstValueFrom(
        this.http.get<ConvocatoriaAdminOption[]>(`${environment.apiBaseUrl}/admin/convocatorias`)
      );
      const convocatoriasOrdenadas = (convocatorias || [])
        .slice()
        .sort((a, b) => (b.id || 0) - (a.id || 0));

      if (!convocatoriasOrdenadas.length) {
        await Swal.fire({
          icon: 'warning',
          title: 'Sin convocatorias',
          text: 'No hay convocatorias disponibles para asignar evaluación.',
          confirmButtonColor: '#800020'
        });
        return;
      }

      const convocatoria = await this.seleccionarConvocatoria(convocatoriasOrdenadas);
      if (!convocatoria) return;

      const postulaciones = await firstValueFrom(
        this.http.get<PostulacionEvaluadorOption[]>(
          `${environment.apiBaseUrl}/admin/convocatorias/${convocatoria.id}/postulaciones`
        )
      );
      const opcionesPostulantes = (postulaciones || [])
        .filter((p) => this.normalizarEmail(p.correo) !== emailEvaluador)
        .sort((a, b) => this.etiquetaPostulacion(a).localeCompare(this.etiquetaPostulacion(b), 'es', { sensitivity: 'base' }));

      if (!opcionesPostulantes.length) {
        await Swal.fire({
          icon: 'warning',
          title: 'Sin postulantes elegibles',
          html: 'No hay postulantes disponibles en esta convocatoria para asignar a este evaluador.<br><small class="text-muted">No se muestra al propio usuario si participa como postulante.</small>',
          confirmButtonColor: '#800020'
        });
        return;
      }

      const postulacion = await this.seleccionarPostulacion(convocatoria, opcionesPostulantes);
      if (!postulacion) return;

      const confirmacion = await Swal.fire({
        icon: 'question',
        title: 'Confirmar asignación',
        html: `
          <div class="text-start">
            <p class="mb-1"><strong>Evaluador:</strong> ${this.html(this.getNombreCompleto(this.detalle) || emailEvaluador)}</p>
            <p class="mb-1"><strong>Correo:</strong> ${this.html(emailEvaluador)}</p>
            <p class="mb-1"><strong>Convocatoria:</strong> ${this.html(this.etiquetaConvocatoria(convocatoria))}</p>
            <p class="mb-0"><strong>Postulante:</strong> ${this.html(this.etiquetaPostulacion(postulacion))}</p>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Asignar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#7A1E48'
      });
      if (!confirmacion.isConfirmed) return;

      await firstValueFrom(
        this.http.post(
          `${environment.apiBaseUrl}/admin/convocatorias/${convocatoria.id}/postulaciones/${postulacion.id}/asignar-evaluador`,
          { email: emailEvaluador }
        )
      );

      const rolesActuales = Array.isArray(this.detalle.roles) ? this.detalle.roles : [];
      if (!rolesActuales.includes('ROLE_EVALUADOR')) {
        this.detalle.roles = [...rolesActuales, 'ROLE_EVALUADOR'];
      }
      const reg = this.registros.find(r => r.id === id);
      if (reg) {
        const rolesRegistro = Array.isArray(reg.roles) ? reg.roles : [];
        if (!rolesRegistro.includes('ROLE_EVALUADOR')) {
          reg.roles = [...rolesRegistro, 'ROLE_EVALUADOR'];
        }
      }

      await Swal.fire({
        icon: 'success',
        title: 'Evaluador asignado',
        text: 'La persona evaluadora quedó asignada al postulante seleccionado.',
        confirmButtonColor: '#800020'
      });
    } catch (err: any) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.error?.message || 'No se pudo completar la asignación.',
        confirmButtonColor: '#800020'
      });
    } finally {
      this.accionEnProceso = false;
    }
  }

  private async seleccionarConvocatoria(convocatorias: ConvocatoriaAdminOption[]): Promise<ConvocatoriaAdminOption | null> {
    const optionEntries = convocatorias.map((c) => ({ id: c.id, label: this.etiquetaConvocatoria(c) }));
    const renderOptionTags = (query: string): string => {
      const q = this.normalizarBusqueda(query);
      const filtered = optionEntries.filter((item) => this.normalizarBusqueda(item.label).includes(q));
      if (!filtered.length) {
        return '<option value="" disabled selected>Sin coincidencias</option>';
      }
      return filtered
        .map((item, idx) => `<option value="${item.id}"${idx === 0 ? ' selected' : ''}>${this.html(item.label)}</option>`)
        .join('');
    };

    const res = await Swal.fire({
      title: 'Selecciona convocatoria',
      html: `
        <div class="text-start">
          <label for="swal-convocatoria-search" class="form-label small fw-semibold mb-1">Buscar convocatoria</label>
          <input id="swal-convocatoria-search" class="swal2-input mt-0 mb-2" placeholder="Filtra por título o folio" autocomplete="off">
          <label for="swal-convocatoria-select" class="form-label small fw-semibold mb-1">Convocatoria</label>
          <select id="swal-convocatoria-select" class="swal2-select mt-0" size="8" style="display:block;width:100%;height:auto;max-height:18rem;">
            ${renderOptionTags('')}
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#7A1E48',
      didOpen: () => {
        const searchInput = document.getElementById('swal-convocatoria-search') as HTMLInputElement | null;
        const selectEl = document.getElementById('swal-convocatoria-select') as HTMLSelectElement | null;
        if (!searchInput || !selectEl) return;
        searchInput.focus();
        searchInput.addEventListener('input', () => {
          const prevSelected = selectEl.value;
          selectEl.innerHTML = sanitizeHtml(renderOptionTags(searchInput.value));
          if (prevSelected && Array.from(selectEl.options).some(opt => opt.value === prevSelected)) {
            selectEl.value = prevSelected;
          }
        });
      },
      preConfirm: () => {
        const selectEl = document.getElementById('swal-convocatoria-select') as HTMLSelectElement | null;
        const selected = Number((selectEl?.value || '').trim());
        if (!selected) {
          Swal.showValidationMessage('Debes seleccionar una convocatoria');
          return false;
        }
        return selected;
      }
    });

    if (!res.isConfirmed || !res.value) return null;
    return convocatorias.find((c) => c.id === Number(res.value)) || null;
  }

  private async seleccionarPostulacion(
    convocatoria: ConvocatoriaAdminOption,
    postulaciones: PostulacionEvaluadorOption[]
  ): Promise<PostulacionEvaluadorOption | null> {
    const optionEntries = postulaciones.map((p) => ({ id: p.id, label: this.etiquetaPostulacion(p) }));
    const renderOptionTags = (query: string): string => {
      const q = this.normalizarBusqueda(query);
      const filtered = optionEntries.filter((item) => this.normalizarBusqueda(item.label).includes(q));
      if (!filtered.length) {
        return '<option value="" disabled selected>Sin coincidencias</option>';
      }
      return filtered
        .map((item, idx) => `<option value="${item.id}"${idx === 0 ? ' selected' : ''}>${this.html(item.label)}</option>`)
        .join('');
    };

    const res = await Swal.fire({
      title: 'Selecciona postulante',
      html: `
        <p class="small text-muted text-start mb-2"><strong>Convocatoria:</strong> ${this.html(this.etiquetaConvocatoria(convocatoria))}</p>
        <div class="text-start">
          <label for="swal-postulante-search" class="form-label small fw-semibold mb-1">Buscar postulante</label>
          <input id="swal-postulante-search" class="swal2-input mt-0 mb-2" placeholder="Filtra por folio, nombre o correo" autocomplete="off">
          <label for="swal-postulante-select" class="form-label small fw-semibold mb-1">Postulante</label>
          <select id="swal-postulante-select" class="swal2-select mt-0" size="8" style="display:block;width:100%;height:auto;max-height:18rem;">
            ${renderOptionTags('')}
          </select>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#7A1E48',
      didOpen: () => {
        const searchInput = document.getElementById('swal-postulante-search') as HTMLInputElement | null;
        const selectEl = document.getElementById('swal-postulante-select') as HTMLSelectElement | null;
        if (!searchInput || !selectEl) return;
        searchInput.focus();
        searchInput.addEventListener('input', () => {
          const prevSelected = selectEl.value;
          selectEl.innerHTML = sanitizeHtml(renderOptionTags(searchInput.value));
          if (prevSelected && Array.from(selectEl.options).some(opt => opt.value === prevSelected)) {
            selectEl.value = prevSelected;
          }
        });
      },
      preConfirm: () => {
        const selectEl = document.getElementById('swal-postulante-select') as HTMLSelectElement | null;
        const selected = Number((selectEl?.value || '').trim());
        if (!selected) {
          Swal.showValidationMessage('Debes seleccionar un postulante');
          return false;
        }
        return selected;
      }
    });

    if (!res.isConfirmed || !res.value) return null;
    return postulaciones.find((p) => p.id === Number(res.value)) || null;
  }

  private etiquetaConvocatoria(c: ConvocatoriaAdminOption): string {
    const titulo = (c.titulo || 'Convocatoria sin título').trim();
    const folio = (c.folioConvocatoria || '').trim();
    const estatus = c.vigente ? 'Vigente' : 'No vigente';
    return `${folio ? `[${folio}] ` : ''}${titulo} (${estatus})`;
  }

  private etiquetaPostulacion(p: PostulacionEvaluadorOption): string {
    const folio = (p.folio || `SOL-${p.id}`).trim();
    const nombre = (p.nombre || 'Sin nombre').trim();
    const correo = this.normalizarEmail(p.correo) || 'sin-correo';
    const estado = (p.estado || 'PENDIENTE').trim();
    return `${folio} | ${nombre} | ${correo} | ${estado}`;
  }

  private normalizarEmail(value: string | null | undefined): string {
    return (value || '').trim().toLowerCase();
  }

  private normalizarBusqueda(value: string | null | undefined): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  confirmarEliminar(): void {
    const id = this.usuarioIdEnDetalle;
    if (id == null) return;
    if (!confirm('¿Eliminar permanentemente este usuario y todos sus datos? Esta acción no se puede deshacer.')) return;
    this.accionEnProceso = true;
    this.http.delete(`${environment.apiBaseUrl}/admin/registros/${id}`).subscribe({
      next: () => {
        this.accionEnProceso = false;
        this.cerrarModal();
        this.usuariosZip.delete(id);
        this.opcionesCargadas = false;
        this.cargarRegistros();
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al eliminar');
      }
    });
  }
}
