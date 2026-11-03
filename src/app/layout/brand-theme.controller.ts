import { signal } from '@angular/core';
import { BrandModulesService } from '../core/services/brand-modules.service';
import { BrandConfig } from '../core/models/brand.model';
import { environment } from '../../environments/environment';

const TENANT_BRANDING = environment as { faviconUrl?: string; appTitle?: string };

export interface BrandThemeDeps {
  brandModules: BrandModulesService;
}

/**
 * Si el colaborador logueado pertenece a una marca blanca, reemplaza el logo
 * del sidebar/header, el favicon y el título de la pestaña por los de esa
 * marca — mismas imágenes (`kind: 'logo'` / `kind: 'favicon'`) que ya se
 * suben desde el admin de Marcas Blancas. El título de pestaña por defecto
 * (`environment.appTitle`, ej. "APOLO ENERGIES") lo setea app.config.ts al
 * arrancar la app, antes del login — acá solo lo pisamos si hay marca.
 * La marca se resuelve en BrandModulesService (misma carga que usan el
 * menú y los guards para los módulos habilitados).
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
    this.deps.brandModules.ensureLoaded().subscribe(config => {
      if (config) this.applyBrand(config);
      else this.resetToTenantDefault();
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

  private applyBrand(config: BrandConfig): void {
    const logo = config.images.find(img => img.kind === 'logo')?.url;
    if (logo) this.logoUrl.set(logo);

    const favicon = config.images.find(img => img.kind === 'favicon')?.url;
    if (favicon) this.applyFavicon(favicon);

    if (config.name) document.title = config.name;

    this.loading.set(false);
  }

  private applyFavicon(url: string): void {
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
      ?? document.createElement('link');
    link.rel = 'icon';
    link.href = url;
    if (!link.isConnected) document.head.appendChild(link);
  }
}
