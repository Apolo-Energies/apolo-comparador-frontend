import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BrandModulesService } from '../services/brand-modules.service';

/**
 * `data.feature`: módulo del tenant (environment.features) — también se valida contra la marca.
 * `data.brandModule`: módulo que solo se valida contra la marca blanca del usuario, para rutas
 * que el tenant siempre tiene (comparador, SIPS…). Si no se indica, se usa `data.feature`.
 */
export const featureGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router       = inject(Router);
  const brandModules = inject(BrandModulesService);
  const featureKey   = route.data['feature'] as keyof typeof environment.features | undefined;
  const brandKey     = (route.data['brandModule'] as string | undefined) ?? featureKey;
  const forbidden    = router.createUrlTree(['/dashboard/forbidden']);

  if (featureKey && !environment.features[featureKey]) return forbidden;
  if (!brandKey) return true;

  return brandModules.allows$(brandKey).pipe(map(ok => (ok ? true : forbidden)));
};
