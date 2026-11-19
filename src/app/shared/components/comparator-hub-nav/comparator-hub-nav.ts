import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { BrandModulesService } from '../../../core/services/brand-modules.service';

export type HubTab = 'comparar' | 'sips';
export type HubEnergy = 'luz' | 'gas';

/** Ruta de cada combinación pestaña × suministro (las rutas de siempre: los enlaces existentes siguen valiendo). */
export const COMPARATOR_HUB_ROUTES: Record<HubTab, Record<HubEnergy, string>> = {
  comparar: { luz: '/dashboard/comparator', gas: '/dashboard/comparator/gas' },
  sips:     { luz: '/dashboard/sips',       gas: '/dashboard/sips/gas' },
};

const SUBTITLES: Record<HubTab, string> = {
  comparar: 'Suba la factura del cliente para comparar su tarifa. Cada comparación crea una oportunidad automáticamente.',
  sips:     'Consulte los datos de un punto de suministro: distribuidora, tarifa, potencias y consumos.',
};

/**
 * Cabecera común de Comparador y SIPS: pestañas "Comparar factura" /
 * "Consulta SIPS" y el suministro elegido (Luz / Gas), con enlace a la página de elección. Navega entre las cuatro rutas existentes, así
 * que cambiar de pestaña conserva el suministro y cambiar el suministro conserva la pestaña.
 */
@Component({
  selector: 'app-comparator-hub-nav',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header class="mb-5">
      <h1 class="flex flex-wrap items-center gap-3 text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
        Comparador
        @if (gasAvailable()) {
          <span class="inline-flex items-center gap-1.5 rounded-full py-1 pl-2 pr-3 text-sm font-semibold"
                [class.alta-luz]="energy() === 'luz'" [class.alta-gas]="energy() === 'gas'"
                style="background: var(--tb); color: var(--tc)">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              @if (energy() === 'luz') { <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/> }
              @else { <path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 1.5 1 2 2.5 2 4 1-2 1-5 1-8Z"/> }
            </svg>
            {{ energy() === 'luz' ? 'Luz' : 'Gas' }}
          </span>
        }
      </h1>
      <p class="mt-1 text-sm text-muted-foreground">{{ subtitle() }}</p>

      <div class="mt-4 flex flex-wrap items-end justify-between gap-3 border-b border-border">
        <nav class="-mb-px flex min-w-0 gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none]" aria-label="Herramienta">
          @for (t of tabs(); track t.key) {
            <a [routerLink]="routeFor(t.key, energy())"
               [attr.aria-current]="tab() === t.key ? 'page' : null"
               class="inline-flex flex-none items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150"
               [class]="tab() === t.key
                 ? 'border-primary text-foreground'
                 : 'border-transparent text-muted-foreground hover:text-foreground'">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                @if (t.key === 'comparar') { <path d="M7 4v16M17 4v16M3 8l4-4 4 4M13 16l4 4 4-4"/> }
                @else { <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/> }
              </svg>
              {{ t.label }}
            </a>
          }
        </nav>
      </div>
    </header>
  `,
})
export class ComparatorHubNavComponent {
  readonly tab = input.required<HubTab>();
  readonly energy = input.required<HubEnergy>();

  private readonly brandModules = inject(BrandModulesService);


  /** Gas (comparador y SIPS) es exclusivo de Apolo: mismo criterio que el menú. */
  readonly gasAvailable = computed(() => environment.features.userDetail);

  readonly tabs = computed(() => [
    ...(this.brandModules.brandAllows('comparator') ? [{ key: 'comparar' as const, label: 'Comparar factura' }] : []),
    ...(this.brandModules.brandAllows('sips')       ? [{ key: 'sips' as const,     label: 'Consulta SIPS' }]   : []),
  ]);

  readonly subtitle = computed(() => SUBTITLES[this.tab()]);

  routeFor(tab: HubTab, energy: HubEnergy): string {
    return COMPARATOR_HUB_ROUTES[tab][this.gasAvailable() ? energy : 'luz'];
  }
}
