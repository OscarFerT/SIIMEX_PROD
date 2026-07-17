import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';

interface FolioAprobado {
  folio: string;
  convocatoriaTitulo?: string | null;
  folioConvocatoria?: string | null;
  area?: string | null;
  fechaAprobacion?: string | null;
  estatus: string;
}

interface ConvocatoriaPublica {
  id: number;
  titulo: string;
  folioConvocatoria?: string | null;
  area?: string | null;
  totalAprobados: number;
}

interface FoliosResponse {
  total: number;
  fechaCorte?: string | null;
  convocatorias: ConvocatoriaPublica[];
  items: FolioAprobado[];
}

@Component({
  selector: 'app-folios-aprobados',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './folios-aprobados.component.html',
  styleUrls: ['./folios-aprobados.component.css']
})
export class FoliosAprobadosComponent implements OnInit {
  private http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  q = '';
  convocatoriaId = '';
  total = 0;
  fechaCorte: string | null = null;
  convocatorias: ConvocatoriaPublica[] = [];
  items: FolioAprobado[] = [];

  ngOnInit(): void {
    this.buscar();
  }

  buscar(): void {
    this.loading = true;
    this.error = null;
    let params = new HttpParams();
    if (this.q.trim()) params = params.set('q', this.q.trim());
    if (this.convocatoriaId) params = params.set('convocatoriaId', this.convocatoriaId);

    this.http.get<FoliosResponse>(`${environment.apiBaseUrl}/folios-aprobados`, { params }).subscribe({
      next: (res) => {
        this.total = Number(res?.total || 0);
        this.fechaCorte = res?.fechaCorte || null;
        this.convocatorias = res?.convocatorias || [];
        this.items = res?.items || [];
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo consultar el listado de folios aprobados.';
        this.items = [];
        this.loading = false;
      }
    });
  }

  limpiar(): void {
    this.q = '';
    this.convocatoriaId = '';
    this.buscar();
  }

  formatearFecha(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('es-MX', { dateStyle: 'medium' });
  }

  imprimir(): void {
    window.print();
  }
}
