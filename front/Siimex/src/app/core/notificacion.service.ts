import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Notificacion {
  id: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  leida: boolean;
  fechaCreacion: string;
  rutaLink: string | null;
}

@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private http = inject(HttpClient);
  private base = `${environment.apiBaseUrl}/notificaciones`;
  private adminBase = `${environment.apiBaseUrl}/admin/notificaciones`;

  private countSubject = new BehaviorSubject<number>(0);
  readonly count$ = this.countSubject.asObservable();

  private adminCountSubject = new BehaviorSubject<number>(0);
  readonly adminCount$ = this.adminCountSubject.asObservable();

  listar(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(this.base);
  }

  listarRecientes(limit = 12): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.base}/recientes`, {
      params: { limit: String(limit) }
    });
  }

  contarNoLeidas(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.base}/count`).pipe(
      tap(r => this.countSubject.next(r.count)),
      catchError(() => of({ count: 0 }))
    );
  }

  marcarLeida(id: number): Observable<any> {
    return this.http.patch(`${this.base}/${id}/leer`, {}).pipe(
      tap(() => {
        const c = this.countSubject.value;
        if (c > 0) this.countSubject.next(c - 1);
      })
    );
  }

  marcarTodasLeidas(): Observable<any> {
    return this.http.patch(`${this.base}/leer-todas`, {}).pipe(
      tap(() => this.countSubject.next(0))
    );
  }

  listarAdmin(): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(this.adminBase);
  }

  listarAdminRecientes(limit = 12): Observable<Notificacion[]> {
    return this.http.get<Notificacion[]>(`${this.adminBase}/recientes`, {
      params: { limit: String(limit) }
    });
  }

  contarNoLeidasAdmin(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${this.adminBase}/count`).pipe(
      tap(r => this.adminCountSubject.next(r.count)),
      catchError(() => of({ count: 0 }))
    );
  }

  marcarLeidaAdmin(id: number): Observable<any> {
    return this.http.patch(`${this.adminBase}/${id}/leer`, {}).pipe(
      tap(() => {
        const c = this.adminCountSubject.value;
        if (c > 0) this.adminCountSubject.next(c - 1);
      })
    );
  }

  marcarTodasLeidasAdmin(): Observable<any> {
    return this.http.patch(`${this.adminBase}/leer-todas`, {}).pipe(
      tap(() => this.adminCountSubject.next(0))
    );
  }
}
