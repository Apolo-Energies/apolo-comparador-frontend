import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';

/**
 * Impide que un usuario autenticado acceda al login.
 * Si el token es válido lo redirige al comparador.
 */
export const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return router.createUrlTree(['/dashboard/comparator']);
  }

  return true;
};
