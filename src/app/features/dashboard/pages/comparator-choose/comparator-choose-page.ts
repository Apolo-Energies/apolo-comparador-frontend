import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { BrandModulesService } from '../../../../core/services/brand-modules.service';
import { COMPARATOR_HUB_ROUTES, HubEnergy, HubTab } from '../../../../shared/components/comparator-hub-nav/comparator-hub-nav';

interface EnergyChoice {
  key: HubEnergy;
  title: string;
  summary: string;
  need: Record<HubTab, string[]>;
}

const CHOICES: EnergyChoice[] = [
  {
    key: 'luz', title: 'Luz', summary: 'Suministro eléctrico',
    need: {
      comparar: ['Factura de luz del cliente, en PDF o foto'],
      sips:     ['CUPS del punto de suministro de luz'],
    },
  },
  {
    key: 'gas', title: 'Gas', summary: 'Gas natural',
    need: {
      comparar: ['Factura de gas del cliente, en PDF o foto'],
      sips:     ['CUPS del punto de suministro de gas'],
    },
  },
];

/**
 * Paso previo del Comparador y SIPS: antes de la herramienta se
 * pregunta qué suministro, igual que en Alta rápida. Cada tarjeta lleva a la ruta de siempre.
 * Sin gas (marcas que no lo tienen) no hay nada que elegir y se va directo a luz.
 */
@Component({
  selector: 'app-comparator-choose-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './comparator-choose-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparatorChoosePage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly brandModules = inject(BrandModulesService);

  readonly choices = CHOICES;

  readonly tabs = computed(() => [
    ...(this.brandModules.brandAllows('comparator') ? [{ key: 'comparar' as const, label: 'Comparar factura' }] : []),
    ...(this.brandModules.brandAllows('sips')       ? [{ key: 'sips' as const,     label: 'Consulta SIPS' }]   : []),
  ]);

  private readonly param = toSignal(this.route.queryParamMap.pipe(map(q => q.get('herramienta'))), { initialValue: null });
  readonly tab = computed<HubTab>(() => (this.param() === 'sips' ? 'sips' : 'comparar'));

  readonly question = computed(() => this.tab() === 'sips' ? '¿Qué punto de suministro va a consultar?' : '¿Qué factura va a comparar?');
  readonly subtitle = computed(() => this.tab() === 'sips'
    ? 'Consulte los datos de un punto de suministro. Elija primero si es de luz o de gas.'
    : 'Compare la tarifa del cliente con la de Apolo. Cada comparación crea una oportunidad automáticamente. Elija primero el tipo de suministro.');

  constructor() {
    if (!environment.features.userDetail) {
      this.router.navigateByUrl(COMPARATOR_HUB_ROUTES[this.tab()].luz, { replaceUrl: true });
    }
  }

  routeFor(energy: HubEnergy): string {
    return COMPARATOR_HUB_ROUTES[this.tab()][energy];
  }

  cta(c: EnergyChoice): string {
    return this.tab() === 'sips' ? `Consultar CUPS de ${c.title.toLowerCase()}` : `Comparar factura de ${c.title.toLowerCase()}`;
  }
}
