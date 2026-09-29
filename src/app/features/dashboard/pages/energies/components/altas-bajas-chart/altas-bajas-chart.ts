import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Chart } from 'chart.js';
import { AltasBajasSeries } from '../../../../../../core/services/energy-expert.service';
import {
  barValuesPlugin,
  buildBarDatasets,
  buildChartOptions,
  mapPointsToLabels,
  shouldRotateLabels,
} from './altas-bajas-chart.helpers';

@Component({
  selector: 'app-altas-bajas-chart',
  standalone: true,
  imports: [],
  templateUrl: './altas-bajas-chart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AltasBajasChartComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  readonly title   = input.required<string>();
  readonly data    = input.required<AltasBajasSeries | null>();
  readonly loading = input<boolean>(false);

  private canvasElRef?: ElementRef<HTMLCanvasElement>;
  private chart?:       Chart;
  private chartLib?:    typeof import('chart.js');

  @ViewChild('barCanvas')
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

  hasPoints(): boolean {
    return (this.data()?.points?.length ?? 0) > 0;
  }

  private render(): void {
    if (!this.chartLib || !this.canvasElRef) return;

    const d = this.data();
    if (!d || d.points.length === 0) {
      this.chart?.destroy();
      this.chart = undefined;
      return;
    }

    const labels   = mapPointsToLabels(d.points);
    const datasets = buildBarDatasets(d.points);
    const rotate   = shouldRotateLabels(labels.length);

    if (this.chart) {
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = datasets[0].data;
      this.chart.data.datasets[1].data = datasets[1].data;
      this.chart.data.datasets[2].data = datasets[2].data;
      const xTicks = (this.chart.options.scales?.['x']?.ticks ?? {}) as { maxRotation?: number; minRotation?: number };
      xTicks.maxRotation = rotate ? 45 : 0;
      xTicks.minRotation = rotate ? 45 : 0;
      this.chart.update('none');
      return;
    }

    this.chart = new this.chartLib.Chart(this.canvasElRef.nativeElement, {
      type: 'bar',
      plugins: [barValuesPlugin],
      data: { labels, datasets },
      options: buildChartOptions(rotate),
    });
  }
}
