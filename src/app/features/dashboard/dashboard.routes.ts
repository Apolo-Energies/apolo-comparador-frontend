import { Routes } from '@angular/router';
import { authGuard } from '@apolo-energies/auth';
import { Comparator } from './pages/comparator/comparator-page';
import { ComparatorMultiple } from './pages/comparator-multiple/comparator-multiple-page';
import { UsersPageComponent } from './pages/users/users-page';
import { UserDetailPageComponent } from './pages/users/user-detail/user-detail';
import { CommissionsPageComponent } from './pages/commissions/commissions-page';
import { Layout } from '../../layout/layout';
import { permissionGuard } from '../../core/guards/permission.guard';
import { featureGuard } from '../../core/guards/feature.guard';
import { openCollaboratorDialogGuard } from '../../core/guards/open-collaborator-dialog.guard';
import { ForbiddenComponent } from '../forbidden/forbidden';
import { SipsPageComponent } from './pages/sips/sips-page';
import { SipsGasPageComponent } from './pages/sips-gas/sips-gas-page';
import { FastDischarge } from './pages/fast-discharge/fast-discharge-page';
import { FAST_DISCHARGE_ROUTES } from './pages/fast-discharge/fast-discharge.routes';
import { SubUserCommissionsPage } from './pages/sub-user-commissions/sub-user-commissions-page';
import { MyComercialsPage } from './pages/my-commercials/my-commercials-page';
import { SupportPageComponent } from './pages/support/support-page';
import { RatesPageComponent } from './pages/rates/rates-page';
import { ANALYTICS_ROUTES } from './analytics.routes';
import { GAS_ADMIN_ROUTES } from './gas-admin.routes';

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
          import('./pages/comparator-gas/comparator-gas-page')
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
      // Children extraídos a analytics.routes.ts (mismo orden, guards y data).
      {
        path: 'analytics',
        children: ANALYTICS_ROUTES,
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

      // Comercial, Colaborador, Colaborador - Referenciador, Master — Mis clientes
      {
        path: 'my-clients',
        canActivate: [permissionGuard, featureGuard],
        data: { feature: 'myClients', roles: ['Master', 'Comercial', 'Colaborador', 'Colaborador - Referenciador'] },
        loadComponent: () =>
          import('./pages/my-clients/my-clients-page')
            .then(m => m.MyClientsPageComponent),
      },

      // Master, Colaborador, Colaborador - Referenciador — Contratos section.
      // Colaborador solo ve sus propios contratos (según delegationId del JWT); ver contracts-page.ts.
      {
        path: 'contratos',
        canActivate: [permissionGuard, featureGuard],
        data: { roles: ['Master', 'Colaborador', 'Colaborador - Referenciador'], feature: 'contracts' },
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

      // Master-only gas admin screens ('gas/...') + wizard "Alta Rápida" de gas.
      // Extraídos a gas-admin.routes.ts (mismo orden, guards y data).
      ...GAS_ADMIN_ROUTES,

      { path: 'forbidden', component: ForbiddenComponent },

      // Ítem "Colaborador" del sidebar (APOLO ENERGIES): el guard siempre cancela
      // la navegación y abre el modal de selección — ForbiddenComponent nunca
      // llega a renderizar, es solo el relleno formal que pide el tipo Route.
      { path: 'collaborator-scope', canActivate: [openCollaboratorDialogGuard], component: ForbiddenComponent },
    ],
  },
];
