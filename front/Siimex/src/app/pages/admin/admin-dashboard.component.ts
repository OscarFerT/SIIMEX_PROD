import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';

export interface PuntoMes {
  mes: string;
  etiqueta: string;
  cantidad: number;
}

export interface DashboardStats {
  totalUsuarios: number;
  totalSolicitudes: number;
  investigadores: number;
  innovadores: number;
  hibridos: number;
  cuentasActivas: number;
  cuentasSuspendidas: number;
  registrosPorMes: PuntoMes[];
  actualizacionesPorMes: PuntoMes[];
  porTipoPerfil: Record<string, number>;
  porSexo: Record<string, number>;
  porModalidadConvocatoria: Record<string, number>;
  porTipoInves: Record<string, number>;
  porMunicipio: Record<string, number>;
  porInstitucion: Record<string, number>;
  porGradoAcademico: Record<string, number>;
}

interface PieItem {
  label: string;
  valor: number;
  porcentaje: number;
  color: string;
  muted?: boolean;
}

interface BarItem {
  label: string;
  valor: number;
}

interface ConvocatoriaOption {
  id: number;
  titulo?: string;
  folioConvocatoria?: string | null;
  vigente?: boolean;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private refreshSub?: Subscription;
  loading = true;
  error: string | null = null;
  stats: DashboardStats | null = null;
  convocatorias: ConvocatoriaOption[] = [];
  convocatoriaIdSeleccionada = '';
  private readonly sexoCategorias = ['HOMBRE', 'MUJER'];
  private readonly tipoCategorias = ['INV', 'HIB', 'INN'];

  ngOnInit(): void {
    this.loadConvocatorias();
    // Carga inicial + auto-refresh cada 60s.
    this.refreshSub = timer(0, 60000).subscribe(() => this.loadStats());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  private loadStats(): void {
    let params = new HttpParams();
    if (this.convocatoriaIdSeleccionada) {
      params = params.set('convocatoriaId', this.convocatoriaIdSeleccionada);
    }
    this.http.get<DashboardStats>(`${environment.apiBaseUrl}/admin/dashboard/stats`, { params }).subscribe({
      next: (data) => {
        this.stats = data;
        this.error = null;
        this.loading = false;
      },
      error: (err: { error?: { message?: string } }) => {
        this.error = err?.error?.message || 'No se pudieron cargar las estadísticas';
        this.loading = false;
      }
    });
  }

  private loadConvocatorias(): void {
    this.http.get<ConvocatoriaOption[]>(`${environment.apiBaseUrl}/admin/convocatorias`).subscribe({
      next: (items) => {
        this.convocatorias = (items || []).slice().sort((a, b) => {
          const ta = this.etiquetaConvocatoria(a).toLowerCase();
          const tb = this.etiquetaConvocatoria(b).toLowerCase();
          return ta.localeCompare(tb);
        });
      },
      error: () => {
        this.convocatorias = [];
      }
    });
  }

  onCambiarConvocatoria(): void {
    this.loading = true;
    this.loadStats();
  }

  get etiquetaConvocatoriaSeleccionada(): string {
    if (!this.convocatoriaIdSeleccionada) return 'General';
    const id = Number(this.convocatoriaIdSeleccionada);
    const c = this.convocatorias.find((it) => it.id === id);
    return c ? this.etiquetaConvocatoria(c) : `Convocatoria ${id}`;
  }

  get invCount(): number {
    return this.stats?.porTipoInves?.['INV'] ?? this.stats?.investigadores ?? 0;
  }

  get hibCount(): number {
    return this.stats?.porTipoInves?.['HIB'] ?? this.stats?.hibridos ?? 0;
  }

  barHeight(cantidad: number, max: number): number {
    return max > 0 ? (cantidad / max) * 100 : 0;
  }

  get maxActualizacionesMes(): number {
    if (!this.stats?.actualizacionesPorMes?.length) return 1;
    return Math.max(1, ...this.stats.actualizacionesPorMes.map((p) => p.cantidad));
  }

  // Pies
  get sexoPieData(): PieItem[] {
    return this.buildFixedPieData(this.sexoCategorias, this.normalizarMapaSexo(this.stats?.porSexo), ['#6a0032', '#2d7d46']);
  }

  get modalidadPieData(): PieItem[] {
    const data = this.buildPieData(this.stats?.porModalidadConvocatoria, ['#0d6efd', '#7c3aed', '#f59e0b', '#10b981', '#6b7280']);
    return data.length ? data : [{ label: 'SIN DATOS', valor: 0, porcentaje: 0, color: '#9ca3af', muted: true }];
  }

  get tipoInvesPieData(): PieItem[] {
    return this.buildFixedPieData(this.tipoCategorias, this.normalizarMapaTipoInves(this.stats?.porTipoInves), ['#6a0032', '#0d6efd', '#2d7d46']);
  }

  // Barras
  get municipioBarData(): BarItem[] {
    return this.mapToBarData(this.stats?.porMunicipio, 10);
  }

  get institucionBarData(): BarItem[] {
    return this.mapToBarData(this.stats?.porInstitucion, 10);
  }

  get gradoBarData(): BarItem[] {
    return this.mapToBarData(this.stats?.porGradoAcademico, 10);
  }

  get maxMunicipio(): number {
    return this.maxValue(this.municipioBarData);
  }

  get maxInstitucion(): number {
    return this.maxValue(this.institucionBarData);
  }

  get maxGrado(): number {
    return this.maxValue(this.gradoBarData);
  }

  donutGradient(items: PieItem[]): string {
    const total = items.reduce((acc, i) => acc + i.valor, 0);
    if (total <= 0) return 'conic-gradient(#e9ecef 0% 100%)';
    let start = 0;
    const parts = items
      .filter((i) => i.valor > 0)
      .map((i) => {
        const end = start + ((i.valor / total) * 100);
        const p = `${i.color} ${start}% ${end}%`;
        start = end;
        return p;
      });
    return parts.length ? `conic-gradient(${parts.join(', ')})` : 'conic-gradient(#e9ecef 0% 100%)';
  }

  pieTotal(items: PieItem[]): number {
    return items.reduce((acc, i) => acc + i.valor, 0);
  }

  hasPieData(items: PieItem[]): boolean {
    return items.some((i) => i.valor > 0);
  }

  formatLabel(label: string): string {
    const raw = (label || '').replace(/_/g, ' ').trim();
    if (!raw) return '—';
    if (/^(INV|HIB|INN|SNI|SNII|SIIMEX|CURP|RFC)$/i.test(raw)) return raw.toUpperCase();
    if (raw === raw.toUpperCase()) {
      return raw.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
    }
    return raw;
  }

  exportarExcelDashboard(): void {
    if (!this.stats) return;
    const rows: Array<Array<string | number>> = [];

    const pushMap = (categoria: string, map?: Record<string, number>) => {
      const entries = Object.entries(map || {});
      if (!entries.length) {
        rows.push([categoria, 'Sin datos', 0]);
        return;
      }
      for (const [key, value] of entries) {
        rows.push([categoria, this.formatLabel(key), Number(value || 0)]);
      }
    };

    rows.push(['KPIs', 'Total usuarios', this.stats.totalUsuarios || 0]);
    rows.push(['KPIs', 'Total solicitudes', this.stats.totalSolicitudes || 0]);
    rows.push(['Filtro', 'Convocatoria', this.etiquetaConvocatoriaSeleccionada]);
    rows.push(['KPIs', 'INV', this.invCount]);
    rows.push(['KPIs', 'HIB', this.hibCount]);
    rows.push(['KPIs', 'Cuentas activas', this.stats.cuentasActivas || 0]);
    rows.push(['KPIs', 'Cuentas suspendidas', this.stats.cuentasSuspendidas || 0]);

    pushMap('Sexo', this.stats.porSexo);
    pushMap('Modalidad convocatoria', this.stats.porModalidadConvocatoria);
    pushMap('Tipo INV/HIB/INN', this.stats.porTipoInves);
    pushMap('Municipio', this.stats.porMunicipio);
    pushMap('Institución', this.stats.porInstitucion);
    pushMap('Grado académico', this.stats.porGradoAcademico);

    (this.stats.actualizacionesPorMes || []).forEach((p) => rows.push(['Actualizaciones por mes', p.etiqueta, p.cantidad || 0]));

    exportRowsAsXlsx(['Categoría', 'Elemento', 'Cantidad'], rows, `dashboard_admin_${this.timestamp()}.xlsx`, 'Dashboard');
  }

  private buildPieData(source: Record<string, number> | null | undefined, palette: string[]): PieItem[] {
    const entries = Object.entries(source || {})
      .map(([label, valor]) => ({ label, valor: Number(valor || 0) }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);
    if (!entries.length) return [];
    const total = entries.reduce((acc, e) => acc + e.valor, 0) || 1;
    return entries.map((e, idx) => ({
      label: e.label,
      valor: e.valor,
      porcentaje: (e.valor / total) * 100,
      color: palette[idx % palette.length],
      muted: e.valor <= 0
    }));
  }

  private buildFixedPieData(
    categorias: string[],
    source: Record<string, number> | null | undefined,
    palette: string[]
  ): PieItem[] {
    const src = source || {};
    const entries = categorias.map((label, idx) => ({
      label,
      valor: Number(src[label] || 0),
      color: palette[idx % palette.length]
    }));
    const total = entries.reduce((acc, e) => acc + e.valor, 0) || 1;
    return entries.map((e) => ({
      label: e.label,
      valor: e.valor,
      porcentaje: (e.valor / total) * 100,
      color: e.color,
      muted: e.valor <= 0
    }));
  }

  private normalizarMapaSexo(source: Record<string, number> | null | undefined): Record<string, number> {
    const normalizado: Record<string, number> = {
      HOMBRE: 0,
      MUJER: 0
    };
    const entries = Object.entries(source || {});
    if (!entries.length) return normalizado;
    const keys = entries.map(([k]) => this.normalizarTexto(k));
    const tieneClaveH = keys.includes('H');
    const tieneClaveF = keys.includes('F');

    for (const [rawKey, rawValue] of entries) {
      const valor = Number(rawValue || 0);
      const key = this.normalizarTexto(rawKey);

      if (key.includes('MASCUL') || key.includes('HOMBRE') || key === 'H') {
        normalizado['HOMBRE'] += valor;
      } else if (key.includes('FEMEN') || key.includes('MUJER') || key === 'F') {
        normalizado['MUJER'] += valor;
      } else if (key === 'M') {
        // Soporta ambos convenios:
        // CURP: H(hombre)/M(mujer)  |  Catálogo común: M(masculino)/F(femenino)
        if (tieneClaveH && !tieneClaveF) {
          normalizado['MUJER'] += valor;
        } else {
          normalizado['HOMBRE'] += valor;
        }
      }
    }
    return normalizado;
  }

  private normalizarMapaTipoInves(source: Record<string, number> | null | undefined): Record<string, number> {
    const normalizado: Record<string, number> = {
      INV: 0,
      HIB: 0,
      INN: 0
    };

    const base = source && Object.keys(source).length
      ? source
      : {
          INV: this.stats?.investigadores ?? 0,
          HIB: this.stats?.hibridos ?? 0,
          INN: this.stats?.innovadores ?? 0
        };

    for (const [rawKey, rawValue] of Object.entries(base)) {
      const valor = Number(rawValue || 0);
      const key = this.normalizarTexto(rawKey);

      if (key === 'INV' || key.includes('INVESTIG')) {
        normalizado['INV'] += valor;
      } else if (key === 'HIB' || key.includes('HIBRID') || key.includes('MIXT')) {
        normalizado['HIB'] += valor;
      } else if (key === 'INN' || key === 'IND' || key.includes('INNOV')) {
        normalizado['INN'] += valor;
      }
    }

    return normalizado;
  }

  private normalizarTexto(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
  }

  private mapToBarData(source: Record<string, number> | null | undefined, limit = 10): BarItem[] {
    return Object.entries(source || {})
      .map(([label, valor]) => ({ label, valor: Number(valor || 0) }))
      .filter((it) => it.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, Math.max(1, limit));
  }

  private maxValue(items: BarItem[]): number {
    if (!items.length) return 1;
    return Math.max(1, ...items.map((i) => i.valor));
  }

  private timestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  }

  etiquetaConvocatoria(c: ConvocatoriaOption): string {
    const folio = (c.folioConvocatoria || '').trim();
    const titulo = (c.titulo || `Convocatoria ${c.id}`).trim();
    return folio ? `${folio} - ${titulo}` : titulo;
  }
}
