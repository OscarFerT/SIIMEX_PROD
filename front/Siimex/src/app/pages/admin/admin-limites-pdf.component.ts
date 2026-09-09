import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { PdfLimiteItem, PdfLimiteService } from '../../core/pdf-limite.service';

@Component({
  selector: 'app-admin-limites-pdf',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-limites-pdf.component.html',
  styleUrls: ['./admin-limites-pdf.component.css']
})
export class AdminLimitesPdfComponent implements OnInit {
  private readonly pdfLimiteService = inject(PdfLimiteService);

  loading = true;
  saving = false;
  error: string | null = null;
  items: PdfLimiteItem[] = [];
  limites: Record<string, number> = {};
  defaultMb = 2;
  minMb = 1;
  maxMb = 25;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.loading = true;
    this.error = null;
    this.pdfLimiteService.obtenerLimitesPdf(true).subscribe({
      next: (data) => {
        this.items = data.items || [];
        this.defaultMb = data.defaultMb || 2;
        this.minMb = data.minMb || 1;
        this.maxMb = data.maxMb || 25;
        this.limites = this.items.reduce<Record<string, number>>((acc, item) => {
          acc[item.key] = Number(item.maxMb) || this.defaultMb;
          return acc;
        }, {});
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo cargar la configuración de límites PDF.';
        this.loading = false;
      }
    });
  }

  guardar(): void {
    const payload: Record<string, number> = {};
    for (const item of this.items) {
      const value = Number(this.limites[item.key]);
      if (!Number.isInteger(value) || value < this.minMb || value > this.maxMb) {
        Swal.fire({
          icon: 'warning',
          title: 'Revisa el límite',
          text: `${item.seccion} debe estar entre ${this.minMb} y ${this.maxMb} MB.`,
          confirmButtonColor: '#800020'
        });
        return;
      }
      payload[item.key] = value;
    }

    this.saving = true;
    this.pdfLimiteService.guardarLimitesPdf(payload).subscribe({
      next: (data) => {
        this.saving = false;
        this.items = data.items || this.items;
        this.limites = this.items.reduce<Record<string, number>>((acc, item) => {
          acc[item.key] = Number(item.maxMb) || this.defaultMb;
          return acc;
        }, {});
        Swal.fire({
          icon: 'success',
          title: 'Límites actualizados',
          text: 'Los tamaños máximos para documentos PDF quedaron guardados.',
          confirmButtonColor: '#800020'
        });
      },
      error: (err) => {
        this.saving = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err?.error?.message || 'No se pudieron guardar los límites PDF.',
          confirmButtonColor: '#800020'
        });
      }
    });
  }

  restaurarSugeridos(): void {
    for (const item of this.items) {
      this.limites[item.key] = item.defaultMb || this.defaultMb;
    }
  }

  grupos(): string[] {
    return Array.from(new Set(this.items.map(item => item.modulo)));
  }

  itemsPorGrupo(grupo: string): PdfLimiteItem[] {
    return this.items.filter(item => item.modulo === grupo);
  }
}