import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OpportunityStatus, OPPORTUNITY_STATUS_LABEL } from '../../../../../../entities/opportunity.model';

const STATUS_CLASSES: Record<OpportunityStatus, string> = {
  [OpportunityStatus.Pending]:        'opp-badge-pending',
  [OpportunityStatus.Negotiation]:    'opp-badge-negotiation',
  [OpportunityStatus.Won]:            'opp-badge-won',
  [OpportunityStatus.Lost]:           'opp-badge-lost',
  [OpportunityStatus.Meeting]:        'opp-badge-meeting',
  [OpportunityStatus.ContractSent]:   'opp-badge-contract-sent',
  [OpportunityStatus.ContractSigned]: 'opp-badge-contract-signed',
  [OpportunityStatus.Nurturing]:      'opp-badge-nurturing',
  [OpportunityStatus.Finalized]:      'opp-badge-finalized',
  [OpportunityStatus.Cancelled]:      'opp-badge-cancelled',
};

@Component({
  selector: 'app-opportunity-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
      [class]="classes()"
    >{{ label() }}</span>
  `,
})
export class OpportunityStatusBadgeComponent {
  readonly status = input.required<OpportunityStatus>();

  readonly label   = computed(() => OPPORTUNITY_STATUS_LABEL[this.status()]);
  readonly classes = computed(() => STATUS_CLASSES[this.status()]);
}
