import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminRegistrosComponent } from './admin-registros.component';
import { environment } from '../../../environments/environment';
import Swal from '../../core/safe-swal';
import { ExportacionExpedientes } from './admin-expedientes.service';

describe('Admin registros: 1400 usuarios con paginacion en servidor', () => {
  let component: AdminRegistrosComponent;
  let fixture: ComponentFixture<AdminRegistrosComponent>;
  let http: HttpTestingController;
  const url = `${environment.apiBaseUrl}/admin/registros/paginado`;
  const zipUrl = `${environment.apiBaseUrl}/admin/registros/exportaciones`;
  const zipId = '12345678-1234-1234-1234-123456789012';
  const estadoZip = (estado: ExportacionExpedientes['estado'] = 'PREPARANDO', porcentaje = 25): ExportacionExpedientes => ({
    id: zipId, estado, porcentaje, totalUsuarios: 1400, usuariosProcesados: 350, totalDocumentos: 1400,
    documentosProcesados: 350, bytesProcesados: 1000, tamanoBytes: 10000, mensaje: estado === 'LISTO' ? 'ZIP listo' : 'Preparando expedientes',
    nombreArchivo: 'expedientes.zip', caducaEn: '2026-12-01T12:00:00Z'
  });

  function aceptarZip() {
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: true } as any));
  }
  const users = Array.from({ length: 1400 }, (_, i) => ({
    id: i + 1, nombre: `Persona ${i + 1}`, apellidoPaterno: 'Apellido', apellidoMaterno: 'Prueba',
    email: `prueba${i + 1}@example.test`, tipoPerfil: 'INVESTIGADOR', roles: ['ROLE_USER']
  }));

  function respond(page = 0, filtered = users, size = 10, options = true) {
    const request = http.expectOne(r => r.url === url && r.params.get('page') === String(page));
    expect(request.request.params.get('size')).toBe(String(size));
    request.flush({
      content: filtered.slice(page * size, (page + 1) * size), page, size,
      totalElements: filtered.length, totalPages: Math.ceil(filtered.length / size), totalRegistros: 1400,
      ...(options ? { entidades: ['Mexico', 'Puebla'], municipios: ['Toluca', 'Municipio remoto'] } : {})
    });
    return request;
  }

  beforeEach(() => {
    sessionStorage.removeItem('siimex_admin_exportacion');
    TestBed.configureTestingModule({
      imports: [AdminRegistrosComponent], providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    fixture = TestBed.createComponent(AdminRegistrosComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    component.ngOnDestroy();
    sessionStorage.removeItem('siimex_admin_exportacion');
    http.verify();
  });

  it('pide solo 10 usuarios y calcula las 140 paginas', () => {
    component.ngOnInit();
    const req = respond();
    expect(req.request.params.get('incluirOpciones')).toBe('true');
    expect(component.registros.length).toBe(10);
    expect(component.totalFiltrados).toBe(1400);
    expect(component.totalPaginasRegistros).toBe(140);
    expect(component.registroInicioVisible).toBe(1);
    expect(component.registroFinVisible).toBe(10);
    http.expectNone(`${environment.apiBaseUrl}/admin/registros`);
  });

  it('renderiza 10 filas y controles para cambiar entre las 140 paginas', () => {
    fixture.detectChanges();
    respond();
    fixture.detectChanges();
    const view: HTMLElement = fixture.nativeElement;
    expect(view.querySelectorAll('.registro-row').length).toBe(10);
    expect(view.querySelector('.registros-page-summary')?.textContent).toContain('de 140');
    const next = Array.from(view.querySelectorAll<HTMLButtonElement>('.registros-page-btn'))
      .find(button => button.textContent?.includes('Siguiente'))!;
    next.click();
    respond(1);
    fixture.detectChanges();
    expect(view.querySelector('.registro-row')?.textContent).toContain('Persona 11');
    expect(view.querySelectorAll('.registro-row').length).toBe(10);
    expect(view.querySelector('.registros-page-summary')?.textContent).toContain('2 de 140');
  });

  it('pide el detalle usando el ID de la fila seleccionada en otra pagina', () => {
    component.ngOnInit();
    respond();
    component.cambiarPagina(139);
    respond(139);
    component.seleccionarUsuario(component.registros[9]);
    component.verDetalleSeleccionado();
    http.expectOne(`${environment.apiBaseUrl}/admin/registros/1400`).flush(users[1399]);
    expect(component.detalle?.id).toBe(1400);
  });

  it('recorre todas las paginas sin repetir ni omitir usuarios', () => {
    component.ngOnInit();
    respond();
    const ids = component.registros.map(r => r.id);
    component.seleccionarUsuario(component.registros[0]);
    for (let page = 1; page < 140; page++) {
      component.cambiarPagina(page);
      expect(component.usuarioSeleccionado).toBeNull();
      respond(page, users, 10, false);
      ids.push(...component.registros.map(r => r.id));
      expect(component.registros.length).toBe(10);
    }
    expect(ids).toEqual(users.map(r => r.id));
    expect(component.registroInicioVisible).toBe(1391);
    expect(component.registroFinVisible).toBe(1400);
    expect(component.entidadesUnicas).toEqual(['Mexico', 'Puebla']);
  });

  it('busca fuera de la pagina actual y conserva opciones globales', fakeAsync(() => {
    component.ngOnInit();
    respond();
    component.filtroTexto = 'Persona 1400';
    component.reiniciarPaginacion(true);
    tick(349);
    http.expectNone(url);
    tick(1);
    const req = respond(0, users.slice(-1), 10, false);
    expect(req.request.params.get('busqueda')).toBe('Persona 1400');
    expect(component.registros[0].id).toBe(1400);
    expect(component.totalPaginasRegistros).toBe(1);
    expect(component.entidadesUnicas).toContain('Puebla');
  }));

  it('envia todos los filtros al servidor antes de paginar', () => {
    component.filtroPerfil = 'INNOVADOR';
    component.filtroSexo = 'FEMENINO';
    component.filtroEntidad = 'Puebla';
    component.filtroMunicipio = 'Municipio remoto';
    component.reiniciarPaginacion();
    const req = respond(0, users.slice(-7));
    expect(req.request.params.get('perfil')).toBe('INNOVADOR');
    expect(req.request.params.get('sexo')).toBe('FEMENINO');
    expect(req.request.params.get('entidad')).toBe('Puebla');
    expect(req.request.params.get('municipio')).toBe('Municipio remoto');
    expect(component.registrosPaginados.length).toBe(7);
  });

  it('cancela respuestas antiguas cuando cambian los filtros', fakeAsync(() => {
    component.ngOnInit();
    const old = http.expectOne(r => r.url === url);
    component.filtroTexto = 'Persona 1400';
    component.reiniciarPaginacion(true);
    expect(old.cancelled).toBeTrue();
    tick(350);
    respond(0, users.slice(-1));
    expect(component.registros[0].id).toBe(1400);
  }));

  it('permite reintentar despues de un error y muestra cero coincidencias', () => {
    component.ngOnInit();
    http.expectOne(r => r.url === url).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(component.loading).toBeFalse();
    expect(component.error).toBeTruthy();
    component.cargarRegistros();
    respond(0, []);
    expect(component.error).toBeNull();
    expect(component.registroInicioVisible).toBe(0);
    expect(component.registroFinVisible).toBe(0);
  });

  it('ajusta la ultima pagina si una eliminacion reduce el total', () => {
    component.ngOnInit();
    respond();
    component.cambiarPagina(139);
    respond(139, users.slice(0, 1390));
    respond(138, users.slice(0, 1390));
    expect(component.paginaActual).toBe(138);
    expect(component.registros.length).toBe(10);
  });

  it('exporta todos los resultados por lotes y no solo los 10 visibles', fakeAsync(() => {
    let exported: Array<{ id: number }> = [];
    (component as any).cargarRegistrosParaExportar().then((data: Array<{ id: number }>) => exported = data);
    for (let page = 0; page < 14; page++) {
      respond(page, users, 100, false);
      tick();
    }
    expect(exported.length).toBe(1400);
    expect(new Set(exported.map(r => r.id)).size).toBe(1400);
    http.expectNone(`${environment.apiBaseUrl}/admin/registros`);
  }));

  it('cancela fotos pendientes y libera sus URLs al salir de pagina', () => {
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test-foto');
    const revoke = spyOn(URL, 'revokeObjectURL');
    component.ngOnInit();
    const req = http.expectOne(r => r.url === url);
    req.flush({ content: users.slice(0, 10).map(r => ({ ...r, fotoDocumentoId: r.id })),
      page: 0, size: 10, totalElements: 1400, totalPages: 140, totalRegistros: 1400 });
    const photos = http.match(r => r.url.includes('/documentos/'));
    expect(photos.length).toBe(10);
    photos[0].flush(new Blob(['fake-image'], { type: 'image/png' }));
    component.cambiarPagina(1);
    expect(photos.slice(1).every(r => r.cancelled)).toBeTrue();
    expect(revoke).toHaveBeenCalledWith('blob:test-foto');
    respond(1);
  });

  it('conserva marcas ZIP entre paginas y permite seleccionar mas de 10 personas', () => {
    component.ngOnInit();
    respond();
    component.incluirPaginaEnZip();
    expect(component.usuariosZip.size).toBe(10);
    component.cambiarPagina(1);
    respond(1);
    expect(component.paginaIncluidaEnZip).toBeFalse();
    component.incluirPaginaEnZip();
    expect(component.usuariosZip.size).toBe(20);
    component.cambiarPagina(2);
    respond(2);
    component.incluirEnZip(21);
    expect(component.usuariosZip.size).toBe(21);
    expect(component.paginaParcialEnZip).toBeTrue();
    component.filtroTexto = 'Persona 1400';
    component.reiniciarPaginacion();
    respond(0, users.slice(-1));
    expect(component.usuariosZip.size).toBe(0);
  });

  it('solicita ZIP de un solo usuario y actualiza el progreso real hasta LISTO', fakeAsync(() => {
    aceptarZip();
    component.ngOnInit();
    respond();
    component.seleccionarUsuario(component.registros[0]);
    component.prepararExpedientes('usuario');
    tick();
    const req = http.expectOne(zipUrl);
    expect(req.request.body).toEqual({ ids: [1] });
    req.flush(estadoZip());
    tick();
    http.expectOne(`${zipUrl}/${zipId}`).flush(estadoZip('PREPARANDO', 42));
    expect(component.zipEstado?.porcentaje).toBe(42);
    tick(1200);
    http.expectOne(`${zipUrl}/${zipId}`).flush(estadoZip('LISTO', 100));
    expect(component.zipActivo).toBeFalse();
    expect(component.zipEstado?.porcentaje).toBe(100);
    tick(5000);
    http.expectNone(`${zipUrl}/${zipId}`);
  }));

  it('envia todos los marcados aunque sean mas de una pagina', fakeAsync(() => {
    aceptarZip();
    component.loading = false;
    for (let id = 1; id <= 25; id++) component.incluirEnZip(id);
    component.prepararExpedientes('seleccion');
    tick();
    const req = http.expectOne(zipUrl);
    expect(req.request.body.ids.length).toBe(25);
    req.flush(estadoZip('LISTO', 100));
    tick();
    http.expectOne(`${zipUrl}/${zipId}`).flush(estadoZip('LISTO', 100));
  }));

  it('exporta todos los filtrados mediante filtros globales y no envia solo los 10 IDs visibles', fakeAsync(() => {
    aceptarZip();
    component.ngOnInit();
    respond();
    component.filtroPerfil = 'INNOVADOR';
    component.filtroEntidad = 'Puebla';
    component.prepararExpedientes('filtrados');
    tick();
    const req = http.expectOne(zipUrl);
    expect(req.request.body.ids).toBeUndefined();
    expect(req.request.body.perfil).toBe('INNOVADOR');
    expect(req.request.body.entidad).toBe('Puebla');
    req.flush(estadoZip('LISTO', 100));
    tick();
    http.expectOne(`${zipUrl}/${zipId}`).flush(estadoZip('LISTO', 100));
  }));

  it('no inicia una exportacion si se cancela la confirmacion', fakeAsync(() => {
    spyOn(Swal, 'fire').and.returnValue(Promise.resolve({ isConfirmed: false } as any));
    component.loading = false;
    component.totalFiltrados = 1400;
    component.prepararExpedientes('filtrados');
    tick();
    http.expectNone(zipUrl);
    expect(component.zipIniciando).toBeFalse();
  }));

  it('permite cancelar la preparacion y deja de consultar el progreso', fakeAsync(() => {
    component.zipEstado = estadoZip();
    (component as any).seguirExportacion(zipId);
    tick();
    http.expectOne(`${zipUrl}/${zipId}`).flush(estadoZip());
    component.cancelarExportacionZip();
    const req = http.expectOne(`${zipUrl}/${zipId}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(estadoZip('CANCELADO', 25));
    expect(component.zipActivo).toBeFalse();
    tick(5000);
    http.expectNone(`${zipUrl}/${zipId}`);
  }));

  it('permite reanudar el progreso si se interrumpe la conexion sin fingir un 100%', fakeAsync(() => {
    component.zipEstado = estadoZip();
    (component as any).seguirExportacion(zipId);
    tick();
    http.expectOne(`${zipUrl}/${zipId}`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(component.zipPausado).toBeTrue();
    expect(component.zipEstado?.porcentaje).toBe(25);
    component.reanudarProgresoZip();
    tick();
    http.expectOne(`${zipUrl}/${zipId}`).flush(estadoZip('LISTO', 100));
    expect(component.zipPausado).toBeFalse();
  }));

  it('autoriza la descarga nativa con cookie y no descarga un Blob gigante ni pone el JWT en la URL', () => {
    const click = spyOn(HTMLAnchorElement.prototype, 'click');
    component.zipEstado = estadoZip('LISTO', 100);
    component.descargarExpedientesZip();
    const req = http.expectOne(`${zipUrl}/${zipId}/preparar-descarga`);
    expect(req.request.withCredentials).toBeTrue();
    expect(req.request.responseType).not.toBe('blob');
    req.flush({ message: 'Autorizada' });
    expect(click).toHaveBeenCalled();
    expect(component.zipAviso).toContain('descargas del navegador');
    http.expectNone(`${zipUrl}/${zipId}/archivo`);
  });

  it('recupera una exportacion existente al volver a la vista', fakeAsync(() => {
    sessionStorage.setItem('siimex_admin_exportacion', zipId);
    component.ngOnInit();
    respond();
    tick();
    http.expectOne(`${zipUrl}/${zipId}`).flush(estadoZip('LISTO', 100));
    expect(component.zipEstado?.id).toBe(zipId);
  }));

  it('el progreso y el boton de descarga se renderizan sin habilitar un ZIP incompleto', () => {
    fixture.detectChanges();
    respond();
    component.zipEstado = estadoZip('PREPARANDO', 42);
    fixture.detectChanges();
    const view: HTMLElement = fixture.nativeElement;
    expect(view.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')).toBe('42');
    expect(view.querySelector('.expedientes-listo')).toBeNull();
    component.zipEstado = estadoZip('LISTO', 100);
    fixture.detectChanges();
    expect(view.querySelector('.expedientes-listo')?.textContent).toContain('Descargar ZIP preparado');
  });
});
