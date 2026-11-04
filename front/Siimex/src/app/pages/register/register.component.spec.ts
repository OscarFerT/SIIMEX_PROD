import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NEVER } from 'rxjs';
import Swal from '../../core/safe-swal';
import { AuthService } from '../../core/auth.service';
import { RegisterComponent } from './register.component';
import { environment } from '../../../environments/environment';

describe('Registro con apellidos compuestos', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let component: RegisterComponent;
  let http: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;

  function llenar(paterno = 'Franco', materno = 'De la Rosa', letras = 'FARA') {
    component.form.setValue({
      nombre: 'Ana Cecilia', apellidoPaterno: paterno, apellidoMaterno: materno, fechaNacimiento: '1990-01-01',
      tipoPerfil: 'INVESTIGADOR', email: 'prueba.curp@example.test', confirmCorreo: 'prueba.curp@example.test',
      nacionalidad: 'MEXICANA', estadoCivil: 'SOLTERO', telefono: '7221000000', curp: letras + '900101MMCRSN00',
      rfc: letras + '900101ABC', genero: 'FEMENINO', password: 'ClavePrueba123', confirmPassword: 'ClavePrueba123'
    });
  }

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['register']);
    auth.register.and.returnValue(NEVER);
    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations(),
        { provide: AuthService, useValue: auth }]
    });
    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: false } as any));
    fixture.detectChanges();
    http.expectOne(`${environment.apiBaseUrl}/catalogos/nacionalidades`).flush([{ clave: 'MEX', nombre: 'MEXICANA' }]);
  });

  afterEach(() => http.verify());

  it('envia DE LA ROSA completo sin quitar particulas ni modificar la CURP', () => {
    llenar();
    expect(component.form.valid).toBeTrue();
    component.submit();
    const payload = auth.register.calls.mostRecent().args[0];
    expect(payload.registro.apellidoMaterno).toBe('DE LA ROSA');
    expect(payload.registro.apellidoPaterno).toBe('FRANCO');
    expect(payload.registro.curp).toBe('FARA900101MMCRSN00');
  });

  it('conserva apellidos compuestos en ambos campos, incluidos acentos', () => {
    llenar('Del R\u00edo', 'De los Santos', 'RISA');
    expect(component.form.valid).toBeTrue();
    component.submit();
    const registro = auth.register.calls.mostRecent().args[0].registro;
    expect(registro.apellidoPaterno).toBe('DEL R\u00cdO');
    expect(registro.apellidoMaterno).toBe('DE LOS SANTOS');
  });

  it('sigue bloqueando fechas distintas en RFC y CURP', () => {
    llenar();
    component.f.rfc.setValue('FARA900102ABC');
    expect(component.form.hasError('rfcCurpMismatch')).toBeTrue();
    component.submit();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('sigue rechazando una CURP con formato incorrecto', () => {
    llenar();
    component.f.curp.setValue('FARA900101MMCRSN0!');
    expect(component.f.curp.hasError('curp')).toBeTrue();
    component.submit();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('explica que los apellidos se capturan completos en ambos campos', () => {
    const view: HTMLElement = fixture.nativeElement;
    expect(view.querySelector('#ayudaApellidos')?.textContent).toContain('De la Rosa');
    expect(view.querySelector('#apPat')?.getAttribute('aria-describedby')).toBe('ayudaApellidos');
    expect(view.querySelector('#apMat')?.getAttribute('aria-describedby')).toBe('ayudaApellidos');
  });
});
