import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loading = false;
  errorMsg = '';
  /** 1 = email + contraseña, 2 = código de verificación */
  step: 1 | 2 = 1;
  /** Email en espera de verificación (para step 2) */
  pendingEmail = '';
  /** Si el usuario marcó "Recuérdame" en step 1 */
  rememberChecked = false;
  form!: FormGroup;
  codeForm!: FormGroup;

  constructor(private fb: FormBuilder, private auth: AuthService, private router: Router) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      remember: [false]
    });
    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]]
    });
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      if (this.auth.isAdmin()) {
        this.router.navigateByUrl('/admin');
      } else {
        this.router.navigateByUrl('/landing');
      }
    }
  }

  /** Paso 1: solicitar código de verificación (o login directo si tiene rememberToken) */
  submitStep1() {
    this.errorMsg = '';
    if (this.form.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Formulario incompleto',
        text: 'Por favor, complete todos los campos',
        confirmButtonColor: '#800020'
      });
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    const email = this.form.value.email.trim().toLowerCase();
    const password = this.form.value.password;

    Swal.fire({
      title: 'Verificando...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.auth.loginRequestCode(email, password).subscribe({
      next: (res) => {
        if (!res.requiresVerification && res.token) {
          // Login directo sin 2FA (dispositivo de confianza)
          this.auth.me().subscribe({
            next: () => {
              this.loading = false;
              Swal.close();
              Swal.fire({
                icon: 'success',
                title: '¡Bienvenida o bienvenido!',
                text: 'Sesión iniciada correctamente',
                timer: 1500,
                showConfirmButton: false,
                toast: true,
                position: 'top-end'
              }).then(() => this.navegarSegunEstado());
            },
            error: () => {
              this.loading = false;
              Swal.close();
              this.navegarSegunEstado();
            }
          });
        } else {
          // Necesita código 2FA
          this.loading = false;
          Swal.close();
          this.pendingEmail = res.email;
          this.rememberChecked = this.form.value.remember || false;
          this.step = 2;
          this.codeForm.reset();
          Swal.fire({
            icon: 'info',
            title: 'Código enviado',
            text: `Se envió un código de 6 dígitos a ${res.email}. Revísalo e ingrésalo abajo.`,
            confirmButtonColor: '#800020',
            timer: 4000,
            timerProgressBar: true
          });
        }
      },
      error: (err) => {
        this.loading = false;
        Swal.close();
        const msg = err?.error?.message || 'Credenciales inválidas o error al enviar el código.';
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: msg,
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  /** Paso 2: verificar código e iniciar sesión */
  submitStep2() {
    this.errorMsg = '';
    if (this.codeForm.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Código inválido',
        text: 'Ingresa el código de 6 dígitos que recibiste por correo',
        confirmButtonColor: '#800020'
      });
      this.codeForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const code = this.codeForm.value.code.trim();

    Swal.fire({
      title: 'Verificando...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.auth.loginVerifyCode(this.pendingEmail, code, this.rememberChecked).subscribe({
      next: () => {
        this.auth.me().subscribe({
          next: () => {
            this.loading = false;
            Swal.close();
            Swal.fire({
              icon: 'success',
              title: '¡Bienvenida o bienvenido!',
              text: 'Sesión iniciada correctamente',
              timer: 1500,
              showConfirmButton: false,
              toast: true,
              position: 'top-end'
            }).then(() => this.navegarSegunEstado());
          },
          error: () => {
            this.loading = false;
            Swal.close();
            this.navegarSegunEstado();
          }
        });
      },
      error: (err) => {
        this.loading = false;
        Swal.close();
        const msg = err?.error?.message || 'Código inválido o expirado. Solicita uno nuevo.';
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: msg,
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  volverAlPaso1() {
    this.step = 1;
    this.pendingEmail = '';
    this.codeForm.reset();
    this.errorMsg = '';
  }

  /**
   * Determina a dónde redirigir según el estado del registro del usuario.
   * 1. Si es admin → /admin
   * 2. Si no completó registro2 (documentos) → /app/registro2
   * 3. Si completó registro2 pero no la migración → /landing + aviso
   * 4. Si ya completó todo → /landing
   */
  private navegarSegunEstado(): void {
    if (this.auth.isAdmin()) {
      this.router.navigateByUrl('/admin');
      return;
    }
    const user = this.auth.currentUser;
    if (user && !user.registro2Completo) {
      this.router.navigateByUrl('/app/registro2');
    } else if (user && user.registro2Completo && !user.tienePerfilMigracion) {
      this.router.navigateByUrl('/landing');
      setTimeout(() => {
        Swal.fire({
          icon: 'info',
          title: 'Registro incompleto',
          html: `
            <p style="font-size:0.95rem;color:#444;">
              Aún no has completado tu <strong>perfil único SIIMEX</strong>.
              Completa tu registro para acceder a todas las funcionalidades de la plataforma.
            </p>
          `,
          confirmButtonText: '<i class="fas fa-edit me-1"></i> Completar registro',
          cancelButtonText: 'Más tarde',
          showCancelButton: true,
          confirmButtonColor: '#800020',
          cancelButtonColor: '#6c757d',
          allowOutsideClick: true,
          customClass: { popup: 'swal-registro-incompleto' }
        }).then((result) => {
          if (result.isConfirmed) {
            this.router.navigateByUrl('/completarRegistro');
          }
        });
      }, 600);
    } else {
      this.router.navigateByUrl('/landing');
    }
  }
}
