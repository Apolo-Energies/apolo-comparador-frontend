import { computed, inject, Injectable, signal } from '@angular/core';
import { SidebarChildItem, SidebarMenuItem, SidebarSection } from '@apolo-energies/sidebar';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../core/helpers/auth.utils';
import { environment } from '../../environments/environment';
import { RefreshTokenService } from '../core/services/refresh-token.service';
import { BrandModulesService } from '../core/services/brand-modules.service';
import { buildSidebarSections, hasAccess } from './layout.helpers';

/** Herramienta visible para el usuario: un ítem del menú ya filtrado por acceso. */
export interface NavTool {
  section: string;
  item: SidebarMenuItem;
  /** Ruta principal: la del ítem o la de su primer hijo visible. */
  url: string;
  children: SidebarChildItem[];
}

/**
 * Fuente única de las herramientas del portal. El menú lateral y el Inicio leen de aquí,
 * así que no pueden divergir. Solo agrupa la lógica que ya existía en
 * Layout; las reglas de visibilidad siguen en buildSidebarSections/hasAccess.
 */
@Injectable({ providedIn: 'root' })
export class NavSectionsService {
  private readonly auth = inject(AuthService);
  private readonly refreshTokenService = inject(RefreshTokenService);
  private readonly brandModules = inject(BrandModulesService);

  readonly isApolo = environment.features.userDetail;

  /** Logo efectivo (tenant o marca blanca). Lo publica Layout, que ya lo resuelve. */
  readonly logoSrc = signal<string | null>(null);

  private readonly roles = computed(() => getUserRoles(this.auth.currentUser()));

  readonly sections = computed<SidebarSection[]>(() => buildSidebarSections({
    roles: this.roles(),
    isApolo: this.isApolo,
    userId: this.refreshTokenService.getUserIdFromToken(),
    isSubUser: !!this.refreshTokenService.getParentUserIdFromToken(),
    // Lee el signal de módulos de la marca: se recalcula cuando termina de cargar.
    brandAllows: code => this.brandModules.brandAllows(code),
  }));

  readonly accessFn = (access?: string[]): boolean => hasAccess(access, getUserRoles(this.auth.currentUser()));

  /** Mismo filtrado que aplica lib-apolo-sidebar con accessFn, aplanado por herramienta. */
  readonly tools = computed<NavTool[]>(() => {
    const roles = this.roles();
    const can = (a?: string[]) => hasAccess(a, roles);
    const out: NavTool[] = [];
    for (const s of this.sections()) {
      for (const item of s.items) {
        if (!can(item.access)) continue;
        const children = (item.children ?? []).filter(c => can(c.access));
        const url = item.url ?? children[0]?.url;
        if (!url) continue;
        out.push({ section: s.section, item, url, children });
      }
    }
    return out;
  });
}
