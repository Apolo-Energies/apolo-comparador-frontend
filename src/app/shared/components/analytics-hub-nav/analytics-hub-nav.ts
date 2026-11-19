import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavSectionsService } from '../../../layout/nav-sections.service';
import { EnergyRouteToggleComponent } from '../energy-route-toggle/energy-route-toggle.component';

export type AnalyticsSection = 'history' | 'statistics' | 'reports';

const SECTIONS: Record<AnalyticsSection, { label: string; luz: string; gas: string; subtitle: string }> = {
  history:    { label: 'Historial',    luz: '/dashboard/analytics/history',    gas: '/dashboard/analytics/history/gas',
                subtitle: 'Todas las comparativas realizadas, con su usuario y fecha.' },
  statistics: { label: 'Estadísticas', luz: '/dashboard/analytics/statistics', gas: '/dashboard/analytics/statistics/gas',
                subtitle: 'Actividad de comparativas por día y por mes, y detalle por usuario.' },
  reports:    { label: 'Reportes',     luz: '/dashboard/analytics/reports',    gas: '/dashboard/analytics/reports/gas',
                subtitle: 'Oportunidades, analítica y alertas en tiempo real.' },
};

/**
 * Cabecera común de Analítica: navegación entre Historial / Estadísticas /
 * Reportes y selector Luz / Gas. Es navegación entre páginas (enlaces con aria-current),
 * no un tablist. Solo muestra las secciones que el menú da al usuario (NavSectionsService).
 */
@Component({
  selector: 'app-analytics-hub-nav',
  standalone: true,
  imports: [RouterLink, EnergyRouteToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header class="mb-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Analítica</h1>
          <p class="mt-1 text-sm text-muted-foreground">{{ current().subtitle }}</p>
        </div>
        <ng-content select="[actions]" />
      </div>

      <div class="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <nav class="-mb-px flex min-w-0 gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]" aria-label="Secciones de analítica">
          @for (s of sections(); track s.key) {
            <a [routerLink]="s.luz"
               [attr.aria-current]="section() === s.key ? 'page' : null"
               class="inline-flex flex-none items-center whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150"
               [class]="section() === s.key
                 ? 'border-primary text-foreground'
                 : 'border-transparent text-muted-foreground hover:text-foreground'">
              {{ s.label }}
            </a>
          }
        </nav>
        <div class="mb-2">
          <app-energy-route-toggle [luzUrl]="current().luz" [gasUrl]="current().gas" [bare]="true" />
        </div>
      </div>
    </header>
  `,
})
export class AnalyticsHubNavComponent {
  readonly section = input.required<AnalyticsSection>();
  private readonly nav = inject(NavSectionsService);

  readonly current = computed(() => SECTIONS[this.section()]);

  /** Secciones visibles: los hijos de "Analítica" que el menú ya filtró por rol y marca. */
  readonly sections = computed(() => {
    const allowed = new Set((this.nav.tools().find(t => t.item.title === 'Analítica')?.children ?? []).map(c => c.url));
    return (Object.keys(SECTIONS) as AnalyticsSection[])
      .map(key => ({ key, ...SECTIONS[key] }))
      .filter(s => allowed.has(s.luz) || s.key === this.section());
  });
}
