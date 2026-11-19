import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { OpportunityCountsStore } from '../../../../core/services/opportunity-counts.store';
import { EsNumberPipe } from '../../../../shared/pipes/es-number.pipe';

export const OPPORTUNITIES_ROUTES = {
  luz: '/dashboard/analytics/opportunities/luz',
  gas: '/dashboard/analytics/opportunities/gas',
} as const;

interface EnergyChoice {
  key: 'luz' | 'gas';
  title: string;
  summary: string;
  cta: string;
}

const CHOICES: EnergyChoice[] = [
  { key: 'luz', title: 'Luz', summary: 'Oportunidades de suministro eléctrico', cta: 'Ver oportunidades de luz' },
  { key: 'gas', title: 'Gas', summary: 'Oportunidades de gas natural',          cta: 'Ver oportunidades de gas' },
];

/**
 * Paso previo de Oportunidades: antes del tablero se elige el suministro, igual que en
 * Alta rápida y el Comparador. Quien no tiene gas (Colaborador) va directo a luz.
 */
@Component({
  selector: 'app-opportunities-choose-page',
  standalone: true,
  imports: [RouterLink, EsNumberPipe],
  templateUrl: './opportunities-choose-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunitiesChoosePage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly counts = inject(OpportunityCountsStore);

  readonly choices = CHOICES;
  readonly routes = OPPORTUNITIES_ROUTES;

  /** Pendientes por suministro (null mientras carga). */
  readonly pending = computed(() => {
    const b = this.counts.badges();
    return b ? { luz: b.electricity ?? 0, gas: b.gas ?? 0 } : null;
  });

  constructor() {
    const roles = getUserRoles(this.auth.currentUser());
    const isColaborador = (roles.includes('Colaborador') || roles.includes('Colaborador - Referenciador')) && !roles.includes('Master');
    if (isColaborador) {
      this.router.navigateByUrl(OPPORTUNITIES_ROUTES.luz, { replaceUrl: true });
      return;
    }
    this.counts.ensureLoaded();
  }
}
