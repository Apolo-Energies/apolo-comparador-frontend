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

export interface PowerBarDatum {
  label: string;
  value: number;
}

interface Bar {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  value: number;
}

interface GridLine {
  y: number;
  label: string;
}

const CHART_H = 350;
const PAD_L = 55;
const PAD_R = 20;
const PAD_T = 20;
const PAD_B = 40;
const TICK_CNT = 5;
const DRAW_H = CHART_H - PAD_T - PAD_B;
const BAR_COLOR = '#7C67F2';

function niceMax(v: number): number {
  if (!v) return 10;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / exp) * exp;
}

function fmt(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + '';
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

  return `M${x},${y + h}
          L${x},${y + r}
          Q${x},${y} ${x + r},${y}
          L${x + w - r},${y}
          Q${x + w},${y} ${x + w},${y + r}
          L${x + w},${y + h}
          Z`;
}

@Component({
  selector: 'app-sips-power-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './power-chart.component.html',
})
export class SipsPowerChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('svgEl') svgRef!: ElementRef<SVGSVGElement>;

  readonly title = input('');
  readonly data = input<PowerBarDatum[]>([]);

  readonly Y_LABEL_FONT_SIZE = 16;
  readonly X_LABEL_FONT_SIZE = 16;
  readonly TOOLTIP_FONT_SIZE = 16;

  // Si quieres comportamiento tipo Recharts, deja un valor acá
  readonly BAR_WIDTH_PX: number | undefined = 35;

  // Si BAR_WIDTH_PX = undefined, se usará esta proporción
  readonly BAR_WIDTH_RATIO = 0.45;

  // gap entre slots, mientras mayor el valor, más separación
  readonly BAR_GAP_RATIO = 0.25;

  readonly CHART_H = CHART_H;
  readonly PAD_L = PAD_L;
  readonly PAD_R = PAD_R;
  readonly PAD_B = PAD_B;
  readonly BAR_COLOR = BAR_COLOR;

  readonly w = signal(0);
  readonly hoveredBar = signal(-1);
  readonly tooltip = signal<{
    label: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  private readonly zone = inject(NgZone);
  private ro?: ResizeObserver;

  ngAfterViewInit(): void {
    const el = this.svgRef.nativeElement;

    requestAnimationFrame(() => {
      this.zone.run(() => {
        this.w.set(Math.round(el.getBoundingClientRect().width));
      });
    });

    this.ro = new ResizeObserver((entries) => {
      this.zone.run(() => {
        this.w.set(Math.round(entries[0].contentRect.width));
      });
    });

    this.ro.observe(el);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  private readonly drawW = computed(() => Math.max(0, this.w() - PAD_L - PAD_R));

  private readonly maxVal = computed(() => {
    const max = Math.max(...this.data().map((d) => d.value), 0);
    return niceMax(max);
  });

  readonly gridLines = computed((): GridLine[] => {
    const max = this.maxVal();

    return Array.from({ length: TICK_CNT + 1 }, (_, i) => {
      const v = Math.round((max / TICK_CNT) * i);
      const y = PAD_T + DRAW_H - (v / max) * DRAW_H;
      return { y, label: fmt(v) };
    });
  });

  readonly bars = computed((): Bar[] => {
    const data = this.data();
    const count = data.length;
    const plotW = this.drawW();
    const max = this.maxVal();

    if (!count || plotW <= 0) return [];

    const slotW = plotW / count;

    const desiredBarW =
      this.BAR_WIDTH_PX !== undefined
        ? this.BAR_WIDTH_PX
        : slotW * this.BAR_WIDTH_RATIO;

    // evita que la barra ocupe todo el slot
    const maxBarW = slotW * (1 - this.BAR_GAP_RATIO);
    const barW = Math.max(6, Math.min(desiredBarW, maxBarW));

    return data.map((item, i) => {
      const h = max > 0 ? (item.value / max) * DRAW_H : 0;
      const x = PAD_L + i * slotW + (slotW - barW) / 2;
      const y = PAD_T + DRAW_H - h;

      return {
        x,
        y,
        w: barW,
        h,
        label: item.label,
        value: item.value,
      };
    });
  });

  barPath(bar: Bar): string {
    return roundedTopPath(bar.x, bar.y, bar.w, bar.h, 4);
  }

  fmt(v: number): string {
    return fmt(v);
  }

  clampX(x: number): number {
    return Math.max(PAD_L, Math.min(x, this.w() - PAD_R - 80));
  }

  tooltipSet(bar: Bar, i: number): void {
    this.tooltip.set({
      label: bar.label,
      value: bar.value,
      x: bar.x + bar.w / 2,
      y: bar.y - 10,
    });
    this.hoveredBar.set(i);
  }

  tooltipClear(): void {
    this.tooltip.set(null);
    this.hoveredBar.set(-1);
  }
}
