import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { Investigador, InvestigadoresComponent } from './investigadores';

describe('Imagen institucional autorizada del directorio', () => {
  let component: InvestigadoresComponent;
  let fixture: ComponentFixture<InvestigadoresComponent>;
  const perfil = (tipoPerfil = 'INVESTIGADOR'): Investigador => ({
    id: 1, nombre: 'Persona', apellidoPaterno: 'Prueba', apellidoMaterno: '',
    email: '', telefono: null, gradoAcademico: null, semblanza: null,
    tipoPerfil, fotoDocumentoId: null, curriculumDocumentoId: null
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InvestigadoresComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    fixture = TestBed.createComponent(InvestigadoresComponent);
    component = fixture.componentInstance;
    spyOn(component, 'cargarInvestigadores');
    spyOn<any>(component, 'setupModalListeners');
  });

  it('crea el componente del directorio', () => {
    expect(component).toBeTruthy();
  });

  for (const tipo of ['INVESTIGADOR', 'INNOVADOR', 'HIBRIDO']) {
    it(`usa la imagen oficial para el perfil ${tipo} sin foto visible`, () => {
      expect(component.getFotoUrl(perfil(tipo))).toBe('assets/img/siimex-directorio-oficial.jpeg');
    });
  }

  it('conserva la foto personal cuando esta disponible', () => {
    const persona = perfil();
    persona.fotoUrl = TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl('blob:foto-personal');
    expect(component.getFotoUrl(persona)).toBe(persona.fotoUrl);
  });

  it('carga el archivo oficial original desde los assets', (done) => {
    const img = new Image();
    img.onload = () => {
      expect(img.naturalWidth).toBe(1600);
      expect(img.naturalHeight).toBe(1066);
      done();
    };
    img.onerror = () => done.fail('No se pudo cargar la imagen institucional');
    img.src = component.DEFAULT_AVATAR;
  });

  it('muestra la imagen completa tanto en tarjeta como en modal', () => {
    component.loading = false;
    component.investigadores = [perfil()];
    component.investigadoresFiltrados = component.investigadores;
    fixture.detectChanges();
    const view: HTMLElement = fixture.nativeElement;
    for (const selector of ['.dir-card-img img', '.investigador-photo-modal-thumb img']) {
      const img = view.querySelector<HTMLImageElement>(selector)!;
      expect(img.getAttribute('src')).toBe(component.DEFAULT_AVATAR);
      expect(img.classList.contains('dir-imagen-institucional')).toBeTrue();
      expect(getComputedStyle(img).objectFit).toBe('contain');
    }
  });

  it('reemplaza una foto fallida sin recortar la imagen oficial ni crear un bucle', () => {
    const img = document.createElement('img');
    img.src = 'blob:foto-no-disponible';
    component.onImageError({ target: img } as unknown as Event);
    expect(img.src).toBe(new URL(component.DEFAULT_AVATAR, document.baseURI).href);
    expect(img.classList.contains('dir-imagen-institucional')).toBeTrue();
    img.onerror = null;
    component.onImageError({ target: img } as unknown as Event);
    expect(img.onerror).toBeNull();
  });
});
