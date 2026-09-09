import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, of, shareReplay } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface PdfLimiteItem {
  key: string;
  modulo: string;
  seccion: string;
  descripcion: string;
  maxMb: number;
  defaultMb: number;
  maxBytes: number;
}

export interface PdfLimitesResponse {
  items: PdfLimiteItem[];
  defaultMb: number;
  minMb: number;
  maxMb: number;
}

const DEFAULT_MB = 2;
const DEFAULT_BYTES = DEFAULT_MB * 1024 * 1024;
const DEFAULT_PDF_LIMIT_ITEMS: PdfLimiteItem[] = [
  { key: 'registro.documentos', modulo: 'Registro inicial', seccion: 'Documentos oficiales', descripcion: 'INE, cedula profesional, domicilio y constancia SNII.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'registro.perfilAcademico', modulo: 'Completar registro', seccion: 'Perfil academico', descripcion: 'Titulo, cedula, constancias SNII y documentos probatorios academicos.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'registro.idiomas', modulo: 'Completar registro', seccion: 'Dominio de idiomas', descripcion: 'Certificados o comprobantes de idioma.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'registro.estancias', modulo: 'Completar registro', seccion: 'Estancias de investigacion', descripcion: 'Constancias de estancia o cartas institucionales.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'registro.divulgacion', modulo: 'Completar registro', seccion: 'Divulgacion', descripcion: 'Evidencias PDF de productos de divulgacion.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'perfil.documentos', modulo: 'Perfil', seccion: 'Documentos del perfil', descripcion: 'INE, cedula, CV/curriculum y constancias visibles desde perfil.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'perfil.certificaciones', modulo: 'Perfil', seccion: 'Certificaciones', descripcion: 'Certificaciones agregadas en trayectoria/perfil.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'perfil.propiedadIntelectual', modulo: 'Perfil', seccion: 'Propiedad intelectual', descripcion: 'Documentos adjuntos para propiedad intelectual.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'perfil.rubros', modulo: 'Perfil', seccion: 'Evidencias por rubro', descripcion: 'Evidencias generales agregadas desde los modales de trayectoria.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'postulacion.curriculum', modulo: 'Postulaciones', seccion: 'Curriculum de postulacion', descripcion: 'Curriculum adjunto al enviar una postulacion.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'postulacion.documentos', modulo: 'Postulaciones', seccion: 'Documentos requeridos', descripcion: 'Documentos configurables solicitados por convocatoria.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'postulacion.informes', modulo: 'Postulaciones', seccion: 'Informes', descripcion: 'Informes parcial y final.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'postulacion.reciboPago', modulo: 'Postulaciones', seccion: 'Recibo de pago', descripcion: 'Comprobante de recepcion del apoyo.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES },
  { key: 'evaluacion.documentos', modulo: 'Evaluacion', seccion: 'Documentos de evaluacion', descripcion: 'Cartas, dictamenes o constancias firmadas por evaluadores.', maxMb: DEFAULT_MB, defaultMb: DEFAULT_MB, maxBytes: DEFAULT_BYTES }
];

const DEFAULT_PDF_LIMIT_RESPONSE: PdfLimitesResponse = {
  items: DEFAULT_PDF_LIMIT_ITEMS,
  defaultMb: DEFAULT_MB,
  minMb: 1,
  maxMb: 25
};

@Injectable({ providedIn: 'root' })
export class PdfLimiteService {
  private readonly http = inject(HttpClient);
  private cache$?: Observable<PdfLimitesResponse>;

  obtenerLimitesPdf(force = false): Observable<PdfLimitesResponse> {
    if (!this.cache$ || force) {
      this.cache$ = this.http.get<PdfLimitesResponse>(`${environment.apiBaseUrl}/configuracion/limites-pdf`).pipe(
        catchError(() => of(DEFAULT_PDF_LIMIT_RESPONSE)),
        shareReplay(1)
      );
    }
    return this.cache$;
  }

  obtenerMapaLimites(force = false): Observable<Record<string, number>> {
    return this.obtenerLimitesPdf(force).pipe(
      map((data) => (data.items || []).reduce<Record<string, number>>((acc, item) => {
        acc[item.key] = Number(item.maxMb) || data.defaultMb || DEFAULT_MB;
        return acc;
      }, {}))
    );
  }

  guardarLimitesPdf(limites: Record<string, number>): Observable<PdfLimitesResponse> {
    this.cache$ = undefined;
    return this.http.patch<PdfLimitesResponse>(`${environment.apiBaseUrl}/admin/configuracion/limites-pdf`, { limites });
  }
}
