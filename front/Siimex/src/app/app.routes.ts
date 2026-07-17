import { Routes } from '@angular/router';

import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { CambiarContrasenaComponent } from './pages/seguridad/cambiar-contrasena.component';

import { authGuard, guestGuard, adminGuard, evaluadorGuard } from './core/auth.guard';
import { meResolver } from './core/resolvers/me.resolver';

import { LandingComponent } from './pages/landing/landing.component';
import { HomeComponent } from './pages/home/home.component';
import { PerfilComponent } from './pages/acerca/perfil.component';
import { ConvocatoriasComponent } from './pages/convocatorias/convocatorias';
import { PostulacionComponent } from './pages/postulacion/postulacion';
import { ContactoComponent } from './pages/contacto/contacto';
import { InvestigadoresComponent } from './pages/investigadores/investigadores';
import { RegistroStep2Component } from './pages/registro-step2/registro-step2';
import { TrayectoriaComponent } from './pages/trayectoria/trayectoria';
import { PersonaComponent } from './pages/personal-principal/persona.component';


export const routes: Routes = [
  // Default -> landing (redirige al landing cuando se accede a localhost)
  { path: '', pathMatch: 'full', redirectTo: 'landing' },

  // Público
  { path: 'landing', component: LandingComponent },
  { path: 'home', component: HomeComponent },
  { path: 'contacto', component: ContactoComponent },
  { path: 'investigadores', component: InvestigadoresComponent },
  {
    path: 'folios-aprobados',
    loadComponent: () =>
      import('./pages/folios-aprobados/folios-aprobados.component').then(m => m.FoliosAprobadosComponent),
  },

  // Invitados
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: 'login/admin',
    loadComponent: () =>
      import('./pages/admin/admin-login.component').then(m => m.AdminLoginComponent),
  },
  { path: 'registro', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'recuperacion', component: CambiarContrasenaComponent, canActivate: [guestGuard] },
  { path: 'verificar-email', loadComponent: () => import('./pages/verificar-email/verificar-email.component').then(m => m.VerificarEmailComponent) },

  // Administrador (requiere ROLE_ADMIN)
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin/admin-layout.component').then(m => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin/admin-dashboard.component').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'registros',
        loadComponent: () =>
          import('./pages/admin/admin-registros.component').then(m => m.AdminRegistrosComponent),
      },
      {
        path: 'convocatorias',
        loadComponent: () =>
          import('./pages/admin/admin-convocatoria-gestion.component').then(m => m.AdminConvocatoriaGestionComponent),
      },
      {
        path: 'convocatorias/listado',
        loadComponent: () =>
          import('./pages/admin/admin-convocatorias.component').then(m => m.AdminConvocatoriasComponent),
      },
      {
        path: 'convocatorias/:id/postulaciones',
        loadComponent: () =>
          import('./pages/admin/admin-postulaciones.component').then(m => m.AdminPostulacionesComponent),
      },
      {
        path: 'convocatorias/:id/evaluacion',
        loadComponent: () =>
          import('./pages/admin/admin-evaluacion.component').then(m => m.AdminEvaluacionComponent),
      },
      {
        path: 'convocatorias/:id/comite',
        loadComponent: () =>
          import('./pages/admin/admin-comite.component').then(m => m.AdminComiteComponent),
      },
      {
        path: 'convocatorias/:id/bancaria',
        loadComponent: () =>
          import('./pages/admin/admin-bancaria.component').then(m => m.AdminBancariaComponent),
      },
      {
        path: 'convocatorias/:id/cotejo',
        loadComponent: () =>
          import('./pages/admin/admin-cotejo.component').then(m => m.AdminCotejoComponent),
      },
      {
        path: 'convocatorias/:id/informes',
        loadComponent: () =>
          import('./pages/admin/admin-informes.component').then(m => m.AdminInformesComponent),
      },
      {
        path: 'convocatorias/:id/renuncias',
        loadComponent: () =>
          import('./pages/admin/admin-renuncias.component').then(m => m.AdminRenunciasComponent),
      },
      {
        path: 'feriados',
        loadComponent: () =>
          import('./pages/admin/admin-feriados.component').then(m => m.AdminFeriadosComponent),
      },
      {
        path: 'instituciones-educativas',
        loadComponent: () =>
          import('./pages/admin/admin-instituciones-educativas.component').then(m => m.AdminInstitucionesEducativasComponent),
      },
      {
        path: 'lista-negra',
        loadComponent: () =>
          import('./pages/admin/admin-lista-negra.component').then(m => m.AdminListaNegraComponent),
      },
      {
        path: 'configuracion-folios',
        loadComponent: () =>
          import('./pages/admin/admin-configuracion-folios.component').then(m => m.AdminConfiguracionFoliosComponent),
      },
      {
        path: 'convocatorias/:id/gestion',
        loadComponent: () =>
          import('./pages/admin/admin-convocatoria-gestion.component').then(m => m.AdminConvocatoriaGestionComponent),
      },
      {
        path: 'reportes',
        loadComponent: () =>
          import('./pages/admin/admin-reportes.component').then(m => m.AdminReportesComponent),
      },
      {
        path: 'padron-beneficiarios',
        loadComponent: () =>
          import('./pages/admin/admin-padron.component').then(m => m.AdminPadronComponent),
      },
      {
        path: 'auditoria',
        loadComponent: () =>
          import('./pages/admin/admin-auditoria.component').then(m => m.AdminAuditoriaComponent),
      },
      {
        path: 'notificaciones',
        loadComponent: () =>
          import('./pages/notificaciones/notificaciones.component').then(m => m.NotificacionesComponent),
      },
    ],
  },

  // ✅ Opción A: ruta raíz (no dentro de /app)
  {
    path: 'completarRegistro',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/completar-registro/completar-registro.component')
        .then(m => m.CompletarRegistroComponent),
  },

  // Privado
  {
    path: 'app',
    canActivate: [authGuard],
    resolve: { me: meResolver },
    children: [
       {
      path: 'perfil',
      component: PerfilComponent
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'cambiar-contrasena',
        component: CambiarContrasenaComponent
      },
      {
        path: 'convocatorias',
        component: ConvocatoriasComponent
      },
      {
        path: 'postulacion/:convocatoriaId',
        component: PostulacionComponent
      },
      {
        path: 'postulacion',
        component: PostulacionComponent
      },
      {
        path: 'registro2',
        component: RegistroStep2Component
      },
      {
        path: 'trayectoria',
        component: TrayectoriaComponent
      },
      {
        path: 'notificaciones',
        loadComponent: () =>
          import('./pages/notificaciones/notificaciones.component').then(m => m.NotificacionesComponent),
      },
      {
        path: 'evaluaciones',
        canActivate: [evaluadorGuard],
        loadComponent: () =>
          import('./pages/evaluador/evaluador-postulaciones.component').then(m => m.EvaluadorPostulacionesComponent),
      },


      {
        path: 'acerca-de',
        children: [
          
          {
            path: 'variables-socioeconomicas',
            loadComponent: () =>
              import('./pages/acerca/variables-socioeconomicas.component')
                .then(m => m.VariablesSocioeconomicasComponent),
          },
          {
            path: 'educacion',
            children: [
              {
                path: 'trayectoria-academica',
                loadComponent: () =>
                  import('./pages/acerca/educacion/trayectoria-academica.component')
                    .then(m => m.TrayectoriaAcademicaComponent),
              },
            ],
          },
        ],
      },

      // /app -> /landing
      { path: '', pathMatch: 'full', redirectTo: '/landing' },
    ],
  },

  // Catch-all
  { path: '**', redirectTo: 'login' },
];
