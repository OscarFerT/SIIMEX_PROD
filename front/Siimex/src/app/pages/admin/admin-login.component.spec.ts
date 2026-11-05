import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { AdminLoginComponent } from './admin-login.component';

describe('Acceso administrativo y errores de produccion', () => {
  let auth: jasmine.SpyObj<AuthService>;
  beforeEach(() => {
    auth = jasmine.createSpyObj('AuthService', ['isLoggedIn','isAdmin','loginAdminRequestCode','loginAdminVerifyCode','me','logout']);
    auth.isLoggedIn.and.returnValue(false);
    TestBed.configureTestingModule({ imports: [AdminLoginComponent], providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  });
  function componente() {
    const fixture = TestBed.createComponent(AdminLoginComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({email:'admin@example.test',password:'synthetic-only'});
    return fixture;
  }

  it('no presenta un 500 HTML como contrasena incorrecta', () => {
    const f = componente();
    auth.loginAdminRequestCode.and.returnValue(throwError(() => new HttpErrorResponse({status:500,error:'<html>Internal error</html>'})));
    f.componentInstance.submitStep1(); f.detectChanges();
    expect(f.componentInstance.loading).toBeFalse();
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('servidor');
    expect(f.componentInstance.errorMsg).toContain('500');
    expect(f.componentInstance.errorMsg).not.toContain('Credenciales invalidas');
    expect(f.nativeElement.querySelector('html')).toBeNull();
  });

  it('muestra errores tambien en el segundo paso del codigo', () => {
    const f = componente(), c = f.componentInstance;
    c.step=2; c.pendingEmail='admin@example.test'; c.codeForm.setValue({code:'123456'});
    auth.loginAdminVerifyCode.and.returnValue(throwError(() => new HttpErrorResponse({status:500,error:'proxy error'})));
    c.submitStep2(); f.detectChanges();
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('500');
    expect(c.step).toBe(2);
  });

  it('conserva los rechazos 401 y 403 y no otorga permisos para corregir errores', () => {
    for(const status of [401,403]) {
      const c=componente().componentInstance;
      auth.loginAdminRequestCode.and.returnValue(throwError(() => new HttpErrorResponse({status,error:{message:'Acceso denegado'}})));
      c.submitStep1(); expect(c.errorMsg).toBe('Acceso denegado'); expect(c.step).toBe(1);
    }
    expect(auth.loginAdminVerifyCode).not.toHaveBeenCalled(); expect(auth.me).not.toHaveBeenCalled();
  });

  it('distingue una falla de conexion y no envia dos veces mientras esta cargando', () => {
    const c=componente().componentInstance;
    c.loading=true; c.submitStep1(); expect(auth.loginAdminRequestCode).not.toHaveBeenCalled();
    c.loading=false;
    auth.loginAdminRequestCode.and.returnValue(throwError(() => new HttpErrorResponse({status:0,error:'network'})));
    c.submitStep1(); expect(c.errorMsg).toContain('conectar'); expect(c.loading).toBeFalse();
  });

  it('informa cuando la sesion existe pero falta un modulo del panel', async () => {
    auth.isLoggedIn.and.returnValue(true); auth.isAdmin.and.returnValue(true);
    spyOn(TestBed.inject(Router),'navigateByUrl').and.returnValue(Promise.reject(new Error('error loading dynamically imported module')));
    const f=componente(); await f.whenStable(); f.detectChanges();
    expect(f.componentInstance.errorMsg).toContain('Ctrl+F5');
    expect(f.nativeElement.querySelector('[role=alert]').textContent).toContain('archivos del panel');
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
