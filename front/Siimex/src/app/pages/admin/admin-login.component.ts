import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import Swal from '../../core/safe-swal';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrls: ['./admin-login.component.css']
})
export class AdminLoginComponent implements OnInit {
  loading = false;
  errorMsg = '';
  step: 1 | 2 = 1;
  pendingEmail = '';
  form!: FormGroup;
  codeForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6), Validators.pattern(/^\d{6}$/)]]
    });
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      if (this.auth.isAdmin()) {
        this.abrirPanelAdmin();
      } else {
        this.router.navigateByUrl('/landing');
      }
    }
  }

  submitStep1(): void {
    if (this.loading) return;
    this.errorMsg = '';
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    const email = this.form.value.email.trim().toLowerCase();
    const password = this.form.value.password;

    this.auth.loginAdminRequestCode(email, password).subscribe({
      next: (res) => {
        this.loading = false;
        if (!res.requiresVerification && res.token) {
          this.finalizarAccesoAdmin();
          return;
        }
        this.pendingEmail = res.email;
        this.step = 2;
        this.codeForm.reset();
        Swal.fire({
          icon: 'info',
          title: 'Código enviado',
          text: `Se envió un código de verificación a ${res.email}.`,
          timer: 3000,
          showConfirmButton: false
        });
      },
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.errorMsg = this.mensajeError(err, false);
      }
    });
  }

  submitStep2(): void {
    if (this.loading) return;
    this.errorMsg = '';
    if (!this.pendingEmail || this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const code = this.codeForm.value.code.trim();
    this.auth.loginAdminVerifyCode(this.pendingEmail, code).subscribe({
      next: () => this.finalizarAccesoAdmin(),
      error: (err: HttpErrorResponse) => {
        this.loading = false;
        this.errorMsg = this.mensajeError(err, true);
      }
    });
  }

  volverPaso1(): void {
    this.step = 1;
    this.pendingEmail = '';
    this.codeForm.reset();
    this.errorMsg = '';
  }

  private finalizarAccesoAdmin(): void {
    this.auth.me().subscribe({
      next: () => this.validarRolAdminYEntrar(),
      error: () => this.validarRolAdminYEntrar()
    });
  }

  private validarRolAdminYEntrar(): void {
    this.loading = false;
    if (!this.auth.isAdmin()) {
      this.auth.logout();
      this.errorMsg = 'Acceso solo para administradores.';
      return;
    }
    Swal.fire({
      icon: 'success',
      title: 'Acceso administrador',
      text: 'Bienvenido al panel de administración',
      timer: 1400,
      showConfirmButton: false
    }).then(() => this.abrirPanelAdmin());
  }

  private abrirPanelAdmin(): void {
    this.router.navigateByUrl('/admin/dashboard').then(entro => {
      if (!entro) this.errorMsg = 'No se pudo abrir el panel. Recarga la pagina e intenta nuevamente.';
    }).catch(() => {
      this.errorMsg = 'No se pudieron cargar los archivos del panel. Recarga con Ctrl+F5 para obtener la version actualizada.';
    });
  }

  private mensajeError(error: HttpErrorResponse, codigo: boolean): string {
    if (error.status === 0) return 'No se pudo conectar con el servidor. Revisa la conexion e intenta nuevamente.';
    if (error.status >= 500) return `El servidor devolvio un error (${error.status}). No indica una contrasena o codigo incorrectos; intenta nuevamente y reporta la hora del fallo si persiste.`;
    const mensaje = typeof error.error?.message === 'string' ? error.error.message : null;
    return mensaje || (codigo ? 'Codigo invalido o expirado. Solicita uno nuevo.' : 'Credenciales invalidas o sin permisos de administrador.');
  }
}
