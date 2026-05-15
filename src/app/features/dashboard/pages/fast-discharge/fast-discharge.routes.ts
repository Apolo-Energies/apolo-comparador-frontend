import { Routes } from '@angular/router';
import { WelcomePage } from './pages/welcome/welcome';
import { DataPage } from './pages/data/data';
import { SupplyPointPage } from './pages/supply-point/supply-point';
import { SelectProductPage } from './pages/select-product/select-product';
import { DocumentsPage } from './pages/documents/documents';
import { ReviewPage } from './pages/review/review';
import { SignaturePage } from './pages/signature/signature';

export const FAST_DISCHARGE_ROUTES: Routes = [
  { path: '',               component: WelcomePage },
  { path: 'data',          component: DataPage },
  { path: 'supply-point',  component: SupplyPointPage },
  { path: 'select-product', component: SelectProductPage },
  { path: 'documents',     component: DocumentsPage },
  { path: 'review',        component: ReviewPage },
  { path: 'signature',     component: SignaturePage },
];
