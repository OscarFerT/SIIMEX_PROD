import { Component, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.css'],
})
export class LandingComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  isLoggedIn = computed(() => this.auth.isLoggedIn());

  ngOnInit(): void {
    this.verificarRegistroIncompleto();
  }

  private verificarRegistroIncompleto(): void {
    if (!this.auth.isLoggedIn() || this.auth.isAdmin()) return;

    const user = this.auth.currentUser;
    if (user && user.registro2Completo && !user.tienePerfilMigracion) {
      const yaAvisado = sessionStorage.getItem('_aviso_registro_incompleto');
      if (yaAvisado) return;

      sessionStorage.setItem('_aviso_registro_incompleto', '1');

      setTimeout(() => {
        Swal.fire({
          icon: 'warning',
          title: 'Completa tu registro',
          html: `
            <p style="font-size:0.95rem;color:#444;">
              Tu <strong>perfil único SIIMEX</strong> aún no está completo.
              Completarlo te permitirá acceder a convocatorias y todas las funcionalidades.
            </p>
          `,
          confirmButtonText: '<i class="fas fa-edit me-1"></i> Completar ahora',
          cancelButtonText: 'Recordarme después',
          showCancelButton: true,
          confirmButtonColor: '#800020',
          cancelButtonColor: '#6c757d',
          allowOutsideClick: true
        }).then((result) => {
          if (result.isConfirmed) {
            this.router.navigateByUrl('/completarRegistro');
          }
        });
      }, 500);
    }
  }
}
