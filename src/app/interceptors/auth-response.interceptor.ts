import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';
import { RefreshTokenService } from '../services/refresh-token.service';
import { environment } from '../../environments/environment';

/**
 * Normaliza la respuesta de /auth/login:
 * - Transforma accessToken (camelCase) → access_token (snake_case) para la librería @apolo-energies/auth
 * - Persiste el refreshToken en una cookie Secure; SameSite=Strict
 */
export const authResponseInterceptor: HttpInterceptorFn = (req, next) => {
  const refreshTokenService = inject(RefreshTokenService);

  if (!req.url.endsWith('/auth/login')) return next(req);

  return next(req).pipe(
    map(event => {
      if (!(event instanceof HttpResponse) || !event.body) return event;

      const body = event.body as Record<string, unknown>;
      const accessToken = (body['accessToken'] ?? body['access_token']) as string | undefined;
      const refreshToken = (body['refreshToken'] ?? body['refresh_token']) as string | undefined;

      if (!accessToken) return event;

      if (refreshToken) {
        refreshTokenService.save(refreshToken);
      }

      return event.clone({
        body: { ...body, access_token: accessToken, token: accessToken },
      });
    }),
  );
};
