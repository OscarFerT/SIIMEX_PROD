import { Type } from '@angular/core';
import { routes } from './app.routes';
import { authGuard, adminGuard, evaluadorGuard, guestGuard } from './core/auth.guard';
import { meResolver } from './core/resolvers/me.resolver';

describe('Carga diferida de pantallas privadas', () => {
  const privada = routes.find(route => route.path === 'app')!;
  const pantallas = [
    ['perfil', 'PerfilComponent'],
    ['postulacion/:convocatoriaId', 'PostulacionComponent'],
    ['postulacion', 'PostulacionComponent'],
    ['registro2', 'RegistroStep2Component'],
    ['trayectoria', 'TrayectoriaComponent']
  ];

  for (const [path, componentName] of pantallas) {
    it(`carga ${path} solo al navegar y resuelve el componente correcto`, async () => {
      const route = privada.children!.find(item => item.path === path)!;
      expect(route.component).toBeUndefined();
      expect(route.loadComponent).toBeDefined();
      const loaded = await route.loadComponent!();
      expect((loaded as Type<unknown>).name).toBe(componentName);
    });
  }

  it('conserva autenticacion, datos del usuario y permisos administrativos y de evaluacion', () => {
    expect(privada.canActivate).toEqual([authGuard]);
    expect(privada.resolve).toEqual({ me: meResolver });
    expect(privada.children!.find(route => route.path === 'evaluaciones')!.canActivate).toEqual([evaluadorGuard]);
    expect(routes.find(route => route.path === 'admin')!.canActivate).toEqual([adminGuard]);
    expect(routes.find(route => route.path === 'completarRegistro')!.canActivate).toEqual([authGuard]);
    for (const path of ['login', 'registro', 'recuperacion']) {
      expect(routes.find(route => route.path === path)!.canActivate).toEqual([guestGuard]);
    }
  });

  it('conserva las rutas publicas y las redirecciones existentes', () => {
    for (const path of ['landing', 'home', 'contacto', 'investigadores', 'folios-aprobados', 'login/admin', 'verificar-email']) {
      expect(routes.find(route => route.path === path)).toBeDefined();
    }
    expect(routes.find(route => route.path === '')!.redirectTo).toBe('landing');
    expect(routes.find(route => route.path === '**')!.redirectTo).toBe('login');
  });
});
