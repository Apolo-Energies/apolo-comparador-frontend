import { inject } from '@angular/core';
import { HttpBackend, HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '@apolo-energies/auth';
import { RefreshTokenService } from '../services/refresh-token.service';
import { environment } from '../../environments/environment';

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * En un 401:
 * 1. Intenta renovar con POST /auth/refresh (userId + refreshToken)
 * 2. Si tiene éxito: actualiza el token en AuthService y reintenta la request original
 * 3. Si falla: limpia sesión y redirige al login
 *
 * Usa HttpBackend directamente para evitar el bucle infinito de interceptores.
 */
export const tokenExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const refreshTokenService = inject(RefreshTokenService);
  const httpBackend = inject(HttpBackend);

  return next(req).pipe(
    catchError(error => {
      if (error.status !== 401) return throwError(() => error);

      if (req.url.endsWith('/auth/refresh')) {
        signOutAndClear(auth, refreshTokenService);
        return throwError(() => error);
      }

      const refreshToken = refreshTokenService.getRefreshToken();
      const userId = refreshTokenService.getUserIdFromToken();

      if (!refreshToken || !userId) {
        signOutAndClear(auth, refreshTokenService);
        return throwError(() => error);
      }

      const http = new HttpClient(httpBackend);

      return http
        .post<RefreshResponse>(`${environment.apiUrl}/auth/refresh`, { userId, refreshToken })
        .pipe(
          switchMap(response => {
            auth.token.set(response.accessToken);
            saveAccessToken(response.accessToken);
            refreshTokenService.save(response.refreshToken);

            const retryReq = req.clone({
              setHeaders: { Authorization: `Bearer ${response.accessToken}` },
            });
            return next(retryReq);
          }),
          catchError(refreshError => {
            signOutAndClear(auth, refreshTokenService);
            return throwError(() => refreshError);
          }),
        );
    }),
  );
};

function saveAccessToken(token: string): void {
  if (environment.auth.tokenStorage === 'cookie') {
    const secure = environment.production ? '; Secure' : '';
    document.cookie = `${environment.auth.accessTokenKey}=${encodeURIComponent(token)}; path=/; SameSite=Strict${secure}`;
  } else {
    localStorage.setItem(environment.auth.accessTokenKey, token);
  }
}

function signOutAndClear(auth: AuthService, refreshTokenService: RefreshTokenService): void {
  refreshTokenService.clear();
  auth.signOut();
}
