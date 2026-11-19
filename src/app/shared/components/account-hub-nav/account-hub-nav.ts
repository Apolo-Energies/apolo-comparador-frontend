import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavSectionsService } from '../../../layout/nav-sections.service';
import { RefreshTokenService } from '../../../core/services/refresh-token.service';

export type AccountSection = 'datos' | 'documentacion' | 'comerciales' | 'comisiones';

const TEAM = [
  { key: 'comerciales' as const, label: 'Comerciales', url: '/dashboard/settings/my-comercials' },
  { key: 'comisiones' as const,  label: 'Comisiones',  url: '/dashboard/settings/sub-user-commissions' },
];

const SUBTITLES: Record<AccountSection, string> = {
  datos:         'Sus datos personales y de usuario.',
  documentacion: 'Documentación de su alta como colaborador y contrato firmado.',
  comerciales:   'Comerciales de su equipo: créelos y gestiónelos aquí.',
  comisiones:    'Comisiones de los comerciales de su equipo.',
};

/**
 * Cabecera de "Cuenta": Datos · Documentación · Comerciales · Comisiones.
 * Navegación entre páginas (enlaces con aria-current). Comerciales/Comisiones solo si el menú se
 * los da al usuario (NavSectionsService) y solo en su propio perfil.
 */
@Component({
  selector: 'app-account-hub-nav',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header class="mb-5">
      <h1 class="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground">{{ ownProfile() ? 'Cuenta' : 'Detalle de usuario' }}</h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ subtitle() }}</p>
      <div class="mt-4 border-b border-border">
        <nav class="-mb-px flex min-w-0 gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]" aria-label="Secciones de la cuenta">
          @for (t of tabs(); track t.key) {
            <a [routerLink]="t.url" [queryParams]="t.query"
               [attr.aria-current]="section() === t.key ? 'page' : null"
               class="inline-flex flex-none items-center whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150"
               [class]="section() === t.key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'">
              {{ t.label }}
            </a>
          }
        </nav>
      </div>
    </header>
  `,
})
export class AccountHubNavComponent {
  readonly section = input.required<AccountSection>();
  /** Perfil al que apuntan Datos/Documentación; por defecto, el del usuario actual. */
  readonly userId = input<string | null>(null);

  private readonly nav = inject(NavSectionsService);
  private readonly token = inject(RefreshTokenService);

  private readonly meId = this.token.getUserIdFromToken() ?? '';
  readonly profileId = computed(() => this.userId() || this.meId);
  readonly ownProfile = computed(() => this.profileId() === this.meId);
  readonly subtitle = computed(() => this.ownProfile() ? SUBTITLES[this.section()] : 'Datos y documentación del usuario.');

  readonly tabs = computed(() => {
    const profileUrl = `/dashboard/settings/users/${this.profileId()}`;
    const base = [
      { key: 'datos' as AccountSection, label: 'Datos', url: profileUrl, query: null as Record<string, string> | null },
      { key: 'documentacion' as AccountSection, label: 'Documentación', url: profileUrl, query: { seccion: 'documentacion' } },
    ];
    if (!this.ownProfile()) return base;
    const allowed = new Set(this.nav.tools().flatMap(t => t.children.map(c => c.url)));
    return [...base, ...TEAM.filter(t => allowed.has(t.url)).map(t => ({ ...t, query: null }))];
  });
}
