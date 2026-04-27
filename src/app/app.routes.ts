import { Routes } from '@angular/router';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password';
import { ResetPasswordComponent } from './pages/reset-password/reset-password';

export const routes: Routes = [

  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.DASHBOARD_ROUTES),
  },

  {
    path: 'comparador-publico',
    loadComponent: () =>
      import('./features/public-comparator/public-comparator').then(m => m.PublicComparator),
  },

  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password',  component: ResetPasswordComponent  },
];
