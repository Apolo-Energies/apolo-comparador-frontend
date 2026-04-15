import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { KpiCardViewModel, TREND } from '../../models/dashboard-ui.models';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [],
  templateUrl: './kpi-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardComponent {
  readonly kpi = input.required<KpiCardViewModel>();

  readonly Trend = TREND;
}
