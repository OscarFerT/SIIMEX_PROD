import { Component, ChangeDetectionStrategy, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  AbstractControl,
  ValidationErrors,
  FormGroup,
  FormControl,
  FormArray,
  Validators
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { environment } from '../../../environments/environment';
import Swal from 'sweetalert2';

/* ===== Validadores de archivos ===== */
function fileRequired(ctrl: AbstractControl): ValidationErrors | null {
  const f = ctrl.value as File | null;
  return f ? null : { requiredFile: true };
}
function fileMaxSizeMB(maxMB: number) {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const f = ctrl.value as File | null;
    if (!f) return null;
    return f.size <= maxMB * 1024 * 1024 ? null : { maxSize: { maxMB, size: f.size } };
  };
}
function fileAccept(acceptList: string[]) {
  const norm = acceptList.map(a => a.trim().toLowerCase());
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const f = ctrl.value as File | null;
    if (!f) return null;
    const ext = f.name.split('.').pop()?.toLowerCase() || '';
    const mimeOk = !!f.type && norm.includes(f.type.toLowerCase());
    const extOk = norm.includes('.' + ext);
    return (mimeOk || extOk) ? null : { accept: { allow: acceptList, got: f.type || '.' + ext } };
  };
}

/* ===== RFC ===== */
const RFC_REGEX = /^[A-ZÑ&X]{3,4}\d{6}[A-Z0-9]{2,3}$/;
function rfcValidator(ctrl: AbstractControl): ValidationErrors | null {
  const raw = ctrl.value as string | null;
  const v = (raw || '').toUpperCase().replace(/[-\s]/g, '');
  if (!v) return { required: true };
  return RFC_REGEX.test(v) ? null : { rfc: true };
}

/* ===== Tipado ===== */
type Step2Form = FormGroup<{
  fotoFile: FormControl<File | null>;
  semblanza: FormControl<string | null>;
  rfcNum: FormControl<string | null>;
  fiscalPdf: FormControl<File | null>;
  cedulaPdf: FormControl<File | null>;
  certificados: FormArray<FormControl<File | null>>;
}>;
type FileKeys = 'fotoFile' | 'fiscalPdf' | 'cedulaPdf';

@Component({
  selector: 'app-registro-step2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './registro-step2.html',
  styleUrls: ['./registro-step2.css'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class RegistroStep2Component implements OnInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private authService = inject(AuthService);
  
  @ViewChild('fotoInput') fotoInputRef!: ElementRef<HTMLInputElement>;

  readonly MAX_MB_INE_CEDULA = 2;
  readonly MAX_MB_CERT = 10;
  showCerts = false;
  submitting = false;
  archivosYaCargados = false;
  fotoPreview: string | null = null;
  private fotoExistenteEnServidor = false;
  fotoObligatoriaIntentada = false;

  private _dragging: FileKeys | number | null = null;
  dragging(): FileKeys | number | null { return this._dragging; }

  form: Step2Form = this.fb.group({
    fotoFile: this.fb.control<File | null>(null, [
      fileMaxSizeMB(5),
      fileAccept(['.jpg','.jpeg','.png','image/jpeg','image/png'])
    ]),
    semblanza: this.fb.control<string | null>(null, [Validators.maxLength(1500)]),
    rfcNum: this.fb.control<string | null>(null, [rfcValidator]),
    fiscalPdf: this.fb.control<File | null>(null, [
      fileRequired, fileMaxSizeMB(this.MAX_MB_INE_CEDULA), fileAccept(['.pdf', 'application/pdf'])
    ]),
    cedulaPdf: this.fb.control<File | null>(null, [
      fileRequired, fileMaxSizeMB(this.MAX_MB_INE_CEDULA), fileAccept(['.pdf','application/pdf'])
    ]),
    certificados: this.fb.array<FormControl<File | null>>([]),
  });

  f = this.form.controls;

  constructor() {
    // Normaliza RFC a mayúsculas y sin separadores
    this.f.rfcNum.valueChanges.subscribe(v => {
      const norm = (v || '').toUpperCase().replace(/[-\s]/g, '');
      if (v !== norm) this.f.rfcNum.setValue(norm, { emitEvent: false });
    });
  }

  ngOnInit(): void {
    this.cargarDatosUsuario();
  }

  private cargarDatosUsuario(): void {
    if (!this.authService.isLoggedIn()) return;

    this.authService.me().subscribe({
      next: (usuario: any) => {
        if (usuario.rfc) {
          this.f.rfcNum.setValue(usuario.rfc.toUpperCase().replace(/[-\s]/g, ''));
        }
        if (usuario.semblanza) {
          this.f.semblanza.setValue(usuario.semblanza);
        }
        if (usuario.fotoDocumentoId) {
          this.cargarFotoDesdeServidor(usuario.fotoDocumentoId);
        }
      },
      error: () => {}
    });
  }

  private cargarFotoDesdeServidor(documentoId: number): void {
    this.http.get(`${environment.apiBaseUrl}/documentos/${documentoId}`, { responseType: 'blob' })
      .subscribe({
        next: (blob) => {
          this.fotoPreview = URL.createObjectURL(blob);
          this.fotoExistenteEnServidor = true;
        },
        error: () => {}
      });
  }

  onFotoChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.f.fotoFile.setValue(file);
    this.f.fotoFile.markAsTouched();
    if (file) {
      this.fotoObligatoriaIntentada = false;
      this.revokePreview();
      const reader = new FileReader();
      reader.onload = () => this.fotoPreview = reader.result as string;
      reader.readAsDataURL(file);
    } else {
      this.revokePreview();
      this.fotoPreview = null;
    }
    input.value = '';
  }

  clearFoto(): void {
    this.f.fotoFile.setValue(null);
    this.revokePreview();
    this.fotoPreview = null;
    this.fotoExistenteEnServidor = false;
    this.fotoObligatoriaIntentada = true;
  }

  private revokePreview(): void {
    if (this.fotoPreview?.startsWith('blob:')) {
      URL.revokeObjectURL(this.fotoPreview);
    }
  }

  get semblanzaLength(): number {
    return (this.f.semblanza.value || '').length;
  }

  tieneFotoPerfil(): boolean {
    return !!this.f.fotoFile.value || !!this.fotoPreview || this.fotoExistenteEnServidor;
  }

  mostrarErrorFotoObligatoria(): boolean {
    return !this.tieneFotoPerfil() && (this.f.fotoFile.touched || this.fotoObligatoriaIntentada);
  }

  seccionesCompletadas(): number {
    return (this.tieneFotoPerfil() ? 1 : 0)
      + (this.f.rfcNum.valid && this.f.fiscalPdf.value ? 1 : 0)
      + (this.f.cedulaPdf.value ? 1 : 0)
      + (this.hasCertificados() ? 1 : 0);
  }

  puedeCompletarRegistro(): boolean {
    return this.tieneFotoPerfil()
      && !!this.f.fiscalPdf.value
      && !!this.f.cedulaPdf.value
      && this.form.valid;
  }

  /* ===== Getters para facilitar el acceso ===== */
  get certificadosArray(): FormArray<FormControl<File | null>> {
    return this.form.get('certificados') as FormArray<FormControl<File | null>>;
  }

  /* ===== Drag & drop helpers (firmas que espera tu HTML) ===== */
  onInputFile(e: Event, key: FileKeys | number) {
    const input = e.target as HTMLInputElement;
    const file: File | null = input.files?.[0] ?? null;
    const requierePdf = typeof key === 'number' || key !== 'fotoFile';
    if (file && requierePdf && !this.esArchivoPdf(file)) {
      input.value = '';
      if (typeof key === 'number') {
        const control = this.certificadosArray.at(key);
        control.setValue(null);
        control.markAsTouched();
      } else {
        (this.f[key] as FormControl<File | null>).setValue(null);
        (this.f[key] as FormControl<File | null>).markAsTouched();
      }
      Swal.fire('Formato no permitido', 'Solo se aceptan archivos PDF.', 'warning');
      return;
    }
    
    if (typeof key === 'number') {
      // Es un índice del array de certificados
      const control = this.certificadosArray.at(key);
      control.setValue(file);
      control.markAsTouched();
    } else {
      // Es un campo normal
      (this.f[key] as FormControl<File | null>).setValue(file);
      (this.f[key] as FormControl<File | null>).markAsTouched();
    }
  }

  onDrop(e: DragEvent, key: FileKeys | number) {
    e.preventDefault();
    e.stopPropagation();
    const file: File | null = e.dataTransfer?.files?.[0] || null;
    const requierePdf = typeof key === 'number' || key !== 'fotoFile';
    if (file && requierePdf && !this.esArchivoPdf(file)) {
      if (typeof key === 'number') {
        const control = this.certificadosArray.at(key);
        control.setValue(null);
        control.markAsTouched();
      } else {
        (this.f[key] as FormControl<File | null>).setValue(null);
        (this.f[key] as FormControl<File | null>).markAsTouched();
      }
      this._dragging = null;
      Swal.fire('Formato no permitido', 'Solo se aceptan archivos PDF.', 'warning');
      return;
    }
    
    if (typeof key === 'number') {
      // Es un índice del array de certificados
      const control = this.certificadosArray.at(key);
      control.setValue(file);
      control.markAsTouched();
    } else {
      // Es un campo normal
      (this.f[key] as FormControl<File | null>).setValue(file);
      (this.f[key] as FormControl<File | null>).markAsTouched();
    }
    this._dragging = null;
  }

  onDragOver(e: DragEvent, key: FileKeys | number) {
    e.preventDefault();
    this._dragging = key;
  }

  onDragLeave() { this._dragging = null; }

  clearFile(key: FileKeys | number) {
    if (typeof key === 'number') {
      // Es un índice del array de certificados
      const control = this.certificadosArray.at(key);
      control.setValue(null);
      control.markAsTouched();
    } else {
      // Es un campo normal
      (this.f[key] as FormControl<File | null>).setValue(null);
      (this.f[key] as FormControl<File | null>).markAsTouched();
    }
  }

  /* ===== Métodos para manejar certificados dinámicos ===== */
  agregarCertificado() {
    const nuevoControl = this.fb.control<File | null>(null, [
      fileMaxSizeMB(this.MAX_MB_CERT),
      fileAccept(['.pdf','application/pdf'])
    ]);
    this.certificadosArray.push(nuevoControl);
  }

  private esArchivoPdf(file: File | null): boolean {
    if (!file) return false;
    const mime = (file.type || '').toLowerCase();
    const nombre = (file.name || '').toLowerCase();
    return mime.includes('pdf') || nombre.endsWith('.pdf');
  }

  eliminarCertificado(index: number) {
    // Si el usuario quiere eliminar el archivo, solo limpiamos el control
    // Si quiere eliminar el campo completo, se puede hacer con removeAt
    const control = this.certificadosArray.at(index);
    control.setValue(null);
    control.markAsTouched();
  }

  eliminarCampoCertificado(index: number) {
    // Elimina completamente el campo del array
    this.certificadosArray.removeAt(index);
  }

  getCertificadoControl(index: number): FormControl<File | null> {
    return this.certificadosArray.at(index) as FormControl<File | null>;
  }

  trackByIndex(index: number): number {
    return index;
  }

  isDraggingOver(index: number): boolean {
    const drag = this.dragging();
    return drag === index;
  }

  hasCertificados(): boolean {
    return this.certificadosArray.length > 0 && 
           this.certificadosArray.controls.some((c: any) => c.value);
  }

  humanSize(bytes?: number) {
    if (bytes == null) return '';
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  }

  /* ===== Navegación y guardado ===== */
  goBack(ev?: Event) {
    ev?.preventDefault();
    this.router.navigateByUrl('/landing');
  }

  submit(ev?: Event) {
    ev?.preventDefault();

    if (!this.tieneFotoPerfil()) {
      this.fotoObligatoriaIntentada = true;
      this.f.fotoFile.markAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Fotografía obligatoria',
        text: 'Debes cargar tu fotografía de perfil para completar Registro 2.',
        confirmButtonColor: '#800020'
      });
      return;
    }
    
    if (this.archivosYaCargados) {
      Swal.fire({
        icon: 'warning',
        title: 'Archivos ya registrados',
        text: 'Los archivos ya han sido cargados previamente. No se pueden modificar.',
        confirmButtonColor: '#800020'
      });
      return;
    }
    
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor, complete todos los campos obligatorios',
        confirmButtonColor: '#800020'
      });
      return;
    }

    this.submitting = true;

    Swal.fire({
      title: 'Guardando...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    const promises: Promise<any>[] = [];

    // 1. Guardar foto si hay nueva
    if (this.f.fotoFile.value) {
      const fotoData = new FormData();
      fotoData.append('foto', this.f.fotoFile.value);
      promises.push(
        this.http.post(`${environment.apiBaseUrl}/usuarios/me/foto`, fotoData).toPromise()
      );
    }

    // 2. Guardar semblanza
    if (this.f.semblanza.value != null) {
      promises.push(
        this.http.patch(`${environment.apiBaseUrl}/usuarios/me`, {
          semblanza: this.f.semblanza.value || ''
        }).toPromise()
      );
    }

    // 3. Guardar documentos (INE, cédula, certificados)
    const formData = new FormData();
    if (this.f.fiscalPdf.value) {
      formData.append('fiscalPdf', this.f.fiscalPdf.value);
    }
    if (this.f.cedulaPdf.value) {
      formData.append('cedulaPdf', this.f.cedulaPdf.value);
    }
    const certificados = this.certificadosArray.controls
      .map(control => control.value)
      .filter((file): file is File => file !== null);
    certificados.forEach((file, index) => {
      formData.append(`cert${index + 1}`, file);
    });

    promises.push(
      this.http.post<{status: string; message: string; documentosGuardados: number}>(
        `${environment.apiBaseUrl}/documentos/registro2`,
        formData
      ).toPromise()
    );

    Promise.all(promises).then(() => {
      this.submitting = false;
      this.authService.refreshUser();
      Swal.fire({
        icon: 'success',
        title: 'Registro completado',
        text: 'Ahora completa tu perfil de personas investigadoras e innovadoras.',
        confirmButtonColor: '#800020'
      }).then(() => {
        this.router.navigateByUrl('/completarRegistro');
      });
    }).catch((err: any) => {
      this.submitting = false;
      const errorMessage = err?.error?.message || 'No se pudieron guardar los datos. Intente nuevamente.';
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: errorMessage,
        confirmButtonColor: '#800020'
      });
    });
  }
}
