import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';

interface ConvocatoriaItem {
  id: number;
  titulo: string;
}

interface ReporteItem {
  id: number;
  postulante: string;
  correo: string;
  cedula?: string | null;
  curp?: string | null;
  telefono?: string | null;
  convocatoriaId: number;
  convocatoriaTitulo: string;
  area?: string | null;
  genero?: string | null;
  estado: string;
  compatibilidad: number;
  fechaCreacion?: string | null;
}

interface ReporteResumen {
  total: number;
  pendientes: number;
  subsanadas: number;
  aceptadas: number;
  rechazadas: number;
  promedioCompatibilidad: number;
}

@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reportes.component.html',
  styleUrls: ['./admin-reportes.component.css']
})
export class AdminReportesComponent implements OnInit {
  private http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  convocatorias: ConvocatoriaItem[] = [];
  items: ReporteItem[] = [];
  resumen: ReporteResumen = { total: 0, pendientes: 0, subsanadas: 0, aceptadas: 0, rechazadas: 0, promedioCompatibilidad: 0 };

  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  filtroConvocatoriaId = '';
  filtroEstado = '';
  filtroArea = '';
  filtroGenero = '';
  filtroQ = '';
  filtroFechaDesde = '';
  filtroFechaHasta = '';

  readonly GENEROS = [
    { value: 'MASCULINO', label: 'Masculino' },
    { value: 'FEMENINO', label: 'Femenino' },
    { value: 'OTRO', label: 'Otro' }
  ];

  readonly AREAS = [
    { value: 'energias', label: 'Energías' },
    { value: 'educacion', label: 'Educación' },
    { value: 'tecnologia', label: 'Tecnología' },
    { value: 'salud', label: 'Salud' },
    { value: 'medio-ambiente', label: 'Medio ambiente' },
    { value: 'otro', label: 'Otro' }
  ];

  ngOnInit(): void {
    this.cargarConvocatorias();
    this.buscar();
  }

  cargarConvocatorias(): void {
    this.http.get<ConvocatoriaItem[]>(`${environment.apiBaseUrl}/admin/convocatorias`).subscribe({
      next: (data) => this.convocatorias = data || [],
      error: () => this.convocatorias = []
    });
  }

  buscar(): void {
    this.loading = true;
    this.error = null;

    let params = new HttpParams();
    if (this.filtroConvocatoriaId) params = params.set('convocatoriaId', this.filtroConvocatoriaId);
    if (this.filtroEstado) params = params.set('estado', this.filtroEstado);
    if (this.filtroArea) params = params.set('area', this.filtroArea);
    if (this.filtroGenero) params = params.set('genero', this.filtroGenero);
    if (this.filtroQ.trim()) params = params.set('q', this.filtroQ.trim());
    if (this.filtroFechaDesde) params = params.set('fechaDesde', this.filtroFechaDesde);
    if (this.filtroFechaHasta) params = params.set('fechaHasta', this.filtroFechaHasta);

    this.http.get<{ resumen: ReporteResumen; items: ReporteItem[] }>(`${environment.apiBaseUrl}/admin/reportes/postulaciones`, { params }).subscribe({
      next: (res) => {
        this.resumen = res?.resumen || this.resumen;
        this.items = res?.items || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo obtener el reporte.';
        this.items = [];
        this.loading = false;
      }
    });
  }

  ordenar(col: string): void {
    if (this.sortColumn === col) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = col;
      this.sortDirection = 'asc';
    }
  }

  get itemsOrdenados(): ReporteItem[] {
    if (!this.sortColumn) return this.items;
    return [...this.items].sort((a, b) => {
      let va: string | number = (a as any)[this.sortColumn];
      let vb: string | number = (b as any)[this.sortColumn];
      if (this.sortColumn === 'id' || this.sortColumn === 'compatibilidad') {
        va = typeof va === 'number' ? va : 0;
        vb = typeof vb === 'number' ? vb : 0;
        return this.sortDirection === 'asc' ? va - vb : vb - va;
      }
      const sa = String(va ?? '').toLowerCase();
      const sb = String(vb ?? '').toLowerCase();
      const cmp = sa.localeCompare(sb);
      return this.sortDirection === 'asc' ? cmp : -cmp;
    });
  }

  getSortIcon(col: string): string {
    if (this.sortColumn !== col) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  getInicial(postulante: string): string {
    return (postulante || '?').trim().charAt(0).toUpperCase();
  }

  getCompatibilidadBarClass(porcentaje: number): string {
    if (porcentaje >= 70) return 'rep-compat-fill-high';
    if (porcentaje >= 40) return 'rep-compat-fill-medium';
    return 'rep-compat-fill-low';
  }

  getCompatibilidadTextClass(porcentaje: number): string {
    if (porcentaje >= 70) return 'text-success fw-bold';
    if (porcentaje >= 40) return 'text-warning fw-bold';
    return 'text-secondary';
  }

  getEstadoBadgeClass(estado: string): string {
    if (estado === 'ACEPTADA') return 'rep-badge-ok';
    if (estado === 'RECHAZADA') return 'rep-badge-no';
    if (estado === 'SUBSANADA') return 'rep-badge-info';
    return 'rep-badge-pend';
  }

  limpiarFiltros(): void {
    this.filtroConvocatoriaId = '';
    this.filtroEstado = '';
    this.filtroArea = '';
    this.filtroGenero = '';
    this.filtroQ = '';
    this.filtroFechaDesde = '';
    this.filtroFechaHasta = '';
    this.buscar();
  }

  exportarExcel(): void {
    const headers = ['ID', 'Postulante', 'Correo', 'Cedula', 'CURP', 'Telefono', 'Convocatoria', 'Area', 'Genero', 'Estado', 'Compatibilidad', 'Fecha'];
    const rows = this.items.map(i => [
      i.id,
      i.postulante,
      i.correo,
      i.cedula || '',
      i.curp || '',
      i.telefono || '',
      i.convocatoriaTitulo || '',
      i.area || '',
      this.formatearGenero(i.genero) || '',
      i.estado || '',
      `${i.compatibilidad ?? 0}%`,
      this.formatearFecha(i.fechaCreacion)
    ]);
    exportRowsAsXlsx(headers, rows, `reporte_postulaciones_${this.timestamp()}.xlsx`, 'Reportes');
  }

  exportarPdf(): void {
    const html = this.buildPrintableHtml();
    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  formatearGenero(g?: string | null): string {
    if (!g) return '';
    const map: Record<string, string> = { MASCULINO: 'Masculino', FEMENINO: 'Femenino', OTRO: 'Otro' };
    return map[g] || g;
  }

  formatearFecha(value?: string | null): string {
    if (!value) return '—';
    try {
      const d = new Date(value);
      return isNaN(d.getTime()) ? value : d.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return value;
    }
  }

  private timestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${`${d.getMonth() + 1}`.padStart(2, '0')}${`${d.getDate()}`.padStart(2, '0')}_${`${d.getHours()}`.padStart(2, '0')}${`${d.getMinutes()}`.padStart(2, '0')}`;
  }

  private descargarBlob(blob: Blob, nombre: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
  }

  private buildPrintableHtml(): string {
    const rows = this.items.map(i => `
      <tr>
        <td>${i.id}</td>
        <td>${this.html(i.postulante)}</td>
        <td>${this.html(i.correo)}</td>
        <td>${this.html(i.convocatoriaTitulo)}</td>
        <td>${this.html(i.area || '')}</td>
        <td>${this.html(this.formatearGenero(i.genero))}</td>
        <td>${this.html(i.estado)}</td>
        <td>${i.compatibilidad ?? 0}%</td>
        <td>${this.html(this.formatearFecha(i.fechaCreacion))}</td>
      </tr>
    `).join('');

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Reporte de postulaciones</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
    h1 { margin: 0 0 8px; color: #6a0032; }
    .meta { margin: 0 0 14px; color: #555; font-size: 12px; }
    .kpis { margin: 0 0 14px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
    th { background: #f3f4f6; }
  </style>
</head>
<body>
  <h1>Reporte de postulaciones</h1>
  <p class="meta">Generado: ${new Date().toLocaleString('es-MX')}</p>
  <p class="kpis">
    Total: <strong>${this.resumen.total}</strong> |
    Pendientes: <strong>${this.resumen.pendientes}</strong> |
    Aceptadas: <strong>${this.resumen.aceptadas}</strong> |
    Rechazadas: <strong>${this.resumen.rechazadas}</strong> |
    Compatibilidad promedio: <strong>${this.resumen.promedioCompatibilidad}%</strong>
  </p>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>Postulante</th><th>Correo</th><th>Convocatoria</th><th>Área</th><th>Género</th><th>Estado</th><th>Compat.</th><th>Fecha</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="9">Sin datos</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
  }

  private html(value: string): string {
    return (value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}


