import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ApoloIcons, DateIcon, LightningIcon, UiIconSource, UserSimpleIcon } from '@apolo-energies/icons';
import { OpportunitySummary } from '../../../../../../entities/opportunity.model';

@Component({
  selector: 'app-opportunity-card',
  standalone: true,
  imports: [ApoloIcons],
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

  readonly consumptionText = computed(() => {
    const v = this.opportunity().lastAnnualConsumption;
    if (v === null || v === undefined) return null;
    return v.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' kWh';
  });
}
