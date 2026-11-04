import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import Swal from '../../core/safe-swal';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-cambiar-contrasena',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cambiar-contrasena.component.html',
  styleUrl: './cambiar-contrasena.component.css'
})
export class CambiarContrasenaComponent {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly submitting = signal(false);
  readonly codeSent = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  email = '';
  code = '';
  newPassword = '';
  confirmation = '';
  private requestedEmail = '';

  requestCode(): void {
    if (this.submitting() || !this.validEmail()) return;
    this.submitting.set(true);
    this.error.set('');
    const email = this.email.trim().toLowerCase();
    this.http.post<{ message: string }>(`${environment.apiBaseUrl}/auth/reset-password/request-code`, { email })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: response => {
          this.requestedEmail = email;
          this.code = '';
          this.codeSent.set(true);
          this.message.set(response.message);
        },
        error: err => this.error.set(err?.error?.message || 'No fue posible solicitar el codigo. Intenta mas tarde.')
      });
  }

  validEmail(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim());
  }

  isFormValid(): boolean {
    return this.codeSent() && this.email.trim().toLowerCase() === this.requestedEmail
      && /^[0-9]{6}$/.test(this.code) && this.newPassword.length >= 8
      && new TextEncoder().encode(this.newPassword).length <= 72
      && this.newPassword === this.confirmation;
  }

  submitResetPassword(): void {
    if (this.submitting() || !this.isFormValid()) return;
    this.submitting.set(true);
    this.error.set('');
    this.http.post(`${environment.apiBaseUrl}/auth/reset-password`, {
      email: this.requestedEmail, code: this.code, newPassword: this.newPassword
    }).pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: () => {
        this.auth.logoutFull();
        this.code = this.newPassword = this.confirmation = '';
        void Swal.fire({ icon: 'success', title: 'Contrasena actualizada',
          text: 'Las sesiones anteriores se cerraron. Inicia sesion con tu nueva contrasena.' })
          .then(() => this.router.navigate(['/login']));
      },
      error: err => this.error.set(err?.error?.message || 'No fue posible cambiar la contrasena. Solicita otro codigo si vencio.')
    });
  }
}
