import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { debounceTime } from 'rxjs/operators';

export interface Convocatoria {
  id: number;
  titulo: string;
  descripcion?: string | null;
  resumen?: string | null;
  requisitos?: string | null;
  fechaApertura?: string | null;
  fechaCierre: string;
  area?: string | null;
  keywords?: string | null;
  imagenUrl?: string | null;
  iconoUrl?: string | null;
  reglasConfigurables?: string | null;
  fechaPublicacion?: string | null;
  estadoPublicacion?: string | null;
  vigente: boolean;
}

interface ReglaConfigurable {
  clave: string;
  valor: string;
  descripcion?: string;
}

interface MiPostulacionResumen {
  id: number;
  convocatoriaId: number;
  estado: string;
  fechaCreacion?: string | null;
}

@Component({
  selector: 'app-convocatorias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './convocatorias.html',
  styleUrls: ['./convocatorias.css']
})
export class ConvocatoriasComponent implements OnInit, OnDestroy, AfterViewInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  @ViewChild('modalConv') modalConv!: ElementRef<HTMLElement>;

  form = this.fb.group({
    q: [''],
    area: ['']
  });

  loading = true;
  error: string | null = null;
  convocatorias: Convocatoria[] = [];
  convocatoriasFiltradas: Convocatoria[] = [];
  modalSeleccionada: Convocatoria | null = null;
  /** Mapa id convocatoria -> % compatibilidad */
  compatibilidadMap: Record<number, number> = {};
  /** Mapa id convocatoria -> resumen de mi postulación */
  misPostulacionesMap: Record<number, MiPostulacionResumen> = {};
  private modalInstance: any;
  private modalListeners: (() => void)[] = [];

  readonly ICONOS_POR_AREA: Record<string, string> = {
    energias: 'assets/img/solar-energy.png',
    educacion: 'assets/img/creative-education.png',
    tecnologia: 'assets/img/devops.png',
    salud: 'assets/img/devops.png',
    'medio-ambiente': 'assets/img/solar-energy.png',
    otro: 'assets/img/devops.png'
  };

  ngOnInit() {
    this.cargar();
    this.form.valueChanges.pipe(debounceTime(220), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.aplicarFiltro());
  }

  ngAfterViewInit() {
    this.setupModalListeners();
  }

  ngOnDestroy() {
    this.modalListeners.forEach(cleanup => cleanup());
    if (this.modalInstance) this.modalInstance.dispose?.();
  }

  cargar() {
    this.loading = true;
    this.error = null;
    this.http.get<Convocatoria[]>(`${environment.apiBaseUrl}/convocatorias`).subscribe({
      next: (data) => {
        this.convocatorias = data;
        this.aplicarFiltro();
        this.cargarCompatibilidades();
        this.cargarMisPostulaciones();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudieron cargar las convocatorias.';
        this.loading = false;
      }
    });
  }

  private cargarCompatibilidades(): void {
    this.convocatorias.forEach(c => {
      this.http.get<{ porcentaje: number }>(`${environment.apiBaseUrl}/convocatorias/${c.id}/compatibilidad`).subscribe({
        next: (res) => {
          this.compatibilidadMap = { ...this.compatibilidadMap, [c.id]: res.porcentaje };
        },
        error: () => {
          this.compatibilidadMap = { ...this.compatibilidadMap, [c.id]: 0 };
        }
      });
    });
  }

  private normalize(text: any) {
    return (text || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  getCompatibilidad(c: Convocatoria): number {
    return this.compatibilidadMap[c.id] ?? -1;
  }

  getMiEstado(c: Convocatoria | null): string | null {
    if (!c) return null;
    return this.misPostulacionesMap[c.id]?.estado ?? null;
  }

  yaPostule(c: Convocatoria | null): boolean {
    if (!c) return false;
    return !!this.misPostulacionesMap[c.id];
  }

  puedeEditarPostulacion(c: Convocatoria | null): boolean {
    const estado = this.getMiEstado(c);
    return estado === 'PENDIENTE' || estado === 'CON_OBSERVACIONES';
  }

  textoBotonPostulacion(c: Convocatoria | null): string {
    if (!c) return 'Postúlate';
    if (!this.yaPostule(c)) return 'Postúlate';
    const estado = this.getMiEstado(c);
    if (estado === 'CON_OBSERVACIONES') return 'Corregir postulación';
    return this.puedeEditarPostulacion(c) ? 'Editar postulación' : 'Ver postulación';
  }

  textoEstadoPostulacion(c: Convocatoria | null): string {
    const estado = this.getMiEstado(c);
    if (estado === 'PENDIENTE') return 'Ya postulaste (en revisión)';
    if (estado === 'CON_OBSERVACIONES') return 'Tu solicitud tiene observaciones';
    if (estado === 'SUBSANADA') return 'Solicitud subsanada (en revisión)';
    return 'Ya postulaste (' + (estado || 'registrada') + ')';
  }

  getPostulacionRoute(c: Convocatoria | null): any[] {
    if (!c) return ['/app/convocatorias'];
    return ['/app/postulacion', c.id];
  }

  getPostulacionQueryParams(c: Convocatoria | null): Record<string, string> | null {
    if (!this.puedeEditarPostulacion(c)) return null;
    return { editar: '1' };
  }

  aplicarFiltro() {
    const q = this.normalize(this.form.value.q);
    const area = (this.form.value.area || '').toString();
    this.convocatoriasFiltradas = this.convocatorias.filter((c) => {
      const keywords = this.normalize(c.keywords || c.titulo || c.descripcion || '');
      const cardArea = (c.area || '').toString().toLowerCase().replace(/\s+/g, '-');
      const textContent = this.normalize(`${c.titulo} ${c.descripcion} ${c.area} ${c.keywords}`);
      const matchesQuery = !q || keywords.includes(q) || textContent.includes(q);
      const matchesArea = !area || cardArea === area || (c.area || '').toLowerCase() === area;
      return matchesQuery && matchesArea;
    });
  }

  getIcono(c: Convocatoria): string {
    if (c.iconoUrl) return this.resolveMediaUrl(c.iconoUrl);
    const area = (c.area || 'otro').toLowerCase().replace(/\s+/g, '-');
    return this.ICONOS_POR_AREA[area] || this.ICONOS_POR_AREA['otro'];
  }

  getHeaderBackground(c: Convocatoria): string {
    const img = c.imagenUrl ? this.resolveMediaUrl(c.imagenUrl) : '';
    if (!img) return 'linear-gradient(135deg, var(--beige) 0%, #fff 100%)';
    return `linear-gradient(rgba(20,20,20,0.42), rgba(20,20,20,0.42)), url('${img}')`;
  }

  private resolveMediaUrl(url: string): string {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http')) return url;
    if (url.startsWith('/')) return url;
    return url.startsWith('assets/') ? url : '/' + url;
  }

  private cargarMisPostulaciones(): void {
    this.http.get<MiPostulacionResumen[]>(`${environment.apiBaseUrl}/postulaciones/mias`).subscribe({
      next: (items) => {
        const map: Record<number, MiPostulacionResumen> = {};
        (items || []).forEach((p) => {
          if (p?.convocatoriaId != null && map[p.convocatoriaId] == null) {
            map[p.convocatoriaId] = p;
          }
        });
        this.misPostulacionesMap = map;
      },
      error: () => {
        this.misPostulacionesMap = {};
      }
    });
  }

  formatearFecha(s: string | null | undefined): string {
    if (!s) return '—';
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return s;
    }
  }

  getRequisitosLista(requisitos: string | null | undefined): string[] {
    if (!requisitos?.trim()) return [];
    return requisitos
      .split(/[\n•\-]/)
      .map((r) => r.trim())
      .filter(Boolean);
  }

  /** Formatea requisitos como texto con saltos de línea (para cuando no es lista). */
  formatearRequisitosTexto(requisitos: string | null | undefined): string {
    if (!requisitos?.trim()) return '';
    return requisitos
      .replace(/\n/g, '<br>')
      .replace(/•/g, '• ');
  }

  getReglasConfigurables(reglasJson: string | null | undefined): ReglaConfigurable[] {
    if (!reglasJson?.trim()) return [];
    try {
      const arr = JSON.parse(reglasJson) as ReglaConfigurable[];
      return (Array.isArray(arr) ? arr : [])
        .map((r) => ({
          clave: (r?.clave || '').trim(),
          valor: (r?.valor || '').trim(),
          descripcion: (r?.descripcion || '').trim()
        }))
        .filter((r) => !!r.clave && !!r.valor);
    } catch {
      return [];
    }
  }

  async abrirModal(c: Convocatoria) {
    this.modalSeleccionada = c;
    await new Promise(resolve => setTimeout(resolve, 0)); // Esperar render del *ngIf
    const el = this.modalConv?.nativeElement;
    if (!el) return;
    if (el.parentElement !== document.body) document.body.appendChild(el);
    const { Modal } = await import('bootstrap');
    this.modalInstance = new Modal(el);
    (el as HTMLElement).style.zIndex = '1055';
    this.modalInstance.show();
    setTimeout(() => {
      (el as HTMLElement).style.zIndex = '1055';
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) (backdrop as HTMLElement).style.zIndex = '1040';
    }, 100);
  }

  cerrarModal() {
    if (this.modalInstance) this.modalInstance.hide();
    this.modalSeleccionada = null;
  }

  private setupModalListeners() {
    const el = this.modalConv?.nativeElement;
    if (!el) return;
    const hideHandler = () => {
      this.modalSeleccionada = null;
    };
    el.addEventListener('hidden.bs.modal', hideHandler);
    this.modalListeners.push(() => el.removeEventListener('hidden.bs.modal', hideHandler));
  }
}
