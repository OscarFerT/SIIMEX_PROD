import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../environments/environment';
import { exportRowsAsXlsx } from '../../shared/utils/xlsx.utils';

interface ConvocatoriaItem {
  id: number;
  titulo: string;
}

interface PadronItem {
  id: number;
  folio: string;
  beneficiario: string;
  correo?: string | null;
  curp?: string | null;
  telefono?: string | null;
  celular?: string | null;
  tipoIdentificacionOficial?: string | null;
  identificacionOficial?: string | null;
  calle?: string | null;
  numeroExterior?: string | null;
  numeroInterior?: string | null;
  entreCalle?: string | null;
  yCalle?: string | null;
  otraReferencia?: string | null;
  colonia?: string | null;
  claveLocalidad?: string | null;
  localidad?: string | null;
  claveMunicipio?: string | null;
  municipioDomicilio?: string | null;
  claveEntidadFederativa?: string | null;
  codigoPostal?: string | null;
  claveAgeb?: string | null;
  claveRedSocial?: string | null;
  redSocial?: string | null;
  convocatoriaTitulo: string;
  folioConvocatoria?: string | null;
  area?: string | null;
  estadoSolicitud?: string | null;
  estadoComite?: string | null;
  apellidoPaterno?: string | null;
  apellidoMaterno?: string | null;
  nombres?: string | null;
  tipoBeneficiario?: string | null;
  fechaAlta?: string | null;
  fechaActualizacion?: string | null;
  fechaNacimiento?: string | null;
  genero?: string | null;
  estadoCivil?: string | null;
  gradoEstudios?: string | null;
  nacionalidad?: string | null;
  entidadNacimiento?: string | null;
  municipio?: string | null;
  tipoInstitucionClave?: string | null;
  tipoInstitucion?: string | null;
  institucion?: string | null;
  montoApoyoAsignado?: number | null;
  estadoEntregaApoyo?: string | null;
  fechaEntregaApoyo?: string | null;
  estadoReciboPago?: string | null;
  estadoCotejo?: string | null;
  estadoInforme?: string | null;
  fechaAprobacion?: string | null;
}

@Component({
  selector: 'app-admin-padron',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-padron.component.html',
  styleUrls: ['./admin-reportes.component.css']
})
export class AdminPadronComponent implements OnInit {
  private http = inject(HttpClient);

  loading = true;
  error: string | null = null;
  convocatorias: ConvocatoriaItem[] = [];
  items: PadronItem[] = [];
  total = 0;
  montoTotalAprobado = 0;
  apoyosEntregados = 0;
  recibosValidados = 0;
  filtroConvocatoriaId = '';
  filtroQ = '';

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
    if (this.filtroQ.trim()) params = params.set('q', this.filtroQ.trim());

    this.http.get<{ resumen: { total: number; montoTotalAprobado: number }; items: PadronItem[] }>(
      `${environment.apiBaseUrl}/admin/reportes/padron-beneficiarios`,
      { params }
    ).subscribe({
      next: (res) => {
        this.items = res?.items || [];
        this.total = res?.resumen?.total || 0;
        this.montoTotalAprobado = Number(res?.resumen?.montoTotalAprobado || 0);
        this.apoyosEntregados = Number((res?.resumen as any)?.apoyosEntregados || 0);
        this.recibosValidados = Number((res?.resumen as any)?.recibosValidados || 0);
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'No se pudo obtener el padrón de beneficiarios.';
        this.items = [];
        this.loading = false;
      }
    });
  }

  limpiarFiltros(): void {
    this.filtroConvocatoriaId = '';
    this.filtroQ = '';
    this.buscar();
  }

  exportarExcel(): void {
    const headers = ['Folio', 'Beneficiario', 'Correo', 'CURP', 'Telefono', 'Convocatoria', 'Folio convocatoria', 'Area', 'Monto', 'Entrega apoyo', 'Fecha entrega', 'Recibo pago', 'Cotejo', 'Informes', 'Fecha aprobacion'];
    const rows = this.items.map(i => [
      i.folio,
      i.beneficiario,
      i.correo || '',
      i.curp || '',
      i.telefono || '',
      i.convocatoriaTitulo || '',
      i.folioConvocatoria || '',
      i.area || '',
      i.montoApoyoAsignado ?? '',
      i.estadoEntregaApoyo || '',
      this.formatearFecha(i.fechaEntregaApoyo),
      i.estadoReciboPago || '',
      i.estadoCotejo || '',
      i.estadoInforme || '',
      this.formatearFecha(i.fechaAprobacion)
    ]);
    exportRowsAsXlsx(headers, rows, `padron_beneficiarios_${this.timestamp()}.xlsx`, 'Padron');
  }

  exportarExcelMachoteDicyfrh(): void {
    const headers = [
      'FOLIO_RELACIONADO',
      'TP_BENEFICIARIO',
      'CT_PARENTESCO',
      'FECHA_ALTA',
      'FECHA_ACTUALIZACION',
      'PRIMER_AP',
      'SEGUNDO_AP',
      'NOMBRES',
      'FECHA_NACIMIENTO',
      'GENERO',
      'CT_EDO_CIVIL',
      'CT_GDO_ESTUDIOS',
      'TP_ID_OFICIAL',
      'ID_OFICIAL',
      'CT_NACIONALIDAD',
      'CT_ENT_NAC',
      'CURP',
      'CALLE',
      'NUM_EXT',
      'NUM_INT',
      'ENTRE_CALLE',
      'Y_CALLE',
      'OTRA_REFERENCIA',
      'COLONIA',
      'CT_LOCALIDAD',
      'LOCALIDAD',
      'CT_MUNICIPIO',
      'CT_ENTIDAD_FEDERATIVA',
      'CODIGO_POSTAL',
      'CT_AGEB',
      'TELEFONO',
      'CELULAR',
      'E_MAIL',
      'CT_RED_SOCIAL',
      'RED_SOCIAL',
      'CT_TIP_INSTITUCION',
      'TIPO DE INSTITUCION'
    ];
    const rows = this.items.map(i => [
      i.folio || '',
      i.tipoBeneficiario || '',
      '',
      this.fechaIso(i.fechaAlta),
      this.fechaIso(i.fechaActualizacion),
      i.apellidoPaterno || '',
      i.apellidoMaterno || '',
      i.nombres || this.extraerNombres(i.beneficiario),
      this.fechaIso(i.fechaNacimiento),
      i.genero || '',
      i.estadoCivil || '',
      i.gradoEstudios || '',
      i.tipoIdentificacionOficial || '',
      i.identificacionOficial || '',
      i.nacionalidad || '',
      i.entidadNacimiento || '',
      i.curp || '',
      i.calle || '',
      i.numeroExterior || '',
      i.numeroInterior || '',
      i.entreCalle || '',
      i.yCalle || '',
      i.otraReferencia || '',
      i.colonia || '',
      i.claveLocalidad || '',
      i.localidad || '',
      i.claveMunicipio || i.municipioDomicilio || '',
      i.claveEntidadFederativa || i.entidadNacimiento || '',
      i.codigoPostal || '',
      i.claveAgeb || '',
      i.telefono || '',
      i.celular || i.telefono || '',
      i.correo || '',
      i.claveRedSocial || '',
      i.redSocial || '',
      i.tipoInstitucionClave || '',
      i.tipoInstitucion || ''
    ]);
    exportRowsAsXlsx(headers, rows, `METADATOS_DICyFRH_padron_${this.timestamp()}.xlsx`, 'ConcentradoRevision');
  }

  formatearFecha(value?: string | null): string {
    if (!value) return '-';
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : d.toLocaleDateString('es-MX', { dateStyle: 'medium' });
  }

  formatearMoneda(value?: number | null): string {
    return Number(value || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  }

  private timestamp(): string {
    const d = new Date();
    return `${d.getFullYear()}${`${d.getMonth() + 1}`.padStart(2, '0')}${`${d.getDate()}`.padStart(2, '0')}`;
  }

  private fechaIso(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toISOString().slice(0, 10);
  }

  private extraerNombres(nombreCompleto?: string | null): string {
    const partes = (nombreCompleto || '').trim().split(/\s+/).filter(Boolean);
    if (partes.length <= 2) return nombreCompleto || '';
    return partes.slice(0, Math.max(1, partes.length - 2)).join(' ');
  }
}
