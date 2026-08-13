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

      // Analytics — variantes Luz también accesibles para Colaboradores; Gas queda Master only.
      {
        path: 'analytics',
        children: [
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
        ],
      },

      // Master only — Apolo Energies external portal
      {
        path: 'energies',
        canActivate: [permissionGuard],
        data: { roles: ['Master'] },
        children: [
          { path: '', redirectTo: 'invoices', pathMatch: 'full' },
          {
            path: 'invoices',
            loadComponent: () =>
              import('./pages/energies/invoices-page')
                .then(m => m.EnergiesInvoicesPageComponent),
          },
        ],
      },

      // Comercial, Master — Mis clientes (oculto temporalmente para Colaborador/Colaborador - Referenciador)
      {
        path: 'my-clients',
        canActivate: [permissionGuard, featureGuard],
        data: { feature: 'myClients', roles: ['Master'] },
        loadComponent: () =>
          import('./pages/my-clients/my-clients-page')
            .then(m => m.MyClientsPageComponent),
      },

      // Master only — Contratos section (oculto temporalmente para Colaborador/Colaborador - Referenciador)
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
        data: { feature: 'userDetail', roles: ['Colaborador', 'Colaborador - Referenciador', 'Master'] },
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
