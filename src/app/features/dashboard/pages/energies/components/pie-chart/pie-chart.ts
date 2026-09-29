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
import type { Chart } from 'chart.js';
import { PieBreakdown } from '../../../../../../core/services/energy-expert.service';
import { EsNumberPipe } from '../../../../../../shared/pipes/es-number.pipe';
import { CHART_SURFACE } from '../../energies.constants';
import {
  LegendItem,
  buildChartOptions,
  buildLegendItems,
  buildSegmentOffsets,
  doughnutCenterPlugin,
  segmentColors,
} from './pie-chart.helpers';

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
  readonly legendItems = computed<LegendItem[]>(() => buildLegendItems(this.data()));

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

    const labels  = d.segments.map(s => s.label);
    const values  = d.segments.map(s => s.value);
    const colors  = segmentColors(labels);
    const offsets = buildSegmentOffsets(values);

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
      options: buildChartOptions(d.total, this.unit()),
    });
  }
}
