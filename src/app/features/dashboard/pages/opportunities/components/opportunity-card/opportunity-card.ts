import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ApoloIcons, DateIcon, LightningIcon, UiIconSource, UserSimpleIcon } from '@apolo-energies/icons';
import { OpportunitySummary } from '../../../../../../entities/opportunity.model';
import { EsNumberPipe } from '../../../../../../shared/pipes/es-number.pipe';

@Component({
  selector: 'app-opportunity-card',
  standalone: true,
  imports: [ApoloIcons, EsNumberPipe],
  templateUrl: './opportunity-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunityCardComponent {
  readonly opportunity = input.required<OpportunitySummary>();
  readonly open = output<OpportunitySummary>();

  readonly userIcon:  UiIconSource = { type: 'apolo', icon: UserSimpleIcon, size: 14 };
  readonly dateIcon:  UiIconSource = { type: 'apolo', icon: DateIcon,       size: 14 };
  readonly flashIcon: UiIconSource = { type: 'apolo', icon: LightningIcon,   size: 13 };

  readonly titleText = computed(() => {
    const o = this.opportunity();
    return (o.client?.name?.trim()) || 'Sin cliente';
  });

  readonly subtitleText = computed(() => {
    const o = this.opportunity();
    return o.tariff?.trim() || 'Sin tarifa configurada';
  });

  readonly creatorText = computed(() => this.opportunity().createdBy?.fullName || 'Administrador');

  readonly relativeDate = computed(() => {
    const date = new Date(this.opportunity().updatedAt);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '');
  });

  readonly consumption = computed(() => this.opportunity().lastAnnualConsumption);
}
