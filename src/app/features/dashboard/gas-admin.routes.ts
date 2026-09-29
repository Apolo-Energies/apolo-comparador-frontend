import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';
import { AltaRapidaGas } from './pages/gas-quixotic-contracts/alta-rapida/alta-rapida-gas';
import { ALTA_RAPIDA_GAS_ROUTES } from './pages/gas-quixotic-contracts/alta-rapida/alta-rapida-gas.routes';

// Master-only gas administration screens ('gas/...'), plus the "Alta Rápida"
// gas wizard entry point — extracted from dashboard.routes.ts (Paso 5, R1) to
// keep the theme grouped in its own file. Same order, guards and data as before.
export const GAS_ADMIN_ROUTES: Routes = [
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
      import('./pages/gas-apolo-products/gas-apolo-products-page')
        .then(m => m.GasApoloProductsPageComponent),
  },
  // Master only — a diferencia de Contratos (Luz), esta todavía no está disponible para Colaborador.
  {
    path: 'gas/quixotic-contracts',
    canActivate: [permissionGuard],
    data: { roles: ['Master'] },
    loadComponent: () =>
      import('./pages/gas-quixotic-contracts/gas-quixotic-contracts-page')
        .then(m => m.GasQuixoticContractsPageComponent),
  },
  // Todos los roles — es el destino de "Alta Rápida" > Gas en el header.
  // Wizard completo contra POST /quixotic/alta-rapida (cuenta + punto de suministro + contrato).
  {
    path: 'gas/quixotic-contracts/new',
    component: AltaRapidaGas,
    children: ALTA_RAPIDA_GAS_ROUTES,
  },
];
