import { APP_INITIALIZER, ApplicationConfig, PLATFORM_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { authInterceptor, AuthService, provideAuth } from '@apolo-energies/auth';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { tokenExpiryInterceptor } from './interceptors/token-expiry.interceptor';

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
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, tokenExpiryInterceptor])),
    provideAuth({
      signInPath: `${environment.apiUrl}/auth/login`,
      loginRedirect: '/',
      homeRedirect: '/dashboard/comparator',
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthService, platformId: object) => () => {
        if (!isPlatformBrowser(platformId)) return;
        const token = auth.token();
        if (token && isJwtExpired(token)) {
          auth.signOut();
        }
      },
      deps: [AuthService, PLATFORM_ID],
      multi: true,
    },
  ],
};
