import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { Usuario } from '../../core/models/user';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';
import { PdfLimiteService } from '../../core/pdf-limite.service';
import Swal from 'sweetalert2';

/** Niveles de visibilidad en el módulo público de personas investigadoras e innovadoras */
export type VisibilidadPerfil = 'MINIMA' | 'ESTANDAR' | 'COMPLETA';

interface PerfilCompleto {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  telefono: string;
  curp: string;
  rfc: string;
  genero: string;
  fechaNacimiento: string;
  nacionalidad: string;
  paisNacimiento: string;
  entidadFederativa: string;
  estadoCivil: string;
  tipoPerfil: string;
  gradoAcademico: string;
  fotoDocumentoId: number | null;
  ineDocumentoId: number | null;
  cedulaDocumentoId: number | null;
  constanciaSniiDocumentoId: number | null;
  visibilidadPerfil: VisibilidadPerfil;
  consentimientoDirectorioPublico: boolean;
  semblanza: string | null;
}

interface DocumentoResumen {
  id: number;
  nombre?: string | null;
  tipo?: string | null;
  fechaSubida?: string | null;
}

interface PerfilDetalleCompleto {
  semblanza?: string | null;
  institucion?: {
    nombre?: string | null;
    claveOficial?: string | null;
    tipoNombre?: string | null;
    paisNombre?: string | null;
    entidadNombre?: string | null;
    nivelUnoNombre?: string | null;
    nivelDosNombre?: string | null;
  } | null;
  areaConocimiento?: {
    areaNombre?: string | null;
    areaClave?: string | null;
    campoNombre?: string | null;
    campoClave?: string | null;
    disciplinaNombre?: string | null;
    disciplinaClave?: string | null;
    subdisciplinaNombre?: string | null;
    subdisciplinaClave?: string | null;
  } | null;
  perfilMigracion?: {
    migracionId?: string | null;
    cvu?: string | null;
    login?: string | null;
    correoAlterno?: string | null;
    nivelAcademico?: string | null;
    tituloTratamiento?: string | null;
    filtro?: string | null;
    institucionReceptora?: string | null;
    createdDate?: string | null;
    lastModifiedDate?: string | null;
  } | null;
  trayectoriaAcademica?: any[];
  trayectoriaProfesional?: any[];
  idiomas?: any[];
  cursos?: any[];
  estancias?: any[];
  articulos?: any[];
  congresos?: any[];
  divulgaciones?: any[];
  logros?: any[];
  evidencias?: {
    curriculum?: DocumentoResumen | null;
    ine?: DocumentoResumen | null;
    domicilio?: DocumentoResumen | null;
    cedula?: DocumentoResumen | null;
    constanciaSnii?: DocumentoResumen | null;
    cert1?: DocumentoResumen | null;
    cert2?: DocumentoResumen | null;
    divulgacion?: DocumentoResumen | null;
  };
  evidenciasRubrosPersonalizadas?: Record<string, DocumentoResumen[]>;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  perfil: PerfilCompleto | null = null;
  perfilDetalle: PerfilDetalleCompleto | null = null;
  loading = true;
  loadingDetalle = false;
  
  fotoFile: File | null = null;
  fotoPreview: string | SafeResourceUrl | null = null;
  ineFile: File | null = null;
  cedulaFile: File | null = null;
  constanciaSniiFile: File | null = null;
  perfilSniiEditable = false;
  perfilSniiInicial = false;
  semblanzaTexto: string = '';
  maxDocSizeMb = 2;
  
  uploading = false;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private pdfLimiteService: PdfLimiteService
  ) {}

  ngOnInit(): void {
    this.cargarLimitesPdf();
    this.cargarPerfil();
  }

  private cargarLimitesPdf(): void {
    this.pdfLimiteService.obtenerMapaLimites().subscribe((limites) => {
      this.maxDocSizeMb = Number(limites['perfil.documentos']) || 2;
    });
  }
  cargarPerfil(): void {
    this.loading = true;
    this.authService.me().subscribe({
      next: (usuario: Usuario) => {
        // Convertir Usuario a PerfilCompleto
        this.perfil = {
          id: usuario.id,
          nombre: usuario.nombre || '',
          apellidoPaterno: usuario.apellidoPaterno || '',
          apellidoMaterno: usuario.apellidoMaterno || '',
          email: usuario.email || '',
          telefono: usuario.telefono || '',
          curp: usuario.curp || '',
          rfc: usuario.rfc || '',
          genero: usuario.genero || '',
          fechaNacimiento: usuario.fechaNacimiento || '',
          nacionalidad: usuario.nacionalidad || '',
          paisNacimiento: usuario.paisNacimiento || '',
          entidadFederativa: usuario.entidadFederativa || '',
          estadoCivil: usuario.estadoCivil || '',
          tipoPerfil: usuario.tipoPerfil || '',
          gradoAcademico: usuario.gradoAcademico || '',
          fotoDocumentoId: usuario.fotoDocumentoId || null,
          ineDocumentoId: usuario.ineDocumentoId || null,
          cedulaDocumentoId: usuario.cedulaDocumentoId || null,
          constanciaSniiDocumentoId: usuario.constanciaSniiDocumentoId || null,
          visibilidadPerfil: (usuario.visibilidadPerfil === 'MINIMA' || usuario.visibilidadPerfil === 'COMPLETA' ? usuario.visibilidadPerfil : 'ESTANDAR') as VisibilidadPerfil,
          consentimientoDirectorioPublico: !!usuario.consentimientoDirectorioPublico,
          semblanza: usuario.semblanza || null
        };
        
        this.semblanzaTexto = this.perfil.semblanza || '';

        // Cargar foto y curriculum si existen
        if (this.perfil.fotoDocumentoId) {
          this.cargarFoto(this.perfil.fotoDocumentoId);
        }
        this.cargarPerfilDetalle();
        
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar el perfil. Por favor, intente nuevamente.',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  cargarPerfilDetalle(): void {
    this.loadingDetalle = true;
    this.http.get<PerfilDetalleCompleto>(`${environment.apiBaseUrl}/usuarios/me/detalle`).subscribe({
      next: (detalle) => {
        this.perfilDetalle = detalle;
        const constanciaSniiId = (detalle?.evidencias?.constanciaSnii?.id as number | undefined) || null;
        if (this.perfil) {
          this.perfil.constanciaSniiDocumentoId = constanciaSniiId;
        }
        // Si ya hay constancia SNII cargada, el switch también debe aparecer activo/habilitado.
        const perfilSniiDesdeTrayectoria = this.extraerPerfilSnii(detalle?.trayectoriaAcademica);
        const perfilSniiDesdeConstancia = !!constanciaSniiId;
        this.perfilSniiEditable = perfilSniiDesdeTrayectoria || perfilSniiDesdeConstancia;
        this.perfilSniiInicial = this.perfilSniiEditable;
        this.loadingDetalle = false;
        const semblanza = (detalle?.semblanza || '').trim();
        if (semblanza) {
          this.semblanzaTexto = semblanza;
          if (this.perfil) {
            this.perfil.semblanza = semblanza;
          }
        }
      },
      error: () => {
        this.loadingDetalle = false;
        this.perfilDetalle = null;
      }
    });
  }

  cargarFoto(documentoId: number): void {
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          this.fotoPreview = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        },
        error: () => {
          // Si hay error, simplemente no mostrar la foto
          this.fotoPreview = null;
        }
      });
  }

  onFotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Validar que sea una imagen
      if (!file.type.startsWith('image/')) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'El archivo debe ser una imagen',
          confirmButtonColor: '#800020'
        });
        return;
      }
      
      // Validar tamaño (10MB)
      if (file.size > 10 * 1024 * 1024) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'El archivo es demasiado grande. Máximo 10MB',
          confirmButtonColor: '#800020'
        });
        return;
      }
      
      this.fotoFile = file;
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        this.fotoPreview = this.sanitizer.bypassSecurityTrustResourceUrl(result);
      };
      reader.readAsDataURL(file);
    }
  }

  onDocChange(event: Event, tipo: 'ine' | 'cedula' | 'snii'): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];

    if (tipo === 'snii' && !this.perfilSniiEditable) {
      Swal.fire({
        icon: 'warning',
        title: 'Perfil SNII no activo',
        text: 'Activa primero el switch de Perfil SNII para adjuntar esta constancia.',
        confirmButtonColor: '#800020'
      });
      input.value = '';
      return;
    }

    const esPdf = (file.type || '').toLowerCase().includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
    if (!esPdf) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'Solo se permiten archivos PDF', confirmButtonColor: '#800020' });
      input.value = '';
      return;
    }
    if (file.size > this.maxDocSizeMb * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `El archivo es demasiado grande. Máximo ${this.maxDocSizeMb} MB`,
        confirmButtonColor: '#800020'
      });
      input.value = '';
      return;
    }
    if (tipo === 'ine') this.ineFile = file;
    else if (tipo === 'cedula') this.cedulaFile = file;
    else if (tipo === 'snii') this.constanciaSniiFile = file;
  }

  onPerfilSniiEditableChange(checked: boolean): void {
    this.perfilSniiEditable = checked;
    if (!checked) {
      this.constanciaSniiFile = null;
    }
  }

  elegirVisibilidad(nivel: VisibilidadPerfil): void {
    if (this.perfil) {
      if (!this.perfil.consentimientoDirectorioPublico) {
        Swal.fire({
          icon: 'info',
          title: 'Consentimiento requerido',
          text: 'Antes de elegir la visibilidad, activa el consentimiento para compartir información en el directorio público.',
          confirmButtonColor: '#800020'
        });
        return;
      }
      this.perfil.visibilidadPerfil = nivel;
    }
  }

  onConsentimientoDirectorioChange(checked: boolean): void {
    if (!this.perfil) return;
    this.perfil.consentimientoDirectorioPublico = checked;
    if (!checked) {
      this.perfil.visibilidadPerfil = 'MINIMA';
    }
  }

  guardarCambios(): void {
    if (!this.perfil) return;
    
    this.uploading = true;
    
    // Mostrar loading
    Swal.fire({
      title: 'Guardando cambios...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    const uploads: Promise<any>[] = [];

    if (this.perfilSniiEditable !== this.perfilSniiInicial) {
      uploads.push(
        this.http.patch(`${environment.apiBaseUrl}/usuarios/me/perfil-snii`, {
          esPerfilSnii: this.perfilSniiEditable
        }).toPromise()
      );
    }
    
    // Guardar preferencia de visibilidad y semblanza (PATCH /me)
    uploads.push(
      this.http.patch(`${environment.apiBaseUrl}/usuarios/me`, {
        visibilidadPerfil: this.perfil.visibilidadPerfil,
        consentimientoDirectorioPublico: this.perfil.consentimientoDirectorioPublico,
        semblanza: this.semblanzaTexto || ''
      }).toPromise()
    );
    
    // Subir foto si hay nueva
    if (this.fotoFile) {
      const formData = new FormData();
      formData.append('foto', this.fotoFile);
      
      uploads.push(
        this.http.post(`${environment.apiBaseUrl}/usuarios/me/foto`, formData).toPromise()
      );
    }
    
    // Subir documentos (INE, cédula, constancia SNII) via /documentos/registro2
    if (this.ineFile || this.cedulaFile || this.constanciaSniiFile) {
      const docForm = new FormData();
      if (this.ineFile) docForm.append('fiscalPdf', this.ineFile);
      if (this.cedulaFile) docForm.append('cedulaPdf', this.cedulaFile);
      if (this.constanciaSniiFile) docForm.append('constanciaSnii', this.constanciaSniiFile);
      uploads.push(
        this.http.post(`${environment.apiBaseUrl}/documentos/registro2`, docForm).toPromise()
      );
    }
    
    // Esperar a que todas las subidas terminen
    Promise.all(uploads)
      .then(() => {
        this.uploading = false;
        Swal.fire({
          icon: 'success',
          title: '¡Éxito!',
          text: 'Cambios guardados correctamente',
          confirmButtonColor: '#800020'
        }).then(() => {
          // Recargar perfil para actualizar IDs
          this.cargarPerfil();
        });
      })
      .catch((error) => {
        this.uploading = false;
        const body = error?.error;
        const errorMessage = (typeof body === 'object' && body != null && 'message' in body)
          ? (body as { message?: string }).message
          : (typeof body === 'string' ? body : null);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage || error?.message || 'No se pudieron guardar los cambios. Por favor, intente nuevamente.',
          confirmButtonColor: '#800020'
        });
      });
  }

  formatearGenero(genero: string): string {
    const generos: { [key: string]: string } = {
      'MASCULINO': 'Masculino',
      'FEMENINO': 'Femenino',
      'OTRO': 'Otro'
    };
    return generos[genero] || genero;
  }

  formatearTipoPerfil(tipoPerfil: string): string {
    const tipos: { [key: string]: string } = {
      'INVESTIGADOR': 'Personas investigadoras',
      'INNOVADOR': 'Personas innovadoras',
      'HIBRIDO': 'Personas investigadoras e innovadoras'
    };
    if (!tipoPerfil) return 'No especificado';
    return tipos[tipoPerfil] || tipoPerfil;
  }

  formatearEstadoCivil(estadoCivil: string): string {
    const estados: { [key: string]: string } = {
      'SOLTERO': 'Soltero(a)',
      'CASADO': 'Casado(a)',
      'DIVORCIADO': 'Divorciado(a)',
      'VIUDO': 'Viudo(a)',
      'UNION_LIBRE': 'Unión libre'
    };
    if (!estadoCivil) return 'No especificado';
    return estados[estadoCivil] || estadoCivil;
  }

  formatearFecha(fecha: string): string {
    if (!fecha) return '';
    // Si la fecha viene en formato yyyy-MM-dd, convertirla correctamente sin restar un día
    const partes = fecha.split('-');
    if (partes.length === 3) {
      // Crear fecha en formato local (sin considerar zona horaria)
      const anio = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1; // Los meses en JavaScript van de 0-11
      const dia = parseInt(partes[2], 10);
      const date = new Date(anio, mes, dia);
      return date.toLocaleDateString('es-MX', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      });
    }
    // Si viene en otro formato, intentar parsearlo normalmente
    const date = new Date(fecha);
    if (isNaN(date.getTime())) return fecha; // Si no se puede parsear, devolver original
    return date.toLocaleDateString('es-MX', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  }

  cantidad(items: any[] | undefined | null): number {
    return Array.isArray(items) ? items.length : 0;
  }

  esPerfilSnii(): boolean {
    return this.perfilSniiEditable;
  }

  puedeEditarPerfilSnii(): boolean {
    const tieneTrayectoria = Array.isArray(this.perfilDetalle?.trayectoriaAcademica) && this.perfilDetalle!.trayectoriaAcademica!.length > 0;
    const tieneConstancia = !!this.perfil?.constanciaSniiDocumentoId || !!this.constanciaSniiFile;
    return tieneTrayectoria || tieneConstancia;
  }

  private extraerPerfilSnii(lista: any[] | undefined): boolean {
    if (!Array.isArray(lista)) return false;
    return lista.some((item: any) => item?.esPerfilSnii === true || item?.esPerfilSnii === 'true' || item?.esPerfilSnii === 1);
  }

  tieneBloque(value: Record<string, unknown> | null | undefined): boolean {
    if (!value) return false;
    return Object.values(value).some(v => v !== null && v !== undefined && `${v}`.trim() !== '');
  }

  rubrosConEvidencias(): string[] {
    const rubros = this.perfilDetalle?.evidenciasRubrosPersonalizadas;
    if (!rubros) return [];
    return Object.keys(rubros).filter(r => Array.isArray(rubros[r]) && rubros[r].length > 0);
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
}
