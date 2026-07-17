import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface FeriadoItem {
  id: number;
  fecha: string;
  nombre: string;
  activo: boolean;
}

@Component({
  selector: 'app-admin-feriados',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-feriados.component.html',
  styleUrls: ['./admin-feriados.component.css']
})
export class AdminFeriadosComponent implements OnInit {
  private readonly http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  items: FeriadoItem[] = [];
  filtro = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    this.http.get<FeriadoItem[]>(`${environment.apiBaseUrl}/admin/feriados`).subscribe({
      next: (data) => {
        this.items = (data || []).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar los feriados.';
        this.loading = false;
      }
    });
  }

  get filtrados(): FeriadoItem[] {
    const q = this.norm(this.filtro);
    return this.items.filter(x => !q || this.norm(`${x.nombre} ${x.fecha}`).includes(q));
  }

  crear(): void {
    Swal.fire({
      title: 'Nuevo feriado',
      html: `
        <div class="text-start">
          <label class="form-label small fw-semibold mb-1">Fecha</label>
          <input id="swal-feriado-fecha" type="date" class="swal2-input mt-0 mb-2" />
          <label class="form-label small fw-semibold mb-1">Nombre</label>
          <input id="swal-feriado-nombre" type="text" class="swal2-input mt-0 mb-2" maxlength="160" placeholder="Ej. Día de la Constitución" />
          <div class="form-check mt-2">
            <input id="swal-feriado-activo" class="form-check-input" type="checkbox" checked />
            <label class="form-check-label small" for="swal-feriado-activo">Activo</label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const fecha = (document.getElementById('swal-feriado-fecha') as HTMLInputElement | null)?.value?.trim();
        const nombre = (document.getElementById('swal-feriado-nombre') as HTMLInputElement | null)?.value?.trim();
        const activo = !!(document.getElementById('swal-feriado-activo') as HTMLInputElement | null)?.checked;
        if (!fecha) {
          Swal.showValidationMessage('La fecha es obligatoria');
          return false;
        }
        if (!nombre) {
          Swal.showValidationMessage('El nombre es obligatorio');
          return false;
        }
        return { fecha, nombre, activo };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      this.http.post<FeriadoItem>(`${environment.apiBaseUrl}/admin/feriados`, res.value).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Feriado guardado', confirmButtonColor: '#800020' });
        },
        error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo guardar.', confirmButtonColor: '#800020' })
      });
    });
  }

  editar(item: FeriadoItem): void {
    Swal.fire({
      title: 'Editar feriado',
      html: `
        <div class="text-start">
          <label class="form-label small fw-semibold mb-1">Fecha</label>
          <input id="swal-feriado-fecha" type="date" class="swal2-input mt-0 mb-2" value="${this.escape(item.fecha || '')}" />
          <label class="form-label small fw-semibold mb-1">Nombre</label>
          <input id="swal-feriado-nombre" type="text" class="swal2-input mt-0 mb-2" maxlength="160" value="${this.escape(item.nombre || '')}" />
          <div class="form-check mt-2">
            <input id="swal-feriado-activo" class="form-check-input" type="checkbox" ${item.activo ? 'checked' : ''} />
            <label class="form-check-label small" for="swal-feriado-activo">Activo</label>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Actualizar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const fecha = (document.getElementById('swal-feriado-fecha') as HTMLInputElement | null)?.value?.trim();
        const nombre = (document.getElementById('swal-feriado-nombre') as HTMLInputElement | null)?.value?.trim();
        const activo = !!(document.getElementById('swal-feriado-activo') as HTMLInputElement | null)?.checked;
        if (!fecha) {
          Swal.showValidationMessage('La fecha es obligatoria');
          return false;
        }
        if (!nombre) {
          Swal.showValidationMessage('El nombre es obligatorio');
          return false;
        }
        return { fecha, nombre, activo };
      }
    }).then((res) => {
      if (!res.isConfirmed || !res.value) return;
      this.http.patch<FeriadoItem>(`${environment.apiBaseUrl}/admin/feriados/${item.id}`, res.value).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Feriado actualizado', confirmButtonColor: '#800020' });
        },
        error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo actualizar.', confirmButtonColor: '#800020' })
      });
    });
  }

  eliminar(item: FeriadoItem): void {
    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar feriado?',
      text: `${item.nombre} (${item.fecha})`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#800020',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.http.delete(`${environment.apiBaseUrl}/admin/feriados/${item.id}`).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Eliminado', confirmButtonColor: '#800020' });
        },
        error: (err) => Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo eliminar.', confirmButtonColor: '#800020' })
      });
    });
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  private escape(value: string): string {
    return (value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
