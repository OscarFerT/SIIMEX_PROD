import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import Swal, { sanitizeHtml } from './safe-swal';
import { jwtInterceptor } from './jwt.interceptor';
import { environment } from '../../environments/environment';
import { CambiarContrasenaComponent } from '../pages/seguridad/cambiar-contrasena.component';
import { AdminPostulacionesComponent, PostulacionItem } from '../pages/admin/admin-postulaciones.component';

describe('Security regression', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CambiarContrasenaComponent, AdminPostulacionesComponent],
      providers: [provideHttpClient(withInterceptors([jwtInterceptor])), provideHttpClientTesting(), provideRouter([])]
    });
    http = TestBed.inject(HttpTestingController);
    localStorage.removeItem('auth_token');
  });
  afterEach(() => { http.verify(); Swal.close(); localStorage.removeItem('auth_token'); });

  it('sanitizes scripts, event handlers and dangerous URLs while preserving modal form fields', () => {
    const html = sanitizeHtml('<img src="data:," onerror="window.__audit=1"><script>window.__audit=1</script><a href="javascript:alert(1)">link</a><textarea id="notes">ok</textarea><input id="file" type="file">');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('textarea');
    expect(html).toContain('type="file"');
  });

  it('does not execute stored HTML in the actual administrator confirmation modal', done => {
    const fixture = TestBed.createComponent(AdminPostulacionesComponent);
    (window as any).__audit = 0;
    fixture.componentInstance.marcarRevisada({ id: 7, nombre: 'Ana <img src="data:," onerror="window.__audit=1">',
      correo: 'audit@example.test', estado: 'PENDIENTE' } as PostulacionItem);
    setTimeout(() => {
      expect((window as any).__audit).toBe(0);
      expect(Swal.getHtmlContainer()?.querySelector('[onerror]')).toBeNull();
      delete (window as any).__audit;
      done();
    }, 200);
  });

  it('requires an emailed code, binds it to the requested email and sends no identity-only reset', () => {
    const component = TestBed.createComponent(CambiarContrasenaComponent).componentInstance;
    component.email = 'audit@example.test';
    component.newPassword = component.confirmation = 'TestPassword123';
    component.submitResetPassword();
    http.expectNone(`${environment.apiBaseUrl}/auth/reset-password`);
    component.requestCode();
    const request = http.expectOne(`${environment.apiBaseUrl}/auth/reset-password/request-code`);
    expect(request.request.body).toEqual({ email: 'audit@example.test' });
    request.flush({ message: 'Si la cuenta esta activa, recibiras un codigo.' });
    component.code = '123456';
    expect(component.isFormValid()).toBeTrue();
    component.email = 'other@example.test';
    expect(component.isFormValid()).toBeFalse();
    component.email = 'audit@example.test';
    component.submitResetPassword();
    const reset = http.expectOne(`${environment.apiBaseUrl}/auth/reset-password`);
    expect(reset.request.body).toEqual({ email: 'audit@example.test', code: '123456', newPassword: 'TestPassword123' });
    reset.flush({ message: '<img src=x onerror="alert(1)">' }, { status: 401, statusText: 'Unauthorized' });
    expect(component.error()).toContain('img');
  });

  it('never attaches the session token to an unrelated server', () => {
    localStorage.setItem('auth_token', 'synthetic-token');
    TestBed.inject(HttpClient).get('https://unrelated.example.test/file').subscribe();
    const request = http.expectOne('https://unrelated.example.test/file');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });

  it('clears an existing browser session after a successful password reset', () => {
    spyOn(window, 'fetch').and.returnValue(Promise.resolve(new Response(null, { status: 204 })));
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: true, isDenied: false, isDismissed: false }));
    spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    const component = TestBed.createComponent(CambiarContrasenaComponent).componentInstance;
    component.email = 'audit@example.test';
    component.requestCode();
    http.expectOne(`${environment.apiBaseUrl}/auth/reset-password/request-code`).flush({ message: 'Codigo solicitado' });
    localStorage.setItem('auth_token', 'synthetic-token');
    component.code = '123456';
    component.newPassword = component.confirmation = 'TestPassword123';
    component.submitResetPassword();
    http.expectOne(`${environment.apiBaseUrl}/auth/reset-password`).flush({ success: true });
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(window.fetch).toHaveBeenCalled();
  });

  it('adds the CSRF request header and token only to API requests', () => {
    localStorage.setItem('auth_token', 'synthetic-token');
    TestBed.inject(HttpClient).post(`${environment.apiBaseUrl}/usuarios/me`, {}).subscribe();
    const request = http.expectOne(`${environment.apiBaseUrl}/usuarios/me`);
    expect(request.request.headers.get('X-SIIMEX-Request')).toBe('1');
    expect(request.request.headers.get('Authorization')).toBe('Bearer synthetic-token');
    request.flush({});
  });
});
