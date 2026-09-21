import { Routes } from '@angular/router';
import { HistoryPageComponent } from './pages/history/history-page';
import { StatisticsPageComponent } from './pages/statistics/statistics-page';
import { permissionGuard } from '../../core/guards/permission.guard';
import { featureGuard } from '../../core/guards/feature.guard';
import { ComingSoonComponent } from '../../shared/components/coming-soon/coming-soon.component';

// Children of 'analytics' — extracted from dashboard.routes.ts (Paso 5, R1) to
// keep the theme grouped in its own file. Same order, guards and data as before.
// Variantes Luz también accesibles para Colaboradores; Gas queda Master only.
export const ANALYTICS_ROUTES: Routes = [
  { path: 'history',        component: HistoryPageComponent,      canActivate: [permissionGuard], data: { roles: ['Master', 'Colaborador', 'Colaborador - Referenciador'] } },
  { path: 'history/gas',    component: ComingSoonComponent,       canActivate: [permissionGuard], data: { roles: ['Master'], title: 'Historial de gas' } },
  { path: 'statistics',     component: StatisticsPageComponent,   canActivate: [permissionGuard], data: { roles: ['Master', 'Colaborador', 'Colaborador - Referenciador'] } },
  { path: 'statistics/gas', component: ComingSoonComponent,       canActivate: [permissionGuard], data: { roles: ['Master'], title: 'Estadísticas de gas' } },
  {
    path: 'opportunities',
    redirectTo: 'opportunities/luz',
    pathMatch: 'full',
  },
  {
    path: 'opportunities/luz',
    canActivate: [permissionGuard],
    data: { energyType: 0, roles: ['Master', 'Colaborador', 'Colaborador - Referenciador'] },
    loadComponent: () =>
      import('./pages/opportunities/opportunities-page')
        .then(m => m.OpportunitiesPageComponent),
  },
  {
    path: 'opportunities/gas',
    canActivate: [permissionGuard],
    data: { energyType: 1, roles: ['Master', 'Colaborador', 'Colaborador - Referenciador'] },
    loadComponent: () =>
      import('./pages/opportunities/opportunities-page')
        .then(m => m.OpportunitiesPageComponent),
  },
  {
    path: 'reports',
    canActivate: [permissionGuard, featureGuard],
    data: { roles: ['Master', 'Colaborador', 'Colaborador - Referenciador'], feature: 'reports' },
    loadComponent: () =>
      import('./pages/reports/reports-page')
        .then(m => m.ReportsPageComponent),
  },
  {
    path: 'reports/gas',
    canActivate: [permissionGuard, featureGuard],
    data: { roles: ['Master'], feature: 'reports', title: 'Reportes de gas' },
    component: ComingSoonComponent,
  },
];
