import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { MonthlyRowDatum } from '../../../../../../shared/utils/chart.utils';
import { PERIODS, Period } from '../../../../../../shared/constants/period';
import {
  CHART_H,
  COLORS,
  PAD_B,
  PAD_L,
  PAD_R,
  StackBar,
  computeBars,
  computeGridLines,
  computeMaxTotal,
  fmt,
  roundedTopPath,
} from './monthly-chart.helpers';

@Component({
  selector: 'app-sips-monthly-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './monthly-chart.component.html',
})
export class SipsMonthlyChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgEl') svgRef!: ElementRef<SVGSVGElement>;

  readonly title = input('');
  readonly data = input<MonthlyRowDatum[]>([]);
  readonly periods = input<readonly Period[]>(PERIODS);

  readonly CHART_H = CHART_H;
  readonly PAD_L = PAD_L;
  readonly PAD_R = PAD_R;
  readonly PAD_B = PAD_B;

  readonly legendEntries = computed(() => this.periods().map(key => ({
    key,
    color: COLORS[key],
  })));

  readonly w = signal(0);
  readonly tooltip = signal<{
    month: string;
    total: number;
    x: number;
    y: number;
  } | null>(null);

  private readonly zone = inject(NgZone);
  private ro?: ResizeObserver;

  ngAfterViewInit(): void {
    const el = this.svgRef.nativeElement;

    requestAnimationFrame(() => {
      this.zone.run(() => this.w.set(Math.round(el.getBoundingClientRect().width)));
    });

    this.ro = new ResizeObserver(entries => {
      this.zone.run(() => this.w.set(Math.round(entries[0].contentRect.width)));
    });

    this.ro.observe(el);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  private readonly drawW = computed(() => Math.max(0, this.w() - PAD_L - PAD_R));

  private readonly maxTotal = computed(() => computeMaxTotal(this.data(), this.periods()));

  readonly gridLines = computed(() => computeGridLines(this.maxTotal()));

  readonly bars = computed(() =>
    computeBars(this.data(), this.periods(), this.maxTotal(), this.drawW())
  );

  roundedTop(x: number, y: number, w: number, h: number): string {
    return roundedTopPath(x, y, w, h, 6);
  }

  fmt(v: number): string {
    return fmt(v);
  }

  clampX(x: number): number {
    return Math.max(PAD_L, Math.min(x, this.w() - PAD_R - 100));
  }

  tooltipSet(bar: StackBar): void {
    this.tooltip.set({
      month: bar.month,
      total: bar.total,
      x: bar.x + bar.w / 2,
      y: bar.topY - 10,
    });
  }

  tooltipClear(): void {
    this.tooltip.set(null);
  }
}
