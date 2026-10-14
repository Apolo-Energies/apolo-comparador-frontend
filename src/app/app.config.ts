import { APP_INITIALIZER, ApplicationConfig, LOCALE_ID, PLATFORM_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { HttpBackend, HttpClient, provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { isPlatformBrowser, registerLocaleData } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import localeEs from '@angular/common/locales/es';

registerLocaleData(localeEs, 'es-ES');
import { authInterceptor, AuthService, provideAuth } from '@apolo-energies/auth';
import { providePrimeNG } from 'primeng/config';
import { MessageService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { authResponseInterceptor } from './core/interceptors/auth-response.interceptor';
import { tokenExpiryInterceptor } from './core/interceptors/token-expiry.interceptor';
import { RefreshTokenService } from './core/services/refresh-token.service';

interface RefreshResponse {
  accessToken?:  string;
  access_token?: string;
  refreshToken?:  string;
  refresh_token?: string;
}

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

function saveAccessToken(token: string): void {
  if (environment.auth.tokenStorage === 'cookie') {
    const secure = environment.production ? '; Secure' : '';
    document.cookie = `${environment.auth.accessTokenKey}=${encodeURIComponent(token)}; path=/; SameSite=Strict${secure}`;
  } else {
    localStorage.setItem(environment.auth.accessTokenKey, token);
  }
}

// Refresh proactivo al arrancar; usa HttpBackend para esquivar el tokenExpiryInterceptor.
async function refreshSessionIfPossible(
  auth: AuthService,
  refreshTokenSvc: RefreshTokenService,
  httpBackend: HttpBackend,
): Promise<void> {
  const refresh = refreshTokenSvc.getRefreshToken();
  const userId  = refreshTokenSvc.getUserIdFromToken();

  if (!refresh || !userId) {
    const current = auth.token();
    if (current && isJwtExpired(current)) {
      refreshTokenSvc.clear();
      auth.signOut();
    }
    return;
  }

  try {
    const http = new HttpClient(httpBackend);
    const res  = await firstValueFrom(
      http.post<RefreshResponse>(`${environment.apiUrl}/auth/refresh`, { userId, refreshToken: refresh }),
    );
    const newToken   = res.accessToken  ?? res.access_token  ?? '';
    const newRefresh = res.refreshToken ?? res.refresh_token ?? '';
    if (newToken) {
      auth.token.set(newToken);
      saveAccessToken(newToken);
    }
    if (newRefresh) refreshTokenSvc.save(newRefresh);
  } catch {
    refreshTokenSvc.clear();
    auth.signOut();
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: LOCALE_ID, useValue: 'es-ES' },
    provideRouter(routes, withComponentInputBinding()),
    providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.dark' } } }),
    MessageService,
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
      useFactory: (
        auth:            AuthService,
        platformId:      object,
        refreshTokenSvc: RefreshTokenService,
        httpBackend:     HttpBackend,
      ) => async () => {
        if (!isPlatformBrowser(platformId)) return;

        await refreshSessionIfPossible(auth, refreshTokenSvc, httpBackend);

        const env = environment as { faviconUrl?: string; appTitle?: string };
        if (env.faviconUrl) {
          const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
          if (link) link.href = env.faviconUrl;
        }
        if (env.appTitle) {
          document.title = env.appTitle;
        }
      },
      deps: [AuthService, PLATFORM_ID, RefreshTokenService, HttpBackend],
      multi: true,
    },
  ],
};
