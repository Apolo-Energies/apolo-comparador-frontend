import { Routes } from '@angular/router';
import { BrandedLandingComponent } from './branded-landing.component';
import { brandedLandingResolver } from './branded-landing.resolver';

export const BRANDED_LANDING_ROUTES: Routes = [
  {
    path: ':slug',
    component: BrandedLandingComponent,
    resolve: { landing: brandedLandingResolver },
  },
];
