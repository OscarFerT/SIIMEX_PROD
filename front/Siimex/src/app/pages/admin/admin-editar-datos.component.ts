import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DatosBasicosUsuario {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  email: string;
  curp: string;
  telefono: string;
  fechaNacimiento: string;
  genero: string;
  entidadFederativa: string;
  revision: string;
}

@Component({
  selector: 'app-admin-editar-datos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-editar-datos.component.html',
  styleUrl: './admin-editar-datos.component.css'
})
export class AdminEditarDatosComponent implements OnInit, AfterViewInit, OnDestroy {
  private http = inject(HttpClient);
  @Input({ required: true }) usuarioId!: number;
  @Output() cerrar = new EventEmitter<void>();
  @Output() guardado = new EventEmitter<void>();
  @ViewChild('dialogo', { static: true }) dialogo!: ElementRef<HTMLDialogElement>;
  datos: DatosBasicosUsuario | null = null;
  originales: DatosBasicosUsuario | null = null;
  motivo = '';
  confirmado = false;
  cargando = true;
  guardando = false;
  error: string | null = null;
  conflicto = false;
  private solicitud?: Subscription;

  ngOnInit(): void { this.cargar(); }
  ngAfterViewInit(): void { this.dialogo.nativeElement.showModal(); }
  ngOnDestroy(): void {
    this.solicitud?.unsubscribe();
    this.dialogo.nativeElement.close();
  }

  cargar(): void {
    if (this.guardando) return;
    this.solicitud?.unsubscribe();
    this.cargando = true;
    this.error = null;
    this.conflicto = false;
    this.datos = null;
    this.confirmado = false;
    this.motivo = '';
    this.solicitud = this.http.get<DatosBasicosUsuario>(this.url).subscribe({
      next: datos => { this.datos = { ...datos }; this.originales = { ...datos }; this.cargando = false; },
      error: err => { this.error = err?.error?.message || 'No se pudieron cargar los datos.'; this.cargando = false; }
    });
  }

  get hayCambios(): boolean {
    if (!this.datos || !this.originales) return false;
    const actual = this.normalizados();
    return Object.keys(actual).some(key => key !== 'revision' && key !== 'id'
      && actual[key as keyof DatosBasicosUsuario] !== this.originales![key as keyof DatosBasicosUsuario]);
  }

  guardar(form: NgForm): void {
    if (!this.datos || this.guardando || form.invalid || !this.confirmado || !this.motivo.trim()
      || !this.hayCambios || this.conflicto) return;
    this.guardando = true;
    this.error = null;
    const { id: _id, ...datos } = this.normalizados();
    this.solicitud = this.http.patch<DatosBasicosUsuario>(this.url, { ...datos, motivo: this.motivo.trim() }).subscribe({
      next: () => { this.guardando = false; this.guardado.emit(); },
      error: err => {
        this.guardando = false;
        this.conflicto = err.status === 412;
        const errores = err?.error?.errors as Record<string, string> | undefined;
        this.error = errores ? Object.values(errores).join('. ') : err?.error?.message || 'No se pudieron guardar los cambios. Intenta nuevamente.';
      }
    });
  }

  cancelar(event?: Event): void {
    event?.preventDefault();
    if (!this.guardando) this.cerrar.emit();
  }

  private get url(): string { return `${environment.apiBaseUrl}/admin/registros/${this.usuarioId}/datos-basicos`; }
  private normalizados(): DatosBasicosUsuario {
    const d = this.datos!;
    return { ...d, nombre: d.nombre.trim(), apellidoPaterno: d.apellidoPaterno.trim(), apellidoMaterno: d.apellidoMaterno.trim(),
      email: d.email.trim().toLowerCase(), curp: d.curp.trim().toUpperCase(), telefono: d.telefono.trim(), entidadFederativa: d.entidadFederativa.trim() };
  }
}
