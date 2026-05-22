import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { OpportunitySummary, OpportunityStatus } from '../../../../../../entities/opportunity.model';
import { fmtDate, statusLabel } from '../../report-utils';

export type StagnantOpp = OpportunitySummary & { days: number };

@Component({
  selector: 'app-reports-alerts-tab',
  standalone: true,
  imports: [],
  templateUrl: './alerts-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsAlertsTabComponent {
  readonly loading       = input<boolean>(false);
  readonly criticalCount  = input<number>(0);
  readonly warningCount   = input<number>(0);
  readonly activeOppCount = input<number>(0);
  readonly alertBadge     = input<number>(0);
  readonly stagnant       = input<StagnantOpp[]>([]);

  readonly fmtDate    = fmtDate;
  readonly statusLabel = statusLabel;
}
