import { Routes } from '@angular/router';

export const ESTUDIANTE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./dashboard/dashboard').then((m) => m.Dashboard) },
  { path: 'cursos', loadComponent: () => import('./courses/courses').then((m) => m.CoursesList) },
  { path: 'units/:unitId', loadComponent: () => import('./unit-view/unit-view').then((m) => m.UnitView) },
  {
    path: 'sessions/:sessionId/resolver',
    loadComponent: () => import('./session-solve/session-solve').then((m) => m.SessionSolve),
  },
  {
    path: 'sessions/:sessionId/historial',
    loadComponent: () => import('./history/history').then((m) => m.SessionHistory),
  },
];
