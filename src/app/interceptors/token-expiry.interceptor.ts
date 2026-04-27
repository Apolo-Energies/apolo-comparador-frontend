import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '@apolo-energies/auth';

const PUBLIC_ROUTES = ['/comparador-publico'];

export const tokenExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  return next(req).pipe(
    catchError(error => {
      if (error.status === 401) {
        const path = isPlatformBrowser(platformId) ? window.location.pathname : '';
        const isPublic = PUBLIC_ROUTES.some(p => path.startsWith(p));
        if (!isPublic) {
          auth.signOut();
        }
      }
      return throwError(() => error);
    })
  );
};
