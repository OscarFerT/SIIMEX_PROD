import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-verificar-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="verify-container">
      <div class="verify-card">
        @if (loading) {
          <div class="text-center py-5">
            <div class="spinner-border text-borgona" role="status">
              <span class="visually-hidden">Verificando...</span>
            </div>
            <p class="mt-3 mb-0">Verificando tu cuenta...</p>
          </div>
        } @else if (done) {
          <div class="text-center py-4">
            <i class="fas fa-check-circle fa-4x text-success mb-3"></i>
            <h5 class="text-success">Cuenta verificada</h5>
            <p class="text-muted mb-4">Ya puedes iniciar sesión con tu correo y contraseña.</p>
            <a routerLink="/login" class="btn btn-borgona">Iniciar sesión</a>
          </div>
        } @else if (error) {
          <div class="text-center py-4">
            <i class="fas fa-exclamation-circle fa-4x text-danger mb-3"></i>
            <h5 class="text-danger">Enlace inválido o expirado</h5>
            <p class="text-muted mb-4">{{ error }}</p>
            <a routerLink="/registro" class="btn btn-outline-secondary me-2">Registrarse de nuevo</a>
            <a routerLink="/login" class="btn btn-borgona">Ir a iniciar sesión</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .verify-container {
      min-height: 70vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .verify-card {
      max-width: 420px;
      width: 100%;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      padding: 2rem;
    }
    .btn-borgona {
      background: var(--borgona, #800020);
      color: #fff;
      border: none;
    }
    .btn-borgona:hover {
      background: #a03040;
      color: #fff;
    }
  `]
})
export class VerificarEmailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  loading = true;
  done = false;
  error = '';

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading = false;
      this.error = 'No se encontró el token de verificación en la URL.';
      return;
    }

    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.loading = false;
        this.done = true;
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || err?.error?.detail || 'El enlace de verificación no es válido o ha expirado.';
        this.error = typeof msg === 'string' ? msg : 'Error al verificar. Intenta registrarte nuevamente.';
      }
    });
  }
}
