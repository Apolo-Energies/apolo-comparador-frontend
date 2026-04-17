import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ChartBar } from '../../models/dashboard-ui.models';

export interface YTick {
  label:   string;
  percent: number;
}

/** Number of intervals on the Y-axis (produces Y_TICK_COUNT + 1 gridlines). */
const Y_TICK_COUNT = 4;

/** Minimum number of bars before x-axis labels are rotated to avoid overlap. */
const ROTATE_THRESHOLD = 8;

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [],
  templateUrl: './bar-chart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
})
export class BarChartComponent {
  readonly bars  = input.required<ChartBar[]>();
  readonly color = input<string>('#a78bfa');

  readonly maxRaw = computed(() => {
    const vals = this.bars().map(b => b.value);
    return vals.length ? Math.max(...vals) : 0;
  });

  readonly niceMax = computed((): number => {
    const raw = this.maxRaw();
    if (raw === 0) return 1;
    const step = this.computeStep(raw);
    return step * Y_TICK_COUNT;
  });

  readonly yTicks = computed((): YTick[] => {
    const nm  = this.niceMax();
    const raw = this.maxRaw();
    if (raw === 0) return [];
    const step = nm / Y_TICK_COUNT;
    return Array.from({ length: Y_TICK_COUNT + 1 }, (_, i) => ({
      label:   this.fmtY(step * i),
      percent: (i / Y_TICK_COUNT) * 100,
    })).reverse();
  });

  readonly shouldRotate = computed(() => this.bars().length > ROTATE_THRESHOLD);

  barHeight(value: number): string {
    const nm = this.niceMax();
    return nm > 0 ? `${(value / nm) * 100}%` : '0%';
  }

  private computeStep(max: number): number {
    const raw = max / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    return Math.ceil(raw / mag) * mag;
  }

  private fmtY(v: number): string {
    if (v === 0)             return '0';
    if (v >= 1_000_000_000)  return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000)      return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)          return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  }
}
