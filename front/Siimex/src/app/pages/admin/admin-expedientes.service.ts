import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface ExportacionExpedientes {
  id: string;
  estado: 'EN_COLA' | 'PREPARANDO' | 'LISTO' | 'CANCELADO' | 'ERROR';
  porcentaje: number;
  totalUsuarios: number;
  usuariosProcesados: number;
  totalDocumentos: number;
  documentosProcesados: number;
  bytesProcesados: number;
  tamanoBytes: number;
  mensaje: string;
  nombreArchivo: string;
  caducaEn: string;
}

export interface SolicitudExpedientes {
  ids?: number[];
  busqueda?: string;
  perfil?: string;
  sexo?: string;
  entidad?: string;
  municipio?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminExpedientesService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/admin/registros/exportaciones`;

  iniciar(solicitud: SolicitudExpedientes) {
    return this.http.post<ExportacionExpedientes>(this.base, solicitud);
  }

  consultar(id: string) {
    return this.http.get<ExportacionExpedientes>(`${this.base}/${encodeURIComponent(id)}`);
  }

  actual() {
    return this.http.get<ExportacionExpedientes | null>(`${this.base}/actual`);
  }

  cancelar(id: string) {
    return this.http.delete<ExportacionExpedientes>(`${this.base}/${encodeURIComponent(id)}`);
  }

  autorizarDescarga(id: string) {
    return this.http.post(`${this.base}/${encodeURIComponent(id)}/preparar-descarga`, {}, { withCredentials: true });
  }

  urlDescarga(id: string): string {
    return `${this.base}/${encodeURIComponent(id)}/archivo`;
  }
}
