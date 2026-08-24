import { Routes } from '@angular/router';
import { ClientePage } from './pages/cliente/cliente-page';
import { DireccionPagoPage } from './pages/direccion-pago/direccion-pago-page';
import { SuministroContratoPage } from './pages/suministro-contrato/suministro-contrato-page';
import { ProductoActivacionPage } from './pages/producto-activacion/producto-activacion-page';
import { RevisionPage } from './pages/revision/revision-page';

export const ALTA_RAPIDA_GAS_ROUTES: Routes = [
  { path: '',                     redirectTo: 'cliente', pathMatch: 'full' },
  { path: 'cliente',              component: ClientePage },
  { path: 'direccion-pago',       component: DireccionPagoPage },
  { path: 'suministro-contrato',  component: SuministroContratoPage },
  { path: 'producto-activacion',  component: ProductoActivacionPage },
  { path: 'revision',             component: RevisionPage },
];
