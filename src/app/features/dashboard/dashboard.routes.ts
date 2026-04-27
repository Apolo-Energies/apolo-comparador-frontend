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
import { ForbiddenComponent } from '../../pages/forbidden/forbidden';
import { SipsPageComponent } from './pages/sips/sips-page';
import { FastDischarge } from './pages/fast-discharge/fast-discharge';
import { FAST_DISCHARGE_ROUTES } from './pages/fast-discharge/fast-discharge.routes';

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
      { path: 'altaRapida', component: FastDischarge, children: FAST_DISCHARGE_ROUTES },

      // Master + Colaborador
      {
        path: 'analytics',
        canActivate: [permissionGuard],
        data: { roles: ['Master', 'Colaborador'] },
        children: [
          { path: 'history',    component: HistoryPageComponent },
          { path: 'statistics', component: StatisticsPageComponent },
        ],
      },

      // Master only
      {
        path: 'settings',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        children: [
          { path: 'users',       component: UsersPageComponent },
          { path: 'users/:id',   component: UserDetailPageComponent },
          { path: 'commission',  component: CommissionsPageComponent },
          { path: 'rates',       component: RatesPageComponent },
        ],
      },

      // Master only
      { path: 'support', canActivate: [permissionGuard], data: { roles: ['Master'] }, component: ForbiddenComponent },

      { path: 'forbidden', component: ForbiddenComponent },
    ],
  },
];
