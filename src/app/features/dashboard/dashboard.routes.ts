import { Routes } from '@angular/router';
import { authGuard } from '@apolo-energies/auth';
import { Comparator } from './pages/comparator/comparator';
import { ComparatorMultiple } from './pages/comparator-multiple/comparator-multiple';
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
import { SipsGasPageComponent } from './pages/sips-gas/sips-gas-page';
import { FastDischarge } from './pages/fast-discharge/fast-discharge';
import { FAST_DISCHARGE_ROUTES } from './pages/fast-discharge/fast-discharge.routes';
import { SubUserCommissionsPage } from './pages/sub-user-commissions/sub-user-commissions';
import { MyComercialsPage } from './pages/my-commercials/my-commercials';
import { SupportPageComponent } from './pages/support/support-page';
import { RatesPageComponent } from './pages/rates/rates-page';
import { ComingSoonComponent } from '../../shared/components/coming-soon/coming-soon.component';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    component: Layout,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'comparator', pathMatch: 'full' },

      // All roles
      { path: 'comparator',          component: Comparator },
      {
        path: 'comparator/gas',
        loadComponent: () =>
          import('./pages/comparator-gas/comparator-gas')
            .then(m => m.ComparatorGas),
      },
      { path: 'comparator-multiple', component: ComparatorMultiple, canActivate: [permissionGuard], data: { excludeRoles: ['Comercial'] } },
      { path: 'sips',                component: SipsPageComponent },
      { path: 'sips/gas',            component: SipsGasPageComponent },
      { path: 'fast-discharge', component: FastDischarge, children: FAST_DISCHARGE_ROUTES },
      { path: 'altaRapida', component: FastDischarge, children: FAST_DISCHARGE_ROUTES },
      {
        path: 'markets',
        canActivate: [featureGuard],
        data: { feature: 'markets' },
        loadComponent: () =>
          import('./pages/markets/markets-page')
            .then(m => m.MarketsPageComponent),
      },

      // Master only
      {
        path: 'analytics',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        children: [
          { path: 'history',        component: HistoryPageComponent },
          { path: 'history/gas',    component: ComingSoonComponent, data: { title: 'Historial de gas' } },
          { path: 'statistics',     component: StatisticsPageComponent },
          { path: 'statistics/gas', component: ComingSoonComponent, data: { title: 'Estadísticas de gas' } },
          {
            path: 'opportunities',
            redirectTo: 'opportunities/luz',
            pathMatch: 'full',
          },
          {
            path: 'opportunities/luz',
            data: { energyType: 0 }, // EnergyType.Electricity
            loadComponent: () =>
              import('./pages/opportunities/opportunities-page')
                .then(m => m.OpportunitiesPageComponent),
          },
          {
            path: 'opportunities/gas',
            data: { energyType: 1 }, // EnergyType.Gas
            loadComponent: () =>
              import('./pages/opportunities/opportunities-page')
                .then(m => m.OpportunitiesPageComponent),
          },
          {
            path: 'reports',
            canActivate: [featureGuard],
            data: { feature: 'reports' },
            loadComponent: () =>
              import('./pages/reports/reports-page')
                .then(m => m.ReportsPageComponent),
          },
          {
            path: 'reports/gas',
            canActivate: [featureGuard],
            data: { feature: 'reports', title: 'Reportes de gas' },
            component: ComingSoonComponent,
          },
        ],
      },

      // Master only — Contratos section
      {
        path: 'contratos',
        canActivate: [permissionGuard, featureGuard],
        data: { roles: ['Master'], feature: 'contracts' },
        children: [
          {
            path: 'contratos',
            loadComponent: () =>
              import('./pages/contracts/contracts-page')
                .then(m => m.ContractsPageComponent),
          },
          {
            path: 'servicios',
            loadComponent: () =>
              import('./pages/services/services-page')
                .then(m => m.ServicesPageComponent),
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
        data: { feature: 'userDetail', roles: ['Colaborador', 'Colaborador - Referenciador'] },
      },
      {
        path: 'settings/sub-user-commissions',
        component: SubUserCommissionsPage,
        canActivate: [featureGuard, permissionGuard],
        data: { feature: 'userDetail', roles: ['Colaborador', 'Colaborador - Referenciador'] },
      },

      // Master only
      { path: 'support',   component: SupportPageComponent },
      { path: 'tariffs',   component: RatesPageComponent,   canActivate: [permissionGuard], data: { roles: ['Master'] } },
      {
        path: 'templates',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        loadComponent: () =>
          import('./pages/contract-templates/contract-templates-page')
            .then(m => m.ContractTemplatesPageComponent),
      },

      // Master only — Landings personalizadas
      {
        path: 'landings',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        loadComponent: () =>
          import('./pages/landings/landings-page')
            .then(m => m.LandingsPageComponent),
      },

      // Master only — banco de pruebas del OCR de gas. No esta en sidebar; acceso por URL directa.
      {
        path: 'gas/ocr-test',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        loadComponent: () =>
          import('./pages/ocr-test/ocr-test-page')
            .then(m => m.OcrTestPageComponent),
      },

      // Master only — Gas regulatory admin
      {
        path: 'gas/access-tariffs',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        loadComponent: () =>
          import('./pages/gas-access-tariffs/gas-access-tariffs-page')
            .then(m => m.GasAccessTariffsPageComponent),
      },
      {
        path: 'gas/regulatory-params',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        loadComponent: () =>
          import('./pages/gas-regulatory-params/gas-regulatory-params-page')
            .then(m => m.GasRegulatoryParamsPageComponent),
      },
      {
        path: 'gas/products',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        loadComponent: () =>
          import('./pages/gas-products/gas-products-page')
            .then(m => m.GasProductsPageComponent),
      },

      { path: 'forbidden', component: ForbiddenComponent },
    ],
  },
];
