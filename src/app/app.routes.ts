import { Routes } from '@angular/router';
import { TimerComponent } from './timer/timer.component';
import { LandingComponent } from './landing/landing.component';

export const routes: Routes = [
  { path: 'timer', component: TimerComponent },
  { path: '', component: LandingComponent, pathMatch: 'full' },
];
