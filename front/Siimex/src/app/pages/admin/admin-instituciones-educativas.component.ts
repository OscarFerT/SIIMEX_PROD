import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';

interface InstitucionEducativaItem {
  id: number;
  cct?: string | null;
  nombre: string;
  domicilio?: string | null;
  colonia?: string | null;
  codigoPostal?: string | null;
  municipio?: string | null;
  entidadFederativa?: string | null;
  telefono?: string | null;
  director?: string | null;
  correo?: string | null;
  nivelEducativo?: string | null;
  estado: 'PENDIENTE_VALIDACION' | 'ACTIVA' | 'RECHAZADA';
  solicitudUsuarioId?: number | null;
}

@Component({
  selector: 'app-admin-instituciones-educativas',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-instituciones-educativas.component.html',
  styleUrls: ['./admin-instituciones-educativas.component.css']
})
export class AdminInstitucionesEducativasComponent implements OnInit {
  private readonly http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  items: InstitucionEducativaItem[] = [];
  filtro = '';

  guardando = false;
  editandoId: number | null = null;
  form: any = this.nuevoForm();

  ngOnInit(): void {
    this.cargar();
  }

  private nuevoForm() {
    return {
      cct: '',
      nombre: '',
      domicilio: '',
      colonia: '',
      codigoPostal: '',
      municipio: '',
      entidadFederativa: '',
      telefono: '',
      director: '',
      correo: '',
      nivelEducativo: '',
      estado: 'PENDIENTE_VALIDACION'
    };
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    this.http.get<InstitucionEducativaItem[]>(`${environment.apiBaseUrl}/admin/instituciones-educativas`).subscribe({
      next: (data) => {
        this.items = (data || []);
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo cargar el catálogo de instituciones.';
        this.loading = false;
      }
    });
  }

  get filtrados(): InstitucionEducativaItem[] {
    const q = this.norm(this.filtro);
    return this.items.filter(i => {
      const text = this.norm(`${i.cct || ''} ${i.nombre || ''} ${i.municipio || ''} ${i.entidadFederativa || ''} ${i.estado || ''}`);
      return !q || text.includes(q);
    });
  }

  abrirNuevo(): void {
    this.editandoId = null;
    this.form = this.nuevoForm();
  }

  editar(item: InstitucionEducativaItem): void {
    this.editandoId = item.id;
    this.form = {
      cct: item.cct || '',
      nombre: item.nombre || '',
      domicilio: item.domicilio || '',
      colonia: item.colonia || '',
      codigoPostal: item.codigoPostal || '',
      municipio: item.municipio || '',
      entidadFederativa: item.entidadFederativa || '',
      telefono: item.telefono || '',
      director: item.director || '',
      correo: item.correo || '',
      nivelEducativo: item.nivelEducativo || '',
      estado: item.estado || 'PENDIENTE_VALIDACION'
    };
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.form = this.nuevoForm();
  }

  guardar(): void {
    if (this.guardando) return;
    if (!this.form?.nombre?.trim()) {
      Swal.fire({ icon: 'warning', title: 'Nombre requerido', text: 'Captura el nombre de la institución.', confirmButtonColor: '#800020' });
      return;
    }

    const payload = {
      cct: this.form.cct?.trim() || null,
      nombre: this.form.nombre?.trim() || null,
      domicilio: this.form.domicilio?.trim() || null,
      colonia: this.form.colonia?.trim() || null,
      codigoPostal: this.form.codigoPostal?.trim() || null,
      municipio: this.form.municipio?.trim() || null,
      entidadFederativa: this.form.entidadFederativa?.trim() || null,
      telefono: this.form.telefono?.trim() || null,
      director: this.form.director?.trim() || null,
      correo: this.form.correo?.trim() || null,
      nivelEducativo: this.form.nivelEducativo?.trim() || null,
      estado: this.form.estado || 'PENDIENTE_VALIDACION'
    };

    this.guardando = true;
    const req = this.editandoId
      ? this.http.patch(`${environment.apiBaseUrl}/admin/instituciones-educativas/${this.editandoId}`, payload)
      : this.http.post(`${environment.apiBaseUrl}/admin/instituciones-educativas`, payload);
    req.subscribe({
      next: () => {
        this.guardando = false;
        this.cancelarEdicion();
        this.cargar();
        Swal.fire({ icon: 'success', title: 'Guardado', text: 'La institución se guardó correctamente.', confirmButtonColor: '#800020' });
      },
      error: (err) => {
        this.guardando = false;
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo guardar la institución.', confirmButtonColor: '#800020' });
      }
    });
  }

  eliminar(item: InstitucionEducativaItem): void {
    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar institución?',
      text: item.nombre,
      showCancelButton: true,
      confirmButtonColor: '#800020',
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.http.delete(`${environment.apiBaseUrl}/admin/instituciones-educativas/${item.id}`).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Eliminada', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo eliminar.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  descargarPlantilla(): void {
    this.http.get(`${environment.apiBaseUrl}/admin/instituciones-educativas/plantilla`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'plantilla_instituciones_educativas.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar la plantilla.', confirmButtonColor: '#800020' });
      }
    });
  }

  importarArchivo(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    this.http.post<any>(`${environment.apiBaseUrl}/admin/instituciones-educativas/importar`, fd).subscribe({
      next: (res) => {
        this.cargar();
        const errores = Array.isArray(res?.errores) ? res.errores : [];
        const detalleErrores = errores.length ? `<br><br><small>${errores.slice(0, 8).join('<br>')}</small>` : '';
        Swal.fire({
          icon: errores.length ? 'warning' : 'success',
          title: 'Importación finalizada',
          html: `Creadas: <b>${res?.creadas || 0}</b><br>Actualizadas: <b>${res?.actualizadas || 0}</b><br>Ignoradas: <b>${res?.ignoradas || 0}</b>${detalleErrores}`,
          confirmButtonColor: '#800020'
        });
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo importar el archivo.', confirmButtonColor: '#800020' });
      },
      complete: () => {
        input.value = '';
      }
    });
  }

  estadoLabel(value: string | null | undefined): string {
    if (value === 'ACTIVA') return 'Activa';
    if (value === 'RECHAZADA') return 'Rechazada';
    return 'Pendiente';
  }

  estadoBadge(value: string | null | undefined): string {
    if (value === 'ACTIVA') return 'bg-success';
    if (value === 'RECHAZADA') return 'bg-danger';
    return 'bg-warning text-dark';
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
}
