import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { NgForm } from '@angular/forms';
import { AdminEditarDatosComponent, DatosBasicosUsuario } from './admin-editar-datos.component';
import { AdminRegistrosComponent } from './admin-registros.component';
import { environment } from '../../../environments/environment';

describe('Correccion administrativa de datos basicos', () => {
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/admin/registros/1/datos-basicos`;
  const datos: DatosBasicosUsuario = { id: 1, nombre: 'Ana Cecilia', apellidoPaterno: 'Franco', apellidoMaterno: 'De la Rosa',
    email: 'persona@example.test', curp: 'FARA900101MMCRSN00', telefono: '7221000001', fechaNacimiento: '1990-01-01',
    genero: 'FEMENINO', entidadFederativa: 'Estado de Mexico', revision: 'a'.repeat(64) };
  const form = { invalid: false } as NgForm;
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AdminEditarDatosComponent, AdminRegistrosComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function abrir() {
    const fixture = TestBed.createComponent(AdminEditarDatosComponent);
    fixture.componentRef.setInput('usuarioId', 1);
    fixture.detectChanges();
    http.expectOne(url).flush(datos);
    fixture.detectChanges();
    return fixture;
  }

  it('abre un dialogo modal accesible con datos actuales sin permitir guardar sin cambios', () => {
    const fixture = abrir();
    expect(fixture.nativeElement.querySelector('dialog').open).toBeTrue();
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Editar datos');
    expect(fixture.componentInstance.datos?.email).toBe(datos.email);
    expect(fixture.componentInstance.hayCambios).toBeFalse();
    expect(fixture.nativeElement.querySelector('button[type=submit]').disabled).toBeTrue();
  });

  it('exige motivo y confirmacion y no manda roles ni estados ni contrasenas', () => {
    const c = abrir().componentInstance;
    c.datos!.email = '  CORREGIDO@example.test  ';
    c.guardar(form); http.expectNone(url);
    c.motivo = 'Correccion cotejada'; c.guardar(form); http.expectNone(url);
    c.confirmado = true;
    const emit = spyOn(c.guardado, 'emit');
    c.guardar(form);
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body.email).toBe('corregido@example.test');
    expect(request.request.body.revision).toBe(datos.revision);
    for (const key of ['id', 'roles', 'enabled', 'locked', 'password', 'passwordHash', 'visibilidadPerfil']) {
      expect(request.request.body[key]).toBeUndefined();
    }
    request.flush({ ...datos, email: 'corregido@example.test' });
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('evita doble envio y no permite cerrar durante el guardado', () => {
    const c = abrir().componentInstance;
    c.datos!.telefono = '7221000002'; c.motivo = 'Correccion'; c.confirmado = true;
    const cerrar = spyOn(c.cerrar, 'emit');
    c.guardar(form); c.guardar(form); c.cancelar();
    const request = http.expectOne(url);
    expect(cerrar).not.toHaveBeenCalled();
    request.flush(datos);
  });

  it('conserva el borrador ante duplicados para poder corregirlo', () => {
    const c = abrir().componentInstance;
    c.datos!.email = 'ocupado@example.test'; c.motivo = 'Correccion'; c.confirmado = true; c.guardar(form);
    http.expectOne(url).flush({ message: 'El correo ya esta registrado' }, { status: 409, statusText: 'Conflict' });
    expect(c.datos!.email).toBe('ocupado@example.test'); expect(c.guardando).toBeFalse(); expect(c.conflicto).toBeFalse();
    expect(c.error).toContain('correo');
  });

  it('rechaza un formulario invalido aunque tenga confirmacion', () => {
    const c = abrir().componentInstance;
    c.datos!.email = 'sin-correo'; c.motivo = 'Correccion'; c.confirmado = true;
    c.guardar({ invalid: true } as NgForm); http.expectNone(url);
  });

  it('bloquea un borrador desactualizado y permite recargar la revision actual', () => {
    const c = abrir().componentInstance;
    c.datos!.telefono = '7221000002'; c.motivo = 'Correccion'; c.confirmado = true; c.guardar(form);
    http.expectOne(url).flush({ message: 'El registro cambio' }, { status: 412, statusText: 'Precondition Failed' });
    expect(c.conflicto).toBeTrue(); c.guardar(form); http.expectNone(url);
    c.cargar(); http.expectOne(url).flush({ ...datos, revision: 'b'.repeat(64) });
    expect(c.conflicto).toBeFalse(); expect(c.confirmado).toBeFalse(); expect(c.datos!.revision).toBe('b'.repeat(64));
  });

  it('presenta errores de conexion y permite reintentar sin cerrar el modal', () => {
    const c = abrir().componentInstance;
    c.datos!.telefono = '7221000002'; c.motivo = 'Correccion'; c.confirmado = true; c.guardar(form);
    http.expectOne(url).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(c.error).toContain('No se pudieron guardar'); expect(c.datos!.telefono).toBe('7221000002');
    c.guardar(form); http.expectOne(url).flush(datos);
  });

  it('la barra solo abre el modal con usuario seleccionado y recarga la pagina tras guardar', () => {
    const c = TestBed.createComponent(AdminRegistrosComponent).componentInstance;
    c.editarDatosSeleccionado(); expect(c.editandoUsuarioId).toBeNull();
    c.registros = [{ id: 1, nombre: 'Ana', apellidoPaterno: 'Franco', apellidoMaterno: 'De la Rosa', email: datos.email }];
    c.usuarioSeleccionadoId = 1; c.editarDatosSeleccionado(); expect(c.editandoUsuarioId).toBe(1);
    expect(c.accionEnProceso).toBeTrue();
    const cargar = spyOn(c, 'cargarRegistros'); c.datosBasicosGuardados();
    expect(c.editandoUsuarioId).toBeNull(); expect(c.accionEnProceso).toBeFalse(); expect(cargar).toHaveBeenCalledTimes(1);
  });
});
