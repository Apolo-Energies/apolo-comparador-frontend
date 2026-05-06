import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RefreshTokenService {
  private readonly platformId = inject(PLATFORM_ID);

  // ── Refresh token (siempre en cookie) ─────────────────────────────────────

  save(refreshToken: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const secure = environment.production ? '; Secure' : '';
    document.cookie = [
      `${environment.auth.refreshTokenCookie}=${encodeURIComponent(refreshToken)}`,
      'path=/',
      'SameSite=Strict',
      'Max-Age=28800',
      secure,
    ].filter(Boolean).join('; ');
  }

  getRefreshToken(): string | null {
    return this.readCookie(environment.auth.refreshTokenCookie);
  }

  clear(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.cookie = `${environment.auth.refreshTokenCookie}=; path=/; Max-Age=0`;
  }

  // ── Access token — lee desde cookie o localStorage según environment ───────

  getUserIdFromToken(): string | null {
    return (this.decodePayload()?.['sub'] as string) ?? null;
  }

  getParentUserIdFromToken(): string | null {
    return (this.decodePayload()?.['parentUserId'] as string) ?? null;
  }

  decodePayload(): Record<string, unknown> | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const token = this.loadAccessToken();
    if (!token) return null;
    try {
      return JSON.parse(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')),
      ) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private loadAccessToken(): string | null {
    if (environment.auth.tokenStorage === 'cookie') {
      return this.readCookie(environment.auth.accessTokenKey);
    }
    return localStorage.getItem(environment.auth.accessTokenKey);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private readCookie(name: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const match = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : null;
  }
}
