import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface FoliosRegistroResponse {
  investigador?: string;
  innovador?: string;
  hibrido?: string;
  defaults?: {
    investigador?: string;
    innovador?: string;
    hibrido?: string;
  };
}

@Component({
  selector: 'app-admin-configuracion-folios',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-configuracion-folios.component.html',
  styleUrls: ['./admin-configuracion-folios.component.css']
})
export class AdminConfiguracionFoliosComponent implements OnInit {
  private readonly http = inject(HttpClient);

  loading = true;
  saving = false;
  error: string | null = null;

  investigador = '';
  innovador = '';
  hibrido = '';

  defaults = {
    investigador: 'SIIMEX-INV',
    innovador: 'SIIMEX-IND',
    hibrido: 'SIIMEX-HIB'
  };

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    this.http.get<FoliosRegistroResponse>(`${environment.apiBaseUrl}/admin/configuracion/folios-registro`).subscribe({
      next: (data) => {
        this.investigador = (data?.investigador || '').trim();
        this.innovador = (data?.innovador || '').trim();
        this.hibrido = (data?.hibrido || '').trim();
        this.defaults = {
          investigador: (data?.defaults?.investigador || 'SIIMEX-INV').trim(),
          innovador: (data?.defaults?.innovador || 'SIIMEX-IND').trim(),
          hibrido: (data?.defaults?.hibrido || 'SIIMEX-HIB').trim()
        };
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo cargar la configuración de folios.';
        this.loading = false;
      }
    });
  }

  aplicarDefaults(): void {
    this.investigador = this.defaults.investigador;
    this.innovador = this.defaults.innovador;
    this.hibrido = this.defaults.hibrido;
  }

  guardar(): void {
    const payload = {
      investigador: this.sanitize(this.investigador),
      innovador: this.sanitize(this.innovador),
      hibrido: this.sanitize(this.hibrido)
    };

    if (!payload.investigador || !payload.innovador || !payload.hibrido) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos obligatorios',
        text: 'Debes capturar los tres prefijos de folio.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    this.saving = true;
    this.http.patch<FoliosRegistroResponse>(`${environment.apiBaseUrl}/admin/configuracion/folios-registro`, payload).subscribe({
      next: (data) => {
        this.saving = false;
        this.investigador = (data?.investigador || payload.investigador).trim();
        this.innovador = (data?.innovador || payload.innovador).trim();
        this.hibrido = (data?.hibrido || payload.hibrido).trim();
        Swal.fire({
          icon: 'success',
          title: 'Configuración actualizada',
          text: 'Los folios de registro quedaron guardados.',
          confirmButtonColor: '#800020'
        });
      },
      error: (err) => {
        this.saving = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'No se pudo guardar la configuración.',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  private sanitize(value: string): string {
    return (value || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');
  }
}
