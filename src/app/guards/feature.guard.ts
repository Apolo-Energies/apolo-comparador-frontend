import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { environment } from '../../environments/environment';

export const featureGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router      = inject(Router);
  const featureKey  = route.data['feature'] as keyof typeof environment.features | undefined;

  if (!featureKey) return true;

  return environment.features[featureKey]
    ? true
    : router.createUrlTree(['/dashboard/forbidden']);
};
