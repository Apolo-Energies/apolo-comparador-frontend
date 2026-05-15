import { Routes } from '@angular/router';
import { authGuard } from '@apolo-energies/auth';
import { Comparator } from './pages/comparator/comparator';
import { HistoryPageComponent } from './pages/history/history-page';
import { UsersPageComponent } from './pages/users/users-page';
import { UserDetailPageComponent } from './pages/users/user-detail/user-detail';
import { CommissionsPageComponent } from './pages/commissions/commissions-page';
import { StatisticsPageComponent } from './pages/statistics/statistics-page';
import { Layout } from '../layout/layout';
import { permissionGuard } from '../../guards/permission.guard';
import { featureGuard } from '../../guards/feature.guard';
import { ForbiddenComponent } from '../../pages/forbidden/forbidden';
import { SipsPageComponent } from './pages/sips/sips-page';
import { FastDischarge } from './pages/fast-discharge/fast-discharge';
import { FAST_DISCHARGE_ROUTES } from './pages/fast-discharge/fast-discharge.routes';
import { SubUserCommissionsPage } from './pages/sub-user-commissions/sub-user-commissions';
import { MyComercialsPage } from './pages/my-commercials/my-commercials';
import { SupportPageComponent } from './pages/support/support-page';
import { RatesPageComponent } from './pages/rates/rates-page';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'comparator', pathMatch: 'full' },

      // All roles
      { path: 'comparator', component: Comparator },
      { path: 'sips', component: SipsPageComponent },
      { path: 'fast-discharge', component: FastDischarge, children: FAST_DISCHARGE_ROUTES },

      // Master only
      {
        path: 'analytics',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        children: [
          { path: 'history',    component: HistoryPageComponent },
          { path: 'statistics', component: StatisticsPageComponent },
          {
            path: 'opportunities',
            loadComponent: () =>
              import('./pages/opportunities/opportunities-page')
                .then(m => m.OpportunitiesPageComponent),
          },
        ],
      },

      // Master only
      {
        path: 'settings',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        children: [
          { path: 'users',      component: UsersPageComponent },
          { path: 'commission', component: CommissionsPageComponent },
          // { path: 'rates',   component: RatesPageComponent },
        ],
      },

      // Todos los roles autenticados — perfil propio
      { path: 'settings/users/:id', component: UserDetailPageComponent },

      // Colaborador only — Apolo exclusivo
      {
        path: 'settings/my-comercials',
        component: MyComercialsPage,
        canActivate: [featureGuard, permissionGuard],
        data: { feature: 'userDetail', roles: ['Colaborador'] },
      },
      {
        path: 'settings/sub-user-commissions',
        component: SubUserCommissionsPage,
        canActivate: [featureGuard, permissionGuard],
        data: { feature: 'userDetail', roles: ['Colaborador'] },
      },

      // Master only
      { path: 'support',   component: SupportPageComponent },
      { path: 'tariffs',   component: RatesPageComponent,   canActivate: [permissionGuard], data: { roles: ['Master'] } },

      { path: 'forbidden', component: ForbiddenComponent },
    ],
  },
];
