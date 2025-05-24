import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'timer/:timerId',
    loadComponent: () => import('./timer/timer.component').then(m => m.TimerComponent)
  },
  {
    path: '',
    loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent),
    pathMatch: 'full'
  },
];
