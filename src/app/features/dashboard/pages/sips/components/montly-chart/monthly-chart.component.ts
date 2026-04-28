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
import { PERIODS } from '../../../../../../shared/constants/period';

interface Segment {
  y: number;
  h: number;
  color: string;
  period: string;
}

interface StackBar {
  x: number;
  w: number;
  month: string;
  segments: Segment[];
  total: number;
  topY: number;
}

interface GridLine {
  y: number;
  label: string;
}

const CHART_H = 350;
const PAD_L = 55;
const PAD_R = 20;
const PAD_T = 10;
const PAD_B = 40;
const TICK_CNT = 5;
const DRAW_H = CHART_H - PAD_T - PAD_B;

const COLORS: Record<string, string> = {
  P1: '#7C67F2',
  P2: '#8FDBFF',
  P3: '#FFB86B',
  P4: '#F691A6',
  P5: '#C4C4C4',
  P6: '#999DF8',
};

const MAX_BAR_W = 30;
const MIN_BAR_W = 8;
const BAR_WIDTH_RATIO = 0.6;

function niceMax(v: number): number {
  if (!v) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / exp) * exp;
}

function fmt(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k';
  return String(Math.round(v));
}

function roundedTopPath(
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): string {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

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

  readonly CHART_H = CHART_H;
  readonly PAD_L = PAD_L;
  readonly PAD_R = PAD_R;
  readonly PAD_B = PAD_B;

  readonly legendEntries = PERIODS.map(key => ({
    key,
    color: COLORS[key],
  }));

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

  private readonly maxTotal = computed(() => {
    const max = Math.max(
      ...this.data().map(row => PERIODS.reduce((sum, period) => sum + (row[period] ?? 0), 0)),
      0
    );

    return niceMax(max);
  });

  readonly gridLines = computed((): GridLine[] => {
    const max = this.maxTotal();

    return Array.from({ length: TICK_CNT + 1 }, (_, i) => {
      const v = Math.round((max / TICK_CNT) * i);
      const y = PAD_T + DRAW_H - (v / max) * DRAW_H;
      return { y, label: fmt(v) };
    });
  });

  readonly bars = computed((): StackBar[] => {
    const rows = this.data();
    const n = rows.length;
    const max = this.maxTotal();

    if (!n || !max) return [];

    const dw = this.drawW();
    const slotW = dw / n;
    const w = Math.max(MIN_BAR_W, Math.min(MAX_BAR_W, slotW * BAR_WIDTH_RATIO));
    const gap = Math.max(0, (dw - w * n) / (n + 1));

    return rows.map((row, i) => {
      const x = PAD_L + gap + i * (w + gap);
      const total = PERIODS.reduce((sum, period) => sum + (row[period] ?? 0), 0);

      let cumulativeH = 0;
      const segments: Segment[] = PERIODS
        .filter(period => (row[period] ?? 0) > 0)
        .map(period => {
          const value = row[period] ?? 0;
          const h = (value / max) * DRAW_H;
          const y = PAD_T + DRAW_H - cumulativeH - h;
          cumulativeH += h;

          return {
            y,
            h,
            color: COLORS[period],
            period,
          };
        });

      const topY = segments.at(-1)?.y ?? PAD_T + DRAW_H;

      return {
        x,
        w,
        month: row.month,
        segments,
        total,
        topY,
      };
    });
  });

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
