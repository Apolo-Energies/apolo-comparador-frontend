import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef,
  NgZone, OnDestroy, ViewChild, computed, inject, input, signal
} from '@angular/core';

export interface DonutDatum { label: string; value: number; }
export interface TrendData { percent: number; trend: 'up' | 'down' | 'equal'; }

interface Slice {
  d: string;
  fill: string;
  label: string;
  percent: number;
  lx: number;
  ly: number;
}

const COLORS = ['#7C67F2', '#8FDBFF', '#FFB86B', '#F691A6', '#C4C4C4', '#999DF8'];
const GAP = 0.05;

function polar(cx: number, cy: number, r: number, a: number): [number, number] {
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arcPath(cx: number, cy: number, ir: number, or_: number, a0: number, a1: number): string {
  const [ox0, oy0] = polar(cx, cy, or_, a0);
  const [ox1, oy1] = polar(cx, cy, or_, a1);
  const [ix0, iy0] = polar(cx, cy, ir, a0);
  const [ix1, iy1] = polar(cx, cy, ir, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${ox0},${oy0} A${or_},${or_} 0 ${large} 1 ${ox1},${oy1} L${ix1},${iy1} A${ir},${ir} 0 ${large} 0 ${ix0},${iy0} Z`;
}

@Component({
  selector: 'app-sips-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './donut-chart.component.html',
})
export class SipsDonutChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgEl') svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('pieContainer') pieRef!: ElementRef<HTMLElement>;

  readonly title = input('');
  readonly value = input('');
  readonly data = input<DonutDatum[]>([]);
  readonly trend = input<TrendData | null>(null);

  readonly pieW = signal(0);
  readonly pieH = signal(0);

  private readonly zone = inject(NgZone);
  private ro?: ResizeObserver;

  ngAfterViewInit(): void {
    const el = this.svgRef.nativeElement;

    // Medición inicial tras el primer paint del browser
    requestAnimationFrame(() => {
      this.zone.run(() => {
        const rect = el.getBoundingClientRect();
        this.pieW.set(Math.round(rect.width));
        this.pieH.set(Math.round(rect.height));
      });
    });

    this.ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      this.zone.run(() => {
        this.pieW.set(Math.round(width));
        this.pieH.set(Math.round(height));
      });
    });
    this.ro.observe(el);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  readonly outerR = computed(() => Math.round(Math.min(this.pieW(), this.pieH()) * 0.4));
  readonly innerR = computed(() => Math.round(this.outerR() * 0.5));

  readonly slices = computed((): Slice[] => {
    const d = this.data();
    const total = d.reduce((s, x) => s + x.value, 0);
    if (!total || !this.pieW()) return [];

    const cx = this.pieW() / 2;
    const cy = this.pieH() / 2;
    const ir = this.innerR();
    const or_ = this.outerR();
    let angle = -Math.PI / 2;

    return d.map((item, i) => {
      const sweep = (item.value / total) * 2 * Math.PI - GAP;
      const a0 = angle + GAP / 2;
      const a1 = a0 + Math.max(sweep, 0.001);
      const mid = (a0 + a1) / 2;
      const lr = (ir + or_) / 2;
      const [lx, ly] = polar(cx, cy, lr, mid);
      angle = a1 + GAP / 2;
      return {
        d: arcPath(cx, cy, ir, or_, a0, a1),
        fill: COLORS[i % COLORS.length],
        label: item.label,
        percent: Math.round((item.value / total) * 100),
        lx, ly,
      };
    });
  });

  readonly trendBg = computed(() => {
    const t = this.trend();
    if (!t) return '';
    return t.trend === 'up' ? 'rgba(34,197,94,0.15)'
      : t.trend === 'down' ? 'rgba(239,68,68,0.15)'
        : 'rgba(156,163,175,0.15)';
  });

  readonly trendColor = computed(() => {
    const t = this.trend();
    if (!t) return '';
    return t.trend === 'up' ? '#22c55e'
      : t.trend === 'down' ? '#ef4444'
        : '#9ca3af';
  });

  readonly trendLabel = computed(() => {
    const t = this.trend();
    if (!t) return '';
    return t.percent > 0 ? `+${t.percent}%` : `${t.percent}%`;
  });
}
