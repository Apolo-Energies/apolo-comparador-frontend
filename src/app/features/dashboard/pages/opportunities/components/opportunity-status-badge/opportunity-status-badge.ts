import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OpportunityStatus, OPPORTUNITY_STATUS_LABEL } from '../../../../../../entities/opportunity.model';

const STATUS_CLASSES: Record<OpportunityStatus, string> = {
  [OpportunityStatus.Pending]:     'bg-zinc-700/40    text-zinc-200    ring-zinc-600/40',
  [OpportunityStatus.Negotiation]: 'bg-amber-500/10   text-amber-300   ring-amber-500/20',
  [OpportunityStatus.Won]:         'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20',
  [OpportunityStatus.Lost]:        'bg-rose-500/10    text-rose-300    ring-rose-500/20',
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
