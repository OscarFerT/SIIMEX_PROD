import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { jsPDF } from 'jspdf';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';

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
export class AdminRegistrosComponent implements OnInit {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  loading = true;
  error: string | null = null;
  registros: RegistroItem[] = [];
  usuarioSeleccionadoId: number | null = null;
  filtroTexto = '';
  filtroPerfil = '';
  filtroSexo = '';
  filtroEntidad = '';
  filtroMunicipio = '';

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

  /** Entidades federativas únicas de los registros (para el dropdown). */
  get entidadesUnicas(): string[] {
    const set = new Set<string>();
    this.registros.forEach(r => {
      const e = (r.entidadFederativa || '').trim();
      if (e) set.add(e);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /** Municipios únicos de los registros (para el dropdown). */
  get municipiosUnicos(): string[] {
    const set = new Set<string>();
    this.registros.forEach(r => {
      const m = (r.municipio || '').trim();
      if (m) set.add(m);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /** Lista de registros filtrada por todos los criterios. */
  get registrosFiltrados(): RegistroItem[] {
    let list = this.registros;

    if (this.filtroPerfil) {
      list = list.filter(r => (r.tipoPerfil || '') === this.filtroPerfil);
    }
    if (this.filtroSexo) {
      list = list.filter(r => (r.genero || '') === this.filtroSexo);
    }
    if (this.filtroEntidad) {
      list = list.filter(r => (r.entidadFederativa || '').trim() === this.filtroEntidad);
    }
    if (this.filtroMunicipio) {
      list = list.filter(r => (r.municipio || '').trim() === this.filtroMunicipio);
    }

    const q = (this.filtroTexto || '').trim().toLowerCase();
    if (q) {
      list = list.filter(r => {
        const nombre = this.getNombreCompleto(r).toLowerCase();
        const email = (r.email || '').toLowerCase();
        const curp = (r.curp || '').toLowerCase();
        const telefono = (r.telefono || '').replace(/\s/g, '');
        const tipoPerfil = (r.tipoPerfil || '').toLowerCase();
        const genero = (r.genero || '').toLowerCase();
        const entidad = (r.entidadFederativa || '').toLowerCase();
        const municipio = (r.municipio || '').toLowerCase();
        return nombre.includes(q) || email.includes(q) || curp.includes(q) ||
               telefono.includes(q.replace(/\s/g, '')) || tipoPerfil.includes(q) ||
               genero.includes(q) || entidad.includes(q) || municipio.includes(q);
      });
    }
    return list;
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
    this.http.get<RegistroItem[]>(`${environment.apiBaseUrl}/admin/registros`).subscribe({
      next: (data) => {
        this.registros = data;
        if (this.usuarioSeleccionadoId != null && !data.some((r) => r.id === this.usuarioSeleccionadoId)) {
          this.usuarioSeleccionadoId = null;
        }
        this.loading = false;
        data.filter(r => r.fotoDocumentoId).forEach(r => this.cargarFotoRegistro(r));
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'No se pudo cargar el listado';
        this.loading = false;
      }
    });
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

  getGeneroDisplay(genero: string | undefined): string {
    if (!genero) return '—';
    const m: Record<string, string> = { MASCULINO: 'Masculino', FEMENINO: 'Femenino', OTRO: 'Otro' };
    return m[genero] || genero;
  }

  private cargarFotoRegistro(r: RegistroItem): void {
    if (!r.fotoDocumentoId) return;
    this.http.get(`${environment.apiBaseUrl}/documentos/${r.fotoDocumentoId}`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        r.fotoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob));
        this.cdr.detectChanges();
      },
      error: () => { r.fotoUrl = null; this.cdr.detectChanges(); }
    });
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
        const url = URL.createObjectURL(blob);
        const win = window.open(url, '_blank');
        if (!win) {
          doc.save(nombreArchivo);
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
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
  exportarExcel(): void {
    const items = this.registrosFiltrados;
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
    exportRowsAsXlsx(headers, rows, `reporte_registros_${this.timestamp()}.xlsx`, 'Registros');
  }

  /** Exportar reporte para imprimir / guardar como PDF. */
  exportarPdf(): void {
    const items = this.registrosFiltrados;
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

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
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
          selectEl.innerHTML = renderOptionTags(searchInput.value);
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
          selectEl.innerHTML = renderOptionTags(searchInput.value);
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
        this.registros = this.registros.filter(r => r.id !== id);
        if (this.usuarioSeleccionadoId === id) {
          this.usuarioSeleccionadoId = null;
        }
      },
      error: (err: { error?: { message?: string } }) => {
        this.accionEnProceso = false;
        alert(err?.error?.message || 'Error al eliminar');
      }
    });
  }
}
