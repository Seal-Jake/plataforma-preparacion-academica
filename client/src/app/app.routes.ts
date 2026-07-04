import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.Login) },
  { path: 'registro', loadComponent: () => import('./features/register/register').then((m) => m.Register) },
  {
    path: 'docente',
    canActivate: [authGuard, roleGuard('docente')],
    loadChildren: () => import('./features/docente/docente.routes').then((m) => m.DOCENTE_ROUTES),
  },
  {
    path: 'estudiante',
    canActivate: [authGuard, roleGuard('estudiante')],
    loadChildren: () => import('./features/estudiante/estudiante.routes').then((m) => m.ESTUDIANTE_ROUTES),
  },
  {
    path: 'perfil',
    canActivate: [authGuard],
    loadComponent: () => import('./features/perfil/perfil').then((m) => m.Perfil),
  },
  {
    path: 'cursos/:id/info',
    canActivate: [authGuard],
    loadComponent: () => import('./features/curso-info/curso-info').then((m) => m.CursoInfo),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  { path: '**', loadComponent: () => import('./shared/components/not-found/not-found').then((m) => m.NotFound) },
];
