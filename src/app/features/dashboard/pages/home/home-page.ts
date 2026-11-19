import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '@apolo-energies/auth';
import { environment } from '../../../../../environments/environment';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { BrandModulesService } from '../../../../core/services/brand-modules.service';
import { OpportunityCountsStore } from '../../../../core/services/opportunity-counts.store';
import { NavSectionsService, NavTool } from '../../../../layout/nav-sections.service';
import { ThemeService } from '../../../../core/services/theme.service';

/** Tarjeta del Inicio: una herramienta del portal. */
interface HomeTile {
  key: string;
  label: string;
  description: string;
  /** Trazos SVG (viewBox 24) del icono. */
  icon: SafeHtml;
  /** Color del icono y del borde en hover; tinte de fondo del icono. */
  color: string;
  tint: string;
  url: string;
  badge?: number;
}

const ICONS = {
  mercado:       '<path d="M3 17l5-5 4 4 8-9"/><path d="M15 7h5v5"/>',
  resumen:       '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  contratos:     '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  comparador:    '<path d="M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4"/>',
  oportunidades: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  alta:          '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  soporte:       '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17v.01"/>',
  cuenta:        '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
} as const;

/** Colores de cada tarjeta en tema blanco y en tema negro: [icono, tinte]. */
const COLORS: Record<keyof typeof ICONS, { light: [string, string]; dark: [string, string] }> = {
  mercado:       { light: ['#0f766e', '#e3f4f1'], dark: ['#2dd4bf', 'rgba(45, 212, 191, 0.14)'] },
  resumen:       { light: ['#d9480f', '#fff1e8'], dark: ['#fb923c', 'rgba(251, 146, 60, 0.14)'] },
  contratos:     { light: ['#2f4b7c', '#e8eef8'], dark: ['#93b4e8', 'rgba(147, 180, 232, 0.16)'] },
  comparador:    { light: ['#b7791f', '#fdf3dc'], dark: ['#fbbf24', 'rgba(251, 191, 36, 0.14)'] },
  oportunidades: { light: ['#c2255c', '#fde8f0'], dark: ['#f472b6', 'rgba(244, 114, 182, 0.14)'] },
  alta:          { light: ['#6741d9', '#eee9fc'], dark: ['#a78bfa', 'rgba(167, 139, 250, 0.16)'] },
  soporte:       { light: ['#1a7f4b', '#e6f4ec'], dark: ['#34d399', 'rgba(52, 211, 153, 0.14)'] },
  cuenta:        { light: ['#475569', '#eef1f5'], dark: ['#cbd5e1', 'rgba(203, 213, 225, 0.12)'] },
};

/**
 * Inicio del portal: las 8 herramientas principales.
 * Cada tarjeta solo aparece si su destino está entre las herramientas del usuario
 * (mismas reglas de rol, tenant y marca blanca que el menú). El resto de opciones
 * (Analítica, Ajustes, Facturación…) siguen en el menú lateral.
 */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly nav = inject(NavSectionsService);
  private readonly auth = inject(AuthService);
  private readonly counts = inject(OpportunityCountsStore);
  private readonly brandModules = inject(BrandModulesService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly theme = inject(ThemeService);

  // Constantes propias (no vienen del usuario): se marcan como confiables para que
  // el saneador de Angular no elimine los <path> del SVG.
  private readonly icons = Object.fromEntries(
    Object.entries(ICONS).map(([k, v]) => [k, this.sanitizer.bypassSecurityTrustHtml(v)]),
  ) as Record<keyof typeof ICONS, SafeHtml>;

  readonly logoSrc = computed(() => this.nav.logoSrc());

  private readonly pending = computed(() => {
    const b = this.counts.badges();
    if (!b) return 0;
    const roles = getUserRoles(this.auth.currentUser());
    const isColaborador = (roles.includes('Colaborador') || roles.includes('Colaborador - Referenciador')) && !roles.includes('Master');
    return (b.electricity ?? 0) + (isColaborador ? 0 : (b.gas ?? 0));
  });

  readonly tiles = computed<HomeTile[]>(() => {
    const tools = this.nav.tools();
    const byTitle = (title: string): NavTool | undefined => tools.find(t => t.item.title === title);
    const mode = this.theme.isDark() ? 'dark' : 'light';
    const tile = (key: keyof typeof ICONS, label: string, description: string, url: string | undefined, badge?: number): HomeTile | null =>
      url ? { key, label, description, icon: this.icons[key], color: COLORS[key][mode][0], tint: COLORS[key][mode][1], url, badge } : null;

    const contratos = byTitle('Contratos');
    const cuenta = byTitle('Mi Perfil') ?? byTitle('Ajustes');

    return [
      tile('mercado',       'Mercado',       'Gráficas y análisis',          byTitle('Mercados')?.url),
      // Resumen usa los datos de contratos: mismo acceso que Contratos.
      tile('resumen',       'Resumen',       'Su cartera de un vistazo',     contratos ? '/dashboard/resumen' : undefined),
      tile('contratos',     'Contratos',     'Tabla y detalle',              contratos?.url),
      tile('comparador',    'Comparador',    'Comparador y SIPS',            byTitle('Comparador')?.url ?? byTitle('Consultas SIPS')?.url),
      tile('oportunidades', 'Oportunidades', 'Seguimiento y pérdidas',       byTitle('Oportunidades') ? '/dashboard/analytics/opportunities' : undefined, this.pending()),
      tile('alta',          'Alta rápida',   'Nueva contratación directa',
           this.brandModules.isEnabled('quickAction') ? '/dashboard/fast-discharge/select-type' : undefined),
      tile('soporte',       'Soporte',       'Vídeos, tickets y chatbot',    byTitle('Soporte')?.url),
      tile('cuenta',        'Cuenta',        'Equipo, comisiones y tarifas', cuenta?.url),
    ].filter((t): t is HomeTile => t !== null);
  });

  constructor() {
    if (environment.features.opportunities) this.counts.ensureLoaded();
  }
}
