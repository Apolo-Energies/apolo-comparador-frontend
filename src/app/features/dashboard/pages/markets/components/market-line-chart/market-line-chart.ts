import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Chart, ChartConfiguration } from 'chart.js';
import { MarketSeries, MarketSeriesPoint } from '../../../../../../entities/market-data.model';

@Component({
  selector: 'app-market-line-chart',
  standalone: true,
  templateUrl: './market-line-chart.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketLineChartComponent implements AfterViewInit {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly legend = input<string>('Serie');
  readonly color = input<string>('#10b981');
  readonly series = input<MarketSeries | null>(null);
  readonly loading = input<boolean>(false);

  protected readonly skeletonBars = [35, 55, 42, 70, 50, 65, 80, 60, 75, 48, 62, 90, 72, 58, 82, 68, 55, 78, 64, 88];

  @ViewChild('chartCanvas') private canvasRef?: ElementRef<HTMLCanvasElement>;
  private readonly platformId = inject(PLATFORM_ID);

  private chart: Chart | null = null;
  private chartLib: typeof import('chart.js') | null = null;

  readonly points = computed<MarketSeriesPoint[]>(() => this.series()?.points ?? []);
  readonly hasPoints = computed(() => this.points().length > 0);

  constructor() {
    effect(() => {
      this.points();
      this.color();
      queueMicrotask(() => this.render());
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.chartLib = await import('chart.js/auto');
    this.render();
  }

  private render(): void {
    if (!this.chartLib || !this.canvasRef) return;
    const points = this.points();
    if (points.length === 0) {
      this.chart?.destroy();
      this.chart = null;
      return;
    }

    const labels = points.map(p => this.formatDate(p.date));
    const data = points.map(p => p.value);
    const color = this.color();

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: this.legend(),
            data,
            borderColor: color,
            backgroundColor: this.transparent(color, 0.1),
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            pointHoverBackgroundColor: color,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            padding: 10,
            displayColors: false,
            callbacks: {
              label: (ctx) => {
                const y = ctx.parsed.y;
                if (y == null) return '';
                return `${y.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.series()?.unit ?? ''}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              maxTicksLimit: 7,
              autoSkip: true,
              color: 'rgba(100, 116, 139, 0.7)',
              font: { size: 10 },
            },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.15)' },
            ticks: {
              color: 'rgba(100, 116, 139, 0.7)',
              font: { size: 10 },
              maxTicksLimit: 5,
            },
          },
        },
      },
    };

    if (this.chart) {
      this.chart.data = config.data;
      this.chart.update('none');
      return;
    }

    this.chart = new this.chartLib.Chart(this.canvasRef.nativeElement, config);
  }

  private formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
  }

  private transparent(hex: string, alpha: number): string {
    const cleaned = hex.replace('#', '');
    const bigint = parseInt(cleaned.length === 3 ? cleaned.split('').map(c => c + c).join('') : cleaned, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
