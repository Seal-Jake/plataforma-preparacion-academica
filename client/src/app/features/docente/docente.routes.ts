import { Routes } from '@angular/router';

export const DOCENTE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./tree/tree').then((m) => m.Tree) },
  { path: 'guia', loadComponent: () => import('./guia-docente/guia-docente').then((m) => m.GuiaDocente) },
  { path: 'courses/:courseId', loadComponent: () => import('./course-detail/course-detail').then((m) => m.CourseDetail) },
  { path: 'units/:unitId', loadComponent: () => import('./unit-detail/unit-detail').then((m) => m.UnitDetail) },
  {
    path: 'topics/:topicId',
    loadComponent: () => import('./topic-editor/topic-editor').then((m) => m.TopicEditor),
  },
];
