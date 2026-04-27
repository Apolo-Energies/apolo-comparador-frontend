import { Routes } from '@angular/router';
import { WelcomePage } from './pages/welcome/welcome';
import { DataPage } from './pages/data/data';
import { DocumentsPage } from './pages/documents/documents';
import { SignaturePage } from './pages/signature/signature';

export const FAST_DISCHARGE_ROUTES: Routes = [
  { path: '',          component: WelcomePage },
  { path: 'data',      component: DataPage },
  { path: 'documents', component: DocumentsPage },
  { path: 'signature', component: SignaturePage },
];
