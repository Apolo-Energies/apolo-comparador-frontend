import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../utils/auth.utils';

/**
 * Protege rutas por rol.
 * data: { roles: ['Master', 'Colaborador'] }   → el usuario debe tener al menos uno
 * data: { excludeRoles: ['Comercial'] }         → el usuario NO debe tener ninguno de éstos
 * Si la comprobación falla → /dashboard/forbidden.
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth          = inject(AuthService);
  const router        = inject(Router);
  const requiredRoles = route.data['roles']        as string[] | undefined;
  const excludeRoles  = route.data['excludeRoles'] as string[] | undefined;

  const userRoles = getUserRoles(auth.currentUser());

  if (excludeRoles?.some(r => userRoles.includes(r))) {
    return router.createUrlTree(['/dashboard/forbidden']);
  }

  if (!requiredRoles || requiredRoles.length === 0) return true;

  const hasAccess = userRoles.some(r => requiredRoles.includes(r));
  return hasAccess ? true : router.createUrlTree(['/dashboard/forbidden']);
};
