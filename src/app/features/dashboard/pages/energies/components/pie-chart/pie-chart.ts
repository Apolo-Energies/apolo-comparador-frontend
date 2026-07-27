import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Chart, Plugin } from 'chart.js';
import { PieBreakdown } from '../../../../../../services/energy-expert.service';
import { EsNumberPipe } from '../../../../../../shared/pipes/es-number.pipe';
import {
  CHART_BORDER_SUBTLE,
  CHART_FONT_FAMILY,
  CHART_SURFACE,
  CHART_TEXT_FG,
  CHART_TEXT_MUTED,
  DEFAULT_STATUS_COLOR,
  STATUS_COLORS,
} from '../../energies.constants';

/** Item pre-computado para la leyenda HTML. */
export interface LegendItem {
  label:   string;
  value:   number;
  color:   string;
  /** Ya formateado como "39,7%" para renderizar directo. */
  percent: string;
}

/**
 * Plugin: dibuja "TOTAL" + valor grande en el centro del doughnut.
 * Configurable por chart via options.plugins.doughnutCenter = { total, unit }.
 */
const doughnutCenterPlugin: Plugin<'doughnut'> = {
  id: 'doughnutCenter',
  afterDraw(chart) {
    const opts = (chart.options.plugins as unknown as { doughnutCenter?: { total: number; unit?: string } })
      ?.doughnutCenter;
    if (!opts) return;

    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top  + chartArea.bottom) / 2;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `600 9px ${CHART_FONT_FAMILY}`;
    ctx.fillStyle = CHART_TEXT_MUTED;
    ctx.fillText('TOTAL', cx, cy - 18);

    const formatted = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(opts.total);
    ctx.font = `600 24px ${CHART_FONT_FAMILY}`;
    ctx.fillStyle = CHART_TEXT_FG;
    ctx.fillText(formatted, cx, cy + 4);

    if (opts.unit) {
      ctx.font = `500 10px ${CHART_FONT_FAMILY}`;
      ctx.fillStyle = CHART_TEXT_MUTED;
      ctx.fillText(opts.unit, cx, cy + 22);
    }

    ctx.restore();
  },
};

@Component({
  selector: 'app-status-pie-chart',
  standalone: true,
  imports: [EsNumberPipe],
  templateUrl: './pie-chart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPieChartComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  readonly title   = input.required<string>();
  readonly data    = input.required<PieBreakdown | null>();
  readonly loading = input<boolean>(false);
  /** Unidad opcional que se muestra bajo el total (ej. "MWh"). */
  readonly unit    = input<string>('');

  /** Items para la leyenda HTML (fuera del canvas para más control). */
  readonly legendItems = computed<LegendItem[]>(() => {
    const d = this.data();
    if (!d || d.total <= 0) return [];
    const total = d.total;
    return d.segments.map(s => ({
      label:   s.label,
      value:   s.value,
      color:   STATUS_COLORS[s.label] ?? DEFAULT_STATUS_COLOR,
      percent: ((s.value / total) * 100).toFixed(1).replace('.', ',') + '%',
    }));
  });

  readonly hasData = computed(() => {
    const d = this.data();
    return d != null && d.total > 0;
  });

  private canvasElRef?: ElementRef<HTMLCanvasElement>;
  private chart?:       Chart;
  private chartLib?:    typeof import('chart.js');

  @ViewChild('pieCanvas')
  set canvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    if (!ref && this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
    this.canvasElRef = ref;
    if (this.chartLib && ref) this.render();
  }

  constructor() {
    effect(() => {
      this.data();
      if (this.chartLib && this.canvasElRef) this.render();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.chartLib = await import('chart.js/auto');
    this.render();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private render(): void {
    if (!this.chartLib || !this.canvasElRef) return;

    const d = this.data();
    if (!d || d.total <= 0) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const labels = d.segments.map(s => s.label);
    const values = d.segments.map(s => s.value);
    const colors = d.segments.map(s => STATUS_COLORS[s.label] ?? DEFAULT_STATUS_COLOR);

    const maxIdx  = values.indexOf(Math.max(...values));
    const offsets = values.map((_, i) => (i === maxIdx ? 6 : 0));

    if (this.chart) {
      this.chart.data.labels = labels;
      const ds = this.chart.data.datasets[0];
      ds.data = values;
      ds.backgroundColor = colors;
      (ds as { offset?: number[] }).offset = offsets;
      (this.chart.options.plugins as unknown as { doughnutCenter: { total: number; unit: string } }).doughnutCenter =
        { total: d.total, unit: this.unit() };
      this.chart.update('none');
      return;
    }

    this.chart = new this.chartLib.Chart(this.canvasElRef.nativeElement, {
      type: 'doughnut',
      plugins: [doughnutCenterPlugin],
      data: {
        labels,
        datasets: [{
          // label vacío para evitar cualquier fallback de Chart.js
          label: '',
          data: values,
          backgroundColor: colors,
          borderColor: CHART_SURFACE,
          borderWidth: 2,
          hoverOffset: 12,
          hoverBorderColor: CHART_SURFACE,
          offset: offsets,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        layout: { padding: 8 },
        animation: { animateRotate: true, animateScale: true, duration: 500, easing: 'easeOutCubic' },
        plugins: {
          // Ocultamos legend + title del canvas: renderizamos leyenda en HTML.
          legend:   { display: false },
          title:    { display: false },
          subtitle: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: CHART_SURFACE,
            borderColor:  CHART_BORDER_SUBTLE,
            borderWidth: 1,
            titleColor:  CHART_TEXT_FG,
            bodyColor:   CHART_TEXT_MUTED,
            titleFont:   { family: CHART_FONT_FAMILY, size: 12, weight: 600 },
            bodyFont:    { family: CHART_FONT_FAMILY, size: 11 },
            padding: 10,
            cornerRadius: 8,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              title: (items) => (items[0]?.label as string) ?? '',
              label: (ctx) => {
                const v = ctx.parsed;
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0';
                const val = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(v);
                return ` ${val} · ${pct}%`;
              },
            },
          },
          ...({ doughnutCenter: { total: d.total, unit: this.unit() } } as object),
        },
      },
    });
  }
}
