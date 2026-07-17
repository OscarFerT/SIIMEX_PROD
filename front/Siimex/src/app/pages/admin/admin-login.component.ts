import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth.service';
import Swal from 'sweetalert2';

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
        this.router.navigateByUrl('/admin/dashboard');
      } else {
        this.router.navigateByUrl('/landing');
      }
    }
  }

  submitStep1(): void {
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
      error: (err: { error?: { message?: string } }) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Credenciales inválidas o sin permisos de administrador.';
      }
    });
  }

  submitStep2(): void {
    this.errorMsg = '';
    if (!this.pendingEmail || this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    const code = this.codeForm.value.code.trim();
    this.auth.loginAdminVerifyCode(this.pendingEmail, code).subscribe({
      next: () => this.finalizarAccesoAdmin(),
      error: (err: { error?: { message?: string } }) => {
        this.loading = false;
        this.errorMsg = err?.error?.message || 'Código inválido o expirado.';
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
    }).then(() => this.router.navigateByUrl('/admin/dashboard'));
  }
}
