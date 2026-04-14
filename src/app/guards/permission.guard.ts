import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../utils/auth.utils';

/**
 * Protege rutas por rol.
 * Uso en la ruta: data: { roles: ['Master', 'Colaborador'] }
 * Si el usuario no tiene ninguno de los roles requeridos → /dashboard/forbidden.
 */
export const permissionGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth          = inject(AuthService);
  const router        = inject(Router);
  const requiredRoles = route.data['roles'] as string[] | undefined;

  if (!requiredRoles || requiredRoles.length === 0) return true;

  const userRoles = getUserRoles(auth.currentUser());
  const hasAccess = userRoles.some(r => requiredRoles.includes(r));

  return hasAccess ? true : router.createUrlTree(['/dashboard/forbidden']);
};
