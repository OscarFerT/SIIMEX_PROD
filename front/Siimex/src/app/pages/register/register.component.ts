import {
  Component,
  ChangeDetectionStrategy,
  Inject,
  OnInit,
  PLATFORM_ID,
  signal,
  inject,
  DestroyRef,
} from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { CommonModule, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
  FormGroup,
  FormControl,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { RegisterRequest, Registro1Request } from '../../core/auth.service';
import Swal from 'sweetalert2';

/* =======================
   Validadores personalizados
   ======================= */

// CURP: patrón simplificado válido para front
// Permite X en los primeros 4 caracteres (cuando no hay suficiente información)
const CURP_REGEX = /^[A-ZX]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

function curpValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value || '').toUpperCase().trim();
  if (!v) return null;
  return CURP_REGEX.test(v) ? null : { curp: true };
}

function rfcValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value || '').toUpperCase().trim();
  if (!v) return null;
  // Validar que tenga exactamente 13 caracteres
  if (v.length !== 13) return { rfcLength: true };
  // Permitir X en los primeros 4 caracteres (cuando no hay suficiente información)
  // Los primeros 4 caracteres deben ser letras (incluyendo X) o el formato debe ser válido
  const primeros4 = v.substring(0, 4);
  if (!/^[A-ZÑ&X]{3,4}$/.test(primeros4)) {
    return { rfcLength: true };
  }
  return null;
}

function phoneValidator(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value || '').replace(/\D/g, '');
  if (!v) return null;
  return v.length >= 10 ? null : { phone: true };
}

function strongPassword(ctrl: AbstractControl): ValidationErrors | null {
  const v = (ctrl.value || '') as string;
  if (!v) return null;
  const ok = v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v);
  return ok ? null : { weak: true };
}

function emailRealistaValidator(ctrl: AbstractControl): ValidationErrors | null {
  const raw = (ctrl.value ?? '') as string;
  const v = raw.trim();
  if (!v) return null;

  if (v.includes(' ')) return { emailRealista: true };
  const atCount = (v.match(/@/g) || []).length;
  if (atCount !== 1) return { emailRealista: true };

  const [local, domain] = v.split('@');
  if (!local || !domain) return { emailRealista: true };
  if (local.startsWith('.') || local.endsWith('.')) return { emailRealista: true };
  if (domain.startsWith('.') || domain.endsWith('.')) return { emailRealista: true };
  if (local.includes('..') || domain.includes('..')) return { emailRealista: true };

  const lastDot = domain.lastIndexOf('.');
  if (lastDot <= 0) return { emailRealista: true };
  const tld = domain.slice(lastDot + 1);
  if (tld.length < 2) return { emailRealista: true };

  const basicEmailRegex =
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

  return basicEmailRegex.test(v) ? null : { emailRealista: true };
}

function matchPasswordsValidator(group: AbstractControl): ValidationErrors | null {
  const pass = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  if (!pass || !confirm) return null;
  return pass === confirm ? null : { mismatch: true };
}

function matchEmailsValidator(group: AbstractControl): ValidationErrors | null {
  const email = group.get('email')?.value; // ✅ Cambiado de 'correo' a 'email'
  const confirm = group.get('confirmCorreo')?.value;
  if (!email || !confirm) return null;
  return email === confirm ? null : { emailMismatch: true };
}

/**
 * Valida CURP vs RFC con tolerancia inteligente:
 *  - Fecha (posiciones 4-9): debe coincidir al 100%.
 *  - Letras (posiciones 0-3): usa dos criterios (el más flexible gana):
 *      a) Al menos 2 de 4 en la misma posición, O
 *      b) Al menos 3 de 4 letras compartidas (sin importar orden).
 *    Esto cubre casos donde el SAT reordena/modifica letras
 *    (ej. FXTO vs FEXT: mismas letras F,X,T solo en distinto orden).
 */
function rfcMatchesCurpValidator(group: AbstractControl): ValidationErrors | null {
  const curp = (group.get('curp')?.value || '').toUpperCase().trim();
  const rfc = (group.get('rfc')?.value || '').toUpperCase().trim();

  if (!curp || !rfc) return null;
  if (curp.length < 10 || rfc.length < 10) return null;

  const curpFecha = curp.substring(4, 10);
  const rfcFecha = rfc.substring(4, 10);
  if (curpFecha !== rfcFecha) return { rfcCurpMismatch: true };

  const curpLetras = curp.substring(0, 4);
  const rfcLetras = rfc.substring(0, 4);

  let posicionales = 0;
  for (let i = 0; i < 4; i++) {
    if (curpLetras[i] === rfcLetras[i]) posicionales++;
  }
  if (posicionales >= 2) return null;

  const curpArr = curpLetras.split('');
  let compartidas = 0;
  for (const ch of rfcLetras) {
    const idx = curpArr.indexOf(ch);
    if (idx !== -1) {
      compartidas++;
      curpArr.splice(idx, 1);
    }
  }

  return compartidas >= 3 ? null : { rfcCurpMismatch: true };
}

export type Genero = 'MASCULINO' | 'FEMENINO';
export type EstadoCivil = 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'UNION_LIBRE';
export type TipoPerfil = 'INVESTIGADOR' | 'INNOVADOR' | 'HIBRIDO';

/* =======================
   Tipado del formulario
   ======================= */
type RegistroForm = FormGroup<{
  nombre: FormControl<string>;
  apellidoPaterno: FormControl<string>;
  apellidoMaterno: FormControl<string>;
  fechaNacimiento: FormControl<string>;
  tipoPerfil: FormControl<TipoPerfil>;
  email: FormControl<string>;
  confirmCorreo: FormControl<string>;
  paisNacimiento: FormControl<string>;
  entidadFederativa: FormControl<string>;
  municipio: FormControl<string>;
  nacionalidad: FormControl<string>;
  estadoCivil: FormControl<EstadoCivil>;
  telefono: FormControl<string>;
  curp: FormControl<string>;
  rfc: FormControl<string>;
  genero: FormControl<Genero>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
}>;

// 🔥 Backend espera enum en MAYÚSCULAS exactas
type GeneroBackend = 'MASCULINO' | 'FEMENINO';



@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)', maxHeight: 0 }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)', maxHeight: '100px' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)', maxHeight: 0 }))
      ])
    ]),
    trigger('slideInHelp', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('0ms', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('0ms', style({ opacity: 0 }))
      ])
    ])
  ]
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private auth = inject(AuthService);

  isBrowser = false;

  submitting = signal(false);
  pwdVisible = signal(false);
  confirmPwdVisible = signal(false);

  /** Id de la sección cuyo ayuda está visible (null = ninguna) */
  openSectionHelp = signal<string | null>(null);

  /** Textos de ayuda por sección */
  readonly sectionHelpTexts: Record<string, string> = {
    personal: 'Completa tu nombre completo (nombre y apellidos), fecha de nacimiento, sexo y estado civil tal como aparecen en tus documentos oficiales. Estos datos deben coincidir con tu CURP.',
    tipoPerfil: 'Elige si te registras como personas investigadoras, como personas innovadoras o como perfil mixto (personas investigadoras e innovadoras).',
    ubicacion: 'Indica tu país de nacimiento, entidad federativa, municipio y nacionalidad. Usa mayúsculas para país y nacionalidad (ej. MÉXICO, MEXICANA).',
    identificacion: 'Ingresa tu CURP (18 caracteres) y RFC (13 caracteres) exactamente como en tus documentos oficiales. El teléfono debe tener al menos 10 dígitos. La fecha de nacimiento contenida en ambos documentos debe coincidir.',
    contacto: 'Registra tu correo electrónico y repítelo para confirmar. Este correo será tu usuario o usuaria para iniciar sesión y recibir notificaciones.',
    seguridad: 'Crea una contraseña segura: mínimo 8 caracteres, con mayúsculas, minúsculas y números. Repítela para confirmar. Guárdala en un lugar seguro.'
  };

  toggleSectionHelp(sectionId: string): void {
    this.openSectionHelp.set(this.openSectionHelp() === sectionId ? null : sectionId);
  }

  errorMsg = '';
  okMsg = '';

  today = new Date().toISOString().slice(0, 10);
  minDate = '1900-01-01';

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

  form: RegistroForm = this.fb.nonNullable.group(
    {
    nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(60)]),
    apellidoPaterno: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(60)]),
    apellidoMaterno: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(60)]),
    
      fechaNacimiento: this.fb.nonNullable.control('', [Validators.required]),
      tipoPerfil: this.fb.nonNullable.control<TipoPerfil>('INVESTIGADOR', [Validators.required]),

      email: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.email,
        emailRealistaValidator,
      ]),
      confirmCorreo: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.email,
        emailRealistaValidator,
      ]),

      telefono: this.fb.nonNullable.control('', [Validators.required, phoneValidator]),
      curp: this.fb.nonNullable.control('', [Validators.required, curpValidator]),
      rfc: this.fb.nonNullable.control('', [Validators.required, rfcValidator]),
      genero: this.fb.nonNullable.control<Genero>('MASCULINO', [Validators.required]),
      paisNacimiento: this.fb.nonNullable.control('', [Validators.required]),
      entidadFederativa: this.fb.nonNullable.control('', [Validators.required]),
      municipio: this.fb.nonNullable.control('', [Validators.required]),
      nacionalidad: this.fb.nonNullable.control('', [Validators.required]),
      estadoCivil: this.fb.nonNullable.control<EstadoCivil>('SOLTERO', [Validators.required]),
      password: this.fb.nonNullable.control('', [Validators.required, strongPassword]),
      confirmPassword: this.fb.nonNullable.control('', [Validators.required]),
    },
    { validators: [matchPasswordsValidator, matchEmailsValidator, rfcMatchesCurpValidator] }
  );

  readonly f = this.form.controls;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    @Inject(DOCUMENT) private doc: Document
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    // Transformar a mayúsculas: Nombre
    this.f.nombre.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v && v !== v.toUpperCase()) {
          this.f.nombre.setValue(v.toUpperCase(), { emitEvent: false });
        }
      });

    // Transformar a mayúsculas: Apellido paterno
    this.f.apellidoPaterno.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v && v !== v.toUpperCase()) {
          this.f.apellidoPaterno.setValue(v.toUpperCase(), { emitEvent: false });
        }
      });

    // Transformar a mayúsculas: Apellido materno
    this.f.apellidoMaterno.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v && v !== v.toUpperCase()) {
          this.f.apellidoMaterno.setValue(v.toUpperCase(), { emitEvent: false });
        }
      });

    // Transformar a mayúsculas: País de nacimiento
    this.f.paisNacimiento.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v && v !== v.toUpperCase()) {
          this.f.paisNacimiento.setValue(v.toUpperCase(), { emitEvent: false });
        }
      });

    // Transformar a mayúsculas: Nacionalidad
    this.f.nacionalidad.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v && v !== v.toUpperCase()) {
          this.f.nacionalidad.setValue(v.toUpperCase(), { emitEvent: false });
        }
      });

    // CURP: transforma a mayúsculas y revalida RFC (sin emitEvent para evitar recursión)
    this.f.curp.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v && v !== v.toUpperCase()) {
          this.f.curp.setValue(v.toUpperCase(), { emitEvent: false });
        }
        if (this.f.rfc.value) {
          this.f.rfc.updateValueAndValidity({ emitEvent: false });
        }
      });

    // RFC: transforma a mayúsculas y revalida CURP (sin emitEvent para evitar recursión)
    this.f.rfc.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (v && v !== v.toUpperCase()) {
          this.f.rfc.setValue(v.toUpperCase(), { emitEvent: false });
        }
        if (this.f.curp.value) {
          this.f.curp.updateValueAndValidity({ emitEvent: false });
        }
      });

    // Email: transformar a minúsculas (NO mayúsculas)
    this.f.email.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (!v) return;
        const normalized = v.trim().toLowerCase();
        if (v !== normalized) {
          this.f.email.setValue(normalized, { emitEvent: false });
        }
      });

    // Confirmar Correo: transformar a minúsculas (NO mayúsculas)
    this.f.confirmCorreo.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => {
        if (!v) return;
        const normalized = v.trim().toLowerCase();
        if (v !== normalized) {
          this.f.confirmCorreo.setValue(normalized, { emitEvent: false });
        }
      });
  }

  private focusFirstInvalid(): void {
    if (!this.isBrowser) return;

    const firstInvalidKey = Object.keys(this.form.controls).find(
      (k) => (this.form.controls as any)[k].invalid
    );

    if (!firstInvalidKey) return;

    const el = this.doc.querySelector(
      `[data-control="${firstInvalidKey}"]`
    ) as HTMLElement | null;

    el?.focus();
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  passwordStrength(): 0 | 1 | 2 | 3 {
    const v = this.f.password.value || '';
    if (!v) return 0;

    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) score++;

    return score as 0 | 1 | 2 | 3;
  }

  // ✅ Convierte lo que venga del select a lo que espera Spring (enum)
  private toGeneroBackend(value: string): GeneroBackend {
    const v = (value || '').trim().toLowerCase();

    if (v === 'masculino' || v === 'm') return 'MASCULINO';
    if (v === 'femenino' || v === 'f') return 'FEMENINO';

    // Valor por defecto si no coincide
    return 'MASCULINO';
  }

  submit(): void {
    this.errorMsg = '';
    this.okMsg = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.submitting.set(true);

   const payload: RegisterRequest = {
    email: this.f.email.value.trim().toLowerCase(),
    password: this.f.password.value,
    telefono: (this.f.telefono.value || '').replace(/\D/g, ''),
    registro: {
      nombre: this.f.nombre.value.trim(),
      apellidoPaterno: this.f.apellidoPaterno.value.trim(),
      apellidoMaterno: this.f.apellidoMaterno.value.trim(),
      curp: this.f.curp.value.trim().toUpperCase(),
      rfc: this.f.rfc.value.trim().toUpperCase(),
      fechaNacimiento: this.f.fechaNacimiento.value, // yyyy-MM-dd
      genero: this.form.controls.genero.value,
      nacionalidad: this.f.nacionalidad.value.trim(),
      paisNacimiento: this.f.paisNacimiento.value.trim(),
      entidadFederativa: this.f.entidadFederativa.value.trim(),
      municipio: this.f.municipio.value.trim(),
      estadoCivil: this.form.controls.estadoCivil.value,
      tipoPerfil: this.form.controls.tipoPerfil.value
    }
  };







    Swal.fire({
      title: 'Registrando usuaria o usuario...',
      text: 'Por favor espere',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.auth.register(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        setTimeout(() => {
          const folioHtml = res?.folioRegistro
            ? `<p>Tu folio de registro es <strong>${res.folioRegistro}</strong></p>`
            : '';
          Swal.fire({
            icon: 'success',
            title: '¡Registro exitoso!',
            html: '<p>Revisa tu correo electrónico para activar tu cuenta.</p>' +
              folioHtml +
              '<p>Te enviamos un enlace de verificación a <strong>' + (res?.email || 'tu correo') + '</strong></p><p>Haz clic en el enlace y luego podrás iniciar sesión.</p>',
            confirmButtonColor: '#800020'
          }).then(() => {
            this.router.navigateByUrl('/login');
          });
        }, 500);
      },
      error: (err) => {
        const errorMessage = this.extraerMensajeError(err);
        setTimeout(() => {
          this.submitting.set(false);
          Swal.fire({
            icon: 'error',
            title: 'Error al registrar',
            html: errorMessage.replace(/\n/g, '<br>'),
            confirmButtonColor: '#800020',
            width: '600px'
          });
        }, 0);
      }
    });
  }

  /**
   * Extrae el mensaje de error del backend para mostrarlo en SweetAlert.
   * No usa 'error' cuando es el texto genérico "Bad Request" de Spring.
   */
  private extraerMensajeError(err: { error?: Record<string, unknown> | string; status?: number }): string {
    const fallback = 'No se pudo completar el registro. Verifique los datos e intente de nuevo.';
    const e = err?.error;
    if (!e) {
      return err?.status === 400 ? `Error 400. ${fallback}` : fallback;
    }

    if (typeof e === 'string') return e === 'Bad Request' ? fallback : e;

    const obj = e as Record<string, unknown>;
    const detail = obj['detail'];
    const message = obj['message'];
    const errorStr = obj['error'];

    if (detail && typeof detail === 'string') return detail;
    if (message && typeof message === 'string') return message;
    if (errorStr && typeof errorStr === 'string' && errorStr !== 'Bad Request') return errorStr;

    if (obj['errors'] && typeof obj['errors'] === 'object') {
      const errors = obj['errors'] as Record<string, string> | Array<{ defaultMessage?: string; message?: string }>;
      if (Array.isArray(errors)) {
        const msgs = errors.map((x) => (x.defaultMessage || (x as Record<string, string>)['message'] || '')).filter(Boolean);
        return msgs.length ? msgs.join('\n') : fallback;
      }
      const lines = Object.entries(errors).map(([campo, mensaje]) => {
        const campoTraducido = this.traducirCampo(campo);
        return `${campoTraducido}: ${mensaje}`;
      });
      return lines.join('\n');
    }

    return fallback;
  }

  private traducirCampo(campo: string): string {
    const traducciones: { [key: string]: string } = {
      'email': 'Correo electrónico',
      'password': 'Contraseña',
      'telefono': 'Teléfono',
      'registro.nombre': 'Nombre',
      'registro.apellidoPaterno': 'Apellido paterno',
      'registro.apellidoMaterno': 'Apellido materno',
      'registro.curp': 'CURP',
      'registro.rfc': 'RFC',
      'registro.fechaNacimiento': 'Fecha de nacimiento',
      'registro.genero': 'Género',
      'registro.nacionalidad': 'Nacionalidad',
      'registro.paisNacimiento': 'País de nacimiento',
      'registro.entidadFederativa': 'Entidad federativa',
      'registro.municipio': 'Municipio',
      'registro.estadoCivil': 'Estado civil',
      'registro.tipoPerfil': 'Tipo de perfil (Personas investigadoras/personas innovadoras/mixto)'
    };
    return traducciones[campo] || campo;
  }

}


