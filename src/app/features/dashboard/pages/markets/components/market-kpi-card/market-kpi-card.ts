import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MarketSpot } from '../../../../../../entities/market-data.model';

@Component({
  selector: 'app-market-kpi-card',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './market-kpi-card.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketKpiCardComponent {
  readonly label = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly currentLabel = input<string>('Último precio - Hoy');
  readonly spot = input.required<MarketSpot | null>();
  readonly loading = input<boolean>(false);

  readonly trend = computed<'up' | 'down' | 'flat'>(() => {
    const change = this.spot()?.changePercent;
    if (change == null || change === 0) return 'flat';
    return change > 0 ? 'up' : 'down';
  });

  readonly trendText = computed(() => {
    const change = this.spot()?.changePercent;
    if (change == null) return '—';
    const sign = change > 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  });

  readonly hasData = computed(() => {
    const spot = this.spot();
    return !!spot && spot.currentValue > 0;
  });
}
