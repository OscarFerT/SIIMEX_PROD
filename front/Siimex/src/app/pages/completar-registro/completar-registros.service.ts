// src/app/usuario.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Registro1Response {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  rfc: string;
  fechaNacimiento: string; // yyyy-MM-dd
  genero: 'MASCULINO' | 'FEMENINO' | 'OTRO';
  paisNacimiento: string;
  entidadFederativa: string;
  nacionalidad: string;
  estadoCivil: 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'UNION_LIBRE';
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private apiUrl = `${environment.apiBaseUrl}/usuarios`;

  constructor(private http: HttpClient) { }

  obtenerUsuarios(): Observable<Registro1Response[]> {
    return this.http.get<Registro1Response[]>(this.apiUrl);
  }
}
