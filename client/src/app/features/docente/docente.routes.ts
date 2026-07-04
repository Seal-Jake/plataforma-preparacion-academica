import { Routes } from '@angular/router';

export const DOCENTE_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./tree/tree').then((m) => m.Tree) },
  { path: 'units/:unitId', loadComponent: () => import('./unit-detail/unit-detail').then((m) => m.UnitDetail) },
  {
    path: 'topics/:topicId',
    loadComponent: () => import('./topic-editor/topic-editor').then((m) => m.TopicEditor),
  },
];
