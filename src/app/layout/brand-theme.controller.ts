import { signal } from '@angular/core';
import { AuthService } from '@apolo-energies/auth';
import { BrandService } from '../core/services/brand.service';
import { UserService } from '../core/services/user.service';
import { environment } from '../../environments/environment';

const TENANT_BRANDING = environment as { faviconUrl?: string; appTitle?: string };

export interface BrandThemeDeps {
  brandService: BrandService;
  userService:  UserService;
  auth:         AuthService;
}

/**
 * Si el colaborador logueado pertenece a una marca blanca, reemplaza el logo
 * del sidebar/header, el favicon y el título de la pestaña por los de esa
 * marca — mismas imágenes (`kind: 'logo'` / `kind: 'favicon'`) que ya se
 * suben desde el admin de Marcas Blancas. El título de pestaña por defecto
 * (`environment.appTitle`, ej. "APOLO ENERGIES") lo setea app.config.ts al
 * arrancar la app, antes del login — acá solo lo pisamos si hay marca.
 * `brandSlug` nunca viene en el JWT (dato mutable): se resuelve siempre
 * fresco vía GET /user/{id}, con el id que sí trae el token (claim `sub`).
 * Sin marca asignada, o si falla alguna carga, se queda con el branding por
 * defecto del tenant. Extraído de Layout para mantenerlo bajo el límite de
 * líneas (R1).
 */
export class BrandThemeController {
  constructor(private readonly deps: BrandThemeDeps) {}

  // true hasta resolver si hay marca o no — evita el flash del logo del
  // tenant por defecto en colaboradores de marca blanca (ver logoSrc en Layout).
  readonly loading = signal(true);
  readonly logoUrl = signal<string | null>(null);

  load(): void {
    const userId = this.deps.auth.currentUser()?.id;
    if (!userId) { this.resetToTenantDefault(); return; }

    this.deps.userService.getById(String(userId)).subscribe({
      next: user => {
        if (user.brandSlug) this.loadBrand(user.brandSlug);
        else this.resetToTenantDefault();
      },
      error: () => this.resetToTenantDefault(),
    });
  }

  /**
   * Revierte logo/favicon/título al default del tenant. Necesario porque son
   * mutaciones directas al DOM (no estado de Angular): si un colaborador de
   * marca blanca cierra sesión y entra otro sin marca en la misma pestaña,
   * sin esto quedarían pegados el logo/favicon/título de la marca anterior
   * hasta un refresh manual.
   */
  private resetToTenantDefault(): void {
    this.logoUrl.set(null);
    if (TENANT_BRANDING.faviconUrl) this.applyFavicon(TENANT_BRANDING.faviconUrl);
    if (TENANT_BRANDING.appTitle) document.title = TENANT_BRANDING.appTitle;
    this.loading.set(false);
  }

  private loadBrand(slug: string): void {
    this.deps.brandService.getConfig(slug).subscribe({
      next: config => {
        const logo = config.images.find(img => img.kind === 'logo')?.url;
        if (logo) this.logoUrl.set(logo);

        const favicon = config.images.find(img => img.kind === 'favicon')?.url;
        if (favicon) this.applyFavicon(favicon);

        if (config.name) document.title = config.name;

        this.loading.set(false);
      },
      error: () => this.resetToTenantDefault(), // sin marca válida
    });
  }

  private applyFavicon(url: string): void {
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
      ?? document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    if (!link.isConnected) document.head.appendChild(link);
  }
}
