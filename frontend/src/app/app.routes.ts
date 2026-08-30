import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'search',
    loadComponent: () => import('./components/search-page/search.component').then((m) => m.SearchComponent),
  },
  {
    path: 'locality/:id',
    loadComponent: () => import('./components/locality/locality.component').then((m) => m.LocalityComponent),
  },
  {
    path: 'property/:id',
    loadComponent: () => import('./components/property-page/property.component').then((m) => m.PropertyComponent),
  },
  {
    path: 'compare',
    loadComponent: () => import('./components/compare/compare.component').then((m) => m.CompareComponent),
  },
  {
    path: 'assistant',
    loadComponent: () => import('./components/assistant/assistant.component').then((m) => m.AssistantComponent),
  },
  { path: '**', redirectTo: '' },
];
