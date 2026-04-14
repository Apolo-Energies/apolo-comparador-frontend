import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@apolo-energies/auth';

/**
 * Si el backend responde 401 (token expirado o inválido)
 * hace signOut() automáticamente, lo que redirige al login.
 */
export const tokenExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError(error => {
      if (error.status === 401) {
        auth.signOut();
      }
      return throwError(() => error);
    })
  );
};
