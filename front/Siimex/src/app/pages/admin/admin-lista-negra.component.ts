import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';
import { environment } from '../../../environments/environment';
import { exportRowsAsXlsx, readFirstSheetAsRows } from '../../shared/utils/xlsx.utils';

interface ListaNegraItem {
  id: number;
  usuarioId?: number | null;
  nombre?: string | null;
  email?: string | null;
  curp?: string | null;
  motivo: string;
  tipoSancion?: string | null;
  tipoSancionLabel?: string | null;
  nombrePrograma?: string | null;
  folioReferencia?: string | null;
  nombreReferencia?: string | null;
  fechaInicio: string;
  fechaFin?: string | null;
  activa: boolean;
}

interface RegistroLookupItem {
  id: number;
  nombre: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  email?: string | null;
  curp?: string;
}

@Component({
  selector: 'app-admin-lista-negra',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-lista-negra.component.html',
  styleUrls: ['./admin-lista-negra.component.css']
})
export class AdminListaNegraComponent implements OnInit {
  private readonly http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  modalSancionVisible = false;
  filtro = '';
  soloActivas = true;

  items: ListaNegraItem[] = [];
  registros: RegistroLookupItem[] = [];
  importRows: Array<{ nombrePrograma: string; folioReferencia: string; nombreReferencia: string; curp: string; motivo: string }> = [];
  importResumen: string | null = null;
  importando = false;

  form: {
    usuarioId: string;
    email: string;
    curp: string;
    motivo: string;
    tipoSancion: 'ANIO' | 'DEFINITIVO' | 'REEMBOLSO';
    nombrePrograma: string;
    folioReferencia: string;
    nombreReferencia: string;
  } = {
    usuarioId: '',
    email: '',
    curp: '',
    motivo: '',
    tipoSancion: 'ANIO',
    nombrePrograma: '',
    folioReferencia: '',
    nombreReferencia: ''
  };

  ngOnInit(): void {
    this.cargarRegistros();
    this.cargar();
  }

  cargarRegistros(): void {
    this.http.get<RegistroLookupItem[]>(`${environment.apiBaseUrl}/admin/registros`).subscribe({
      next: (data) => {
        this.registros = data || [];
      },
      error: () => {
        this.registros = [];
      }
    });
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    const params = this.soloActivas ? '?soloActivas=true' : '?soloActivas=false';
    this.http.get<ListaNegraItem[]>(`${environment.apiBaseUrl}/admin/lista-negra${params}`).subscribe({
      next: (data) => {
        this.items = data || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo cargar la lista negra.';
        this.loading = false;
      }
    });
  }

  abrirModalSancion(): void {
    this.form = {
      usuarioId: '',
      email: '',
      curp: '',
      motivo: '',
      tipoSancion: 'ANIO',
      nombrePrograma: '',
      folioReferencia: '',
      nombreReferencia: ''
    };
    this.importRows = [];
    this.importResumen = null;
    this.modalSancionVisible = true;
  }

  cerrarModalSancion(): void {
    this.modalSancionVisible = false;
  }

  get filtrados(): ListaNegraItem[] {
    const q = this.norm(this.filtro);
    return this.items.filter(i => {
      const txt = this.norm(`${i.nombre || ''} ${i.email || ''} ${i.curp || ''} ${i.motivo || ''} ${i.fechaFin || ''}`);
      return !q || txt.includes(q);
    });
  }

  get registrosFiltrados(): RegistroLookupItem[] {
    const term = this.norm(this.form.usuarioId);
    if (!term) return this.registros.slice(0, 30);
    return this.registros
      .filter(r => this.norm(`${r.id} ${this.nombreRegistro(r)} ${r.email || ''} ${r.curp || ''}`).includes(term))
      .slice(0, 30);
  }

  get registrosOrdenados(): RegistroLookupItem[] {
    return [...(this.registros || [])]
      .sort((a, b) => {
        const an = this.nombreRegistro(a);
        const bn = this.nombreRegistro(b);
        return an.localeCompare(bn, 'es', { sensitivity: 'base' });
      });
  }

  onUsuarioSeleccionado(value: string): void {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) return;
    const registro = this.registros.find((r) => r.id === id);
    if (!registro) return;
    this.form.email = registro.email || '';
    this.form.curp = (registro.curp || '').toUpperCase();
    this.form.nombreReferencia = this.nombreRegistro(registro);
  }

  sancionar(): void {
    if (!this.form.motivo.trim()) {
      Swal.fire({ icon: 'warning', title: 'Motivo requerido', text: 'Captura el motivo de la sanción.', confirmButtonColor: '#800020' });
      return;
    }
    const usuarioIdNum = Number(this.form.usuarioId);
    const payload: any = {
      motivo: this.form.motivo.trim(),
      tipoSancion: this.form.tipoSancion,
      nombrePrograma: this.form.nombrePrograma.trim() || null,
      folioReferencia: this.form.folioReferencia.trim() || null,
      nombreReferencia: this.form.nombreReferencia.trim() || null
    };
    if (Number.isFinite(usuarioIdNum) && usuarioIdNum > 0) {
      payload.usuarioId = usuarioIdNum;
    }
    if (this.form.email.trim()) payload.email = this.form.email.trim();
    if (this.form.curp.trim()) payload.curp = this.form.curp.trim().toUpperCase();
    if (!payload.usuarioId && !payload.email && !payload.curp) {
      Swal.fire({
        icon: 'warning',
        title: 'Identificador requerido',
        text: 'Captura usuario ID, correo o CURP para aplicar la sanción.',
        confirmButtonColor: '#800020'
      });
      return;
    }

    this.http.post<ListaNegraItem>(`${environment.apiBaseUrl}/admin/lista-negra/sancionar`, payload).subscribe({
      next: () => {
        this.form = {
          usuarioId: '',
          email: '',
          curp: '',
          motivo: '',
          tipoSancion: 'ANIO',
          nombrePrograma: '',
          folioReferencia: '',
          nombreReferencia: ''
        };
        this.cargar();
        this.cerrarModalSancion();
        Swal.fire({ icon: 'success', title: 'Sanción registrada', confirmButtonColor: '#800020' });
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo registrar la sanción.', confirmButtonColor: '#800020' });
      }
    });
  }

  levantar(item: ListaNegraItem): void {
    if (!item.activa) return;
    Swal.fire({
      icon: 'question',
      title: '¿Levantar sanción?',
      text: `Registro #${item.id}`,
      showCancelButton: true,
      confirmButtonText: 'Sí, levantar',
      confirmButtonColor: '#7A1E48',
      cancelButtonText: 'Cancelar'
    }).then((res) => {
      if (!res.isConfirmed) return;
      this.http.post(`${environment.apiBaseUrl}/admin/lista-negra/${item.id}/levantar`, {}).subscribe({
        next: () => {
          this.cargar();
          Swal.fire({ icon: 'success', title: 'Sanción levantada', confirmButtonColor: '#800020' });
        },
        error: (err) => {
          Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.message || 'No se pudo levantar la sanción.', confirmButtonColor: '#800020' });
        }
      });
    });
  }

  nombreRegistro(r: RegistroLookupItem): string {
    return `${r.nombre || ''} ${r.apellidoPaterno || ''} ${r.apellidoMaterno || ''}`.trim();
  }

  abrirSelectorImportacion(): void {
    const input = document.getElementById('archivoImportListaNegra') as HTMLInputElement | null;
    if (!input) return;
    input.value = '';
    input.click();
  }

  procesarArchivoImportacion(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    const fileName = (file.name || '').toLowerCase();
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      readFirstSheetAsRows(file)
        .then((sheetRows) => {
          this.importRows = this.parseRowsFromGrid(sheetRows);
          this.mostrarResumenImportacion();
        })
        .catch(() => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo leer el archivo Excel seleccionado.', confirmButtonColor: '#800020' });
        });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      this.importRows = this.parseCsvRows(text);
      this.mostrarResumenImportacion();
    };
    reader.onerror = () => {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo leer el archivo seleccionado.', confirmButtonColor: '#800020' });
    };
    reader.readAsText(file, 'utf-8');
  }

  descargarPlantillaExcel(): void {
    const headers = ['nombre_programa', 'folio', 'nombre', 'curp', 'motivo_sancion'];
    const ejemplo = ['Programa ejemplo', 'FOL-001', 'Nombre completo', 'ABCD000101HDFRRL09', 'Motivo de sanción'];
    exportRowsAsXlsx(headers, [ejemplo], 'plantilla_lista_negra.xlsx', 'Plantilla Lista Negra');
  }

  importarPlantilla(): void {
    if (this.importRows.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos',
        text: 'Primero carga un archivo con la plantilla.',
        confirmButtonColor: '#800020'
      });
      return;
    }
    this.importando = true;
    this.http.post<any>(`${environment.apiBaseUrl}/admin/lista-negra/importar`, {
      tipoSancion: this.form.tipoSancion,
      rows: this.importRows
    }).subscribe({
      next: (resp) => {
        this.importando = false;
        this.cargar();
        const importados = Number(resp?.importados || 0);
        const erroresCount = Number(resp?.erroresCount || 0);
        this.importResumen = `Importados: ${importados} | Errores: ${erroresCount}`;
        Swal.fire({
          icon: erroresCount > 0 ? 'warning' : 'success',
          title: erroresCount > 0 ? 'Importación parcial' : 'Importación completada',
          text: `Importados: ${importados}. Errores: ${erroresCount}.`,
          confirmButtonColor: '#800020'
        });
      },
      error: (err) => {
        this.importando = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'No se pudo importar la plantilla.',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  private parseCsvRows(content: string): Array<{ nombrePrograma: string; folioReferencia: string; nombreReferencia: string; curp: string; motivo: string }> {
    const lines = (content || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !!l);
    if (lines.length <= 1) return [];

    const header = this.parseCsvLine(lines[0]).map((h) => this.normHeader(h));
    const grid: string[][] = [header];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      grid.push(cols);
    }
    return this.parseRowsFromGrid(grid, true);
  }

  private parseRowsFromGrid(
    gridRows: string[][],
    headerAlreadyNormalized = false
  ): Array<{ nombrePrograma: string; folioReferencia: string; nombreReferencia: string; curp: string; motivo: string }> {
    if (!gridRows || gridRows.length <= 1) return [];
    const header = (gridRows[0] || []).map((h) => headerAlreadyNormalized ? (h || '').trim() : this.normHeader(h));
    const idxPrograma = header.indexOf('nombre_programa');
    const idxFolio = header.indexOf('folio');
    const idxNombre = header.indexOf('nombre');
    const idxCurp = header.indexOf('curp');
    const idxMotivo = header.indexOf('motivo_sancion');
    if (idxCurp < 0 || idxMotivo < 0) {
      return [];
    }

    const parsedRows: Array<{ nombrePrograma: string; folioReferencia: string; nombreReferencia: string; curp: string; motivo: string }> = [];
    for (let i = 1; i < gridRows.length; i++) {
      const cols = gridRows[i] || [];
      if (cols.every((c) => !(c || '').trim())) continue;
      const curp = (cols[idxCurp] || '').trim().toUpperCase();
      const motivo = (cols[idxMotivo] || '').trim();
      if (!curp || !motivo) continue;
      parsedRows.push({
        nombrePrograma: idxPrograma >= 0 ? (cols[idxPrograma] || '').trim() : '',
        folioReferencia: idxFolio >= 0 ? (cols[idxFolio] || '').trim() : '',
        nombreReferencia: idxNombre >= 0 ? (cols[idxNombre] || '').trim() : '',
        curp,
        motivo
      });
    }
    return parsedRows;
  }

  private mostrarResumenImportacion(): void {
    this.importResumen = `Filas válidas cargadas: ${this.importRows.length}`;
    if (this.importRows.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin filas válidas',
        text: 'La plantilla no contiene filas válidas para importar.',
        confirmButtonColor: '#800020'
      });
    }
  }

  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  private normHeader(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .trim();
  }

  private norm(value: string): string {
    return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }
}
