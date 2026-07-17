import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario } from './models/user';

interface LoginResponse {
  token: string;
}

export interface Registro1Request {
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  curp: string;
  rfc: string;
  fechaNacimiento: string; // yyyy-MM-dd
  genero: 'MASCULINO' | 'FEMENINO' | 'OTRO';
  nacionalidad: string;
  paisNacimiento: string;
  entidadFederativa: string;
  municipio: string;
  estadoCivil: 'SOLTERO' | 'CASADO' | 'DIVORCIADO' | 'VIUDO' | 'UNION_LIBRE';
  /** Tipo de perfil: INVESTIGADOR, INNOVADOR o HIBRIDO */
  tipoPerfil?: 'INVESTIGADOR' | 'INNOVADOR' | 'HIBRIDO';
}

export interface RegisterRequest {
  email: string;
  password: string;
  telefono: string;
  registro: Registro1Request;
}



export interface RegisterResponse {
  success: boolean;
  email: string;
  message: string;
  folioRegistro?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY  = 'auth_user';
  private readonly REMEMBER_TOKEN_KEY = 'remember_token';
  private readonly REMEMBER_EMAIL_KEY = 'remember_email';

  // Usuario en memoria (para header / app)
  readonly user$ = new BehaviorSubject<Usuario | null>(this.loadUser());

  // Estado de sesión reactivo (para header / guards)
  private readonly loggedInSubject = new BehaviorSubject<boolean>(this.hasToken());
  readonly loggedIn$ = this.loggedInSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ===== Helpers =====
  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }

  private loadUser(): Usuario | null {
    const raw = localStorage.getItem(this.USER_KEY);
    return raw ? (JSON.parse(raw) as Usuario) : null;
  }

  private setSession(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.loggedInSubject.next(true);
  }

  // ===== API =====
  isLoggedIn(): boolean {
    return this.hasToken();
  }

  login(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password })
      .pipe(tap(res => this.setSession(res.token)));
  }

  /** Paso 1 del login 2FA: solicitar código o login directo si tiene rememberToken */
  loginRequestCode(email: string, password: string) {
    const rememberToken = this.getRememberToken(email);
    return this.http.post<{
      requiresVerification: boolean;
      email: string;
      token?: string;
      rememberToken?: string;
    }>(
      `${environment.apiBaseUrl}/auth/login/request-code`,
      { email, password, rememberToken }
    ).pipe(
      tap(res => {
        if (!res.requiresVerification && res.token) {
          this.setSession(res.token);
          if (res.rememberToken) {
            this.saveRememberToken(email, res.rememberToken);
          }
        }
      })
    );
  }

  /** Paso 2 del login 2FA: verificar código y obtener token */
  loginVerifyCode(email: string, code: string, remember: boolean = false) {
    return this.http
      .post<{ token: string; rememberToken?: string }>(
        `${environment.apiBaseUrl}/auth/login/verify-code`,
        { email, code, remember }
      )
      .pipe(tap(res => {
        this.setSession(res.token);
        if (remember && res.rememberToken) {
          this.saveRememberToken(email, res.rememberToken);
        }
      }));
  }

  /** Paso 1 del login admin 2FA: solicitar código (siempre exige rol admin). */
  loginAdminRequestCode(email: string, password: string) {
    return this.http.post<{
      requiresVerification: boolean;
      email: string;
      token?: string;
      rememberToken?: string;
    }>(
      `${environment.apiBaseUrl}/auth/login/request-code`,
      { email, password, adminOnly: true }
    ).pipe(
      tap(res => {
        if (!res.requiresVerification && res.token) {
          this.setSession(res.token);
        }
      })
    );
  }

  /** Paso 2 del login admin 2FA: verificar código (siempre exige rol admin). */
  loginAdminVerifyCode(email: string, code: string) {
    return this.http
      .post<{ token: string }>(
        `${environment.apiBaseUrl}/auth/login/verify-code`,
        { email, code, remember: false, adminOnly: true }
      )
      .pipe(tap(res => this.setSession(res.token)));
  }

  private saveRememberToken(email: string, token: string): void {
    localStorage.setItem(this.REMEMBER_TOKEN_KEY, token);
    localStorage.setItem(this.REMEMBER_EMAIL_KEY, email.trim().toLowerCase());
  }

  private getRememberToken(email: string): string | null {
    const storedEmail = localStorage.getItem(this.REMEMBER_EMAIL_KEY);
    if (storedEmail === email.trim().toLowerCase()) {
      return localStorage.getItem(this.REMEMBER_TOKEN_KEY);
    }
    return null;
  }

  clearRememberToken(): void {
    localStorage.removeItem(this.REMEMBER_TOKEN_KEY);
    localStorage.removeItem(this.REMEMBER_EMAIL_KEY);
  }

  /** Login exclusivo para administradores (debe tener ROLE_ADMIN en backend). */
  loginAdmin(email: string, password: string) {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login-admin`, { email, password })
      .pipe(tap(res => this.setSession(res.token)));
  }

  /** Obtiene los roles del JWT actual (sin validar firma; solo para uso en guard). */
  getRolesFromToken(): string[] {
    const token = this.token;
    if (!token) return [];
    try {
      const payload = token.split('.')[1];
      if (!payload) return [];
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const json = JSON.parse(atob(base64));
      return Array.isArray(json.roles) ? json.roles : [];
    } catch {
      return [];
    }
  }

  isAdmin(): boolean {
    return this.hasRole('ROLE_ADMIN');
  }

  isEvaluador(): boolean {
    return this.hasRole('ROLE_EVALUADOR');
  }

  hasRole(role: string): boolean {
    return this.getRolesFromToken().includes(role);
  }

  /** Clave para guardar userId como fallback cuando me() no ha cargado aún (ej. servidor lento) */
  private readonly USER_ID_FALLBACK_KEY = 'auth_user_id_fallback';

  /** Registro: crea la cuenta y envía correo de verificación. No inicia sesión hasta que el usuario verifique su email. */
  register(payload: RegisterRequest) {
    return this.http.post<RegisterResponse>(`${environment.apiBaseUrl}/auth/register`, payload);
  }

  /** Verifica el correo del usuario mediante el token recibido por email. */
  verifyEmail(token: string) {
    return this.http.post<{ success: boolean; message: string }>(
      `${environment.apiBaseUrl}/auth/verify-email?token=${encodeURIComponent(token)}`,
      {}
    );
  }

  /** Obtiene userId del usuario actual (localStorage) o del fallback (registro reciente) */
  getStoredUserId(): number | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (raw) {
      try {
        const u = JSON.parse(raw) as Usuario;
        if (u?.id != null) return u.id;
      } catch { /* ignore */ }
    }
    const fallback = sessionStorage.getItem(this.USER_ID_FALLBACK_KEY);
    if (fallback) {
      const n = parseInt(fallback, 10);
      return isNaN(n) ? null : n;
    }
    return null;
  }


  me() {
    return this.http
      .get<Usuario>(`${environment.apiBaseUrl}/usuarios/me`)
      .pipe(
        tap(u => {
          this.user$.next(u);
          localStorage.setItem(this.USER_KEY, JSON.stringify(u));
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.USER_ID_FALLBACK_KEY);
    this.user$.next(null);
    this.loggedInSubject.next(false);
  }

  /** Cierra sesión y borra también el token de recuérdame. */
  logoutFull(): void {
    this.clearRememberToken();
    this.logout();
  }

  refreshUser(): void {
    this.me().subscribe();
  }

  // ===== Getters =====
  get token(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  get currentUser(): Usuario | null {
    return this.user$.value;
  }
}
