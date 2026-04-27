import { APP_INITIALIZER, ApplicationConfig, PLATFORM_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { authInterceptor, AuthService, provideAuth } from '@apolo-energies/auth';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authResponseInterceptor } from './interceptors/auth-response.interceptor';
import { tokenExpiryInterceptor } from './interceptors/token-expiry.interceptor';
import { RefreshTokenService } from './services/refresh-token.service';

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark' } } }),
    provideClientHydration(withEventReplay()),
    provideHttpClient(
      withFetch(),
      withInterceptors([authResponseInterceptor, authInterceptor, tokenExpiryInterceptor]),
    ),
    provideAuth({
      signInPath: `${environment.apiUrl}/auth/login`,
      loginRedirect: '/',
      homeRedirect: '/dashboard/comparator',
      tokenStorage: environment.auth.tokenStorage,
      tokenCookieName: environment.auth.accessTokenKey,
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService, platformId: object, refreshTokenSvc: RefreshTokenService) => () => {
        if (!isPlatformBrowser(platformId)) return;
        const token = auth.token();
        if (token && isJwtExpired(token) && !refreshTokenSvc.getRefreshToken()) {
          auth.signOut();
        }
      },
      deps: [AuthService, PLATFORM_ID, RefreshTokenService],
      multi: true,
    },
  ],
};
