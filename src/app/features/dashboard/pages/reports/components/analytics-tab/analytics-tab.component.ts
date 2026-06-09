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
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Chart } from 'chart.js';
import { SummaryApiResult, DailySummaryApiItem, HistoryItem } from '../../../statistics/models/dashboard-api.models';
import { fmtNum, fmtGwh, initials } from '../../report-utils';

const BAR_COLOR  = '#B79DF5';
const BAR_RGB    = '183,157,245';
const BAR_ACTIVE = '#1AD598';

const COLAB_COLORS = ['#8b5cf6', '#7dd3fc', '#fbbf24', '#f472b6', '#a3a3a3', '#818cf8'];

export type ColabPeriod = 'all' | 'month' | 'week';
type ColabWithScore = HistoryItem & { score: number };

const COLAB_PERIODS: { value: ColabPeriod; label: string }[] = [
  { value: 'all',   label: 'Todo'  },
  { value: 'month', label: 'Mes'   },
  { value: 'week',  label: 'Semana'},
];

@Component({
  selector: 'app-reports-analytics-tab',
  standalone: true,
  imports: [],
  templateUrl: './analytics-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsAnalyticsTabComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading           = input<boolean>(false);
  readonly summary           = input<SummaryApiResult | null>(null);
  readonly daily             = input<DailySummaryApiItem[]>([]);
  readonly totalComparativas = input<number>(0);
  readonly rows              = input<HistoryItem[]>([]);

  // Colabs filter inputs/outputs
  readonly colabRows    = input<HistoryItem[]>([]);
  readonly colabPeriod  = input<ColabPeriod>('all');
  readonly colabLoading = input<boolean>(false);
  readonly colabPeriodChange = output<ColabPeriod>();

  readonly topColabs = computed((): ColabWithScore[] => {
    const all = this.colabRows();
    if (!all.length) return [];
    const maxCups = Math.max(...all.map(r => r.totalCups), 1);
    const maxKwh  = Math.max(...all.map(r => r.totalAnnualConsumption), 1);
    return [...all]
      .map(r => ({
        ...r,
        score: (r.totalCups / maxCups) * 0.35 + (r.totalAnnualConsumption / maxKwh) * 0.65,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  });

  readonly colabColors  = COLAB_COLORS;
  readonly colabPeriods = COLAB_PERIODS;

  private _barRef?: ElementRef<HTMLCanvasElement>;

  // Setter fires the moment the canvas element enters the DOM (e.g. after skeleton hides).
  // Without this, ngAfterViewInit and the effect both miss the canvas when loading() starts true.
  @ViewChild('barCanvas')
  set barCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this._barRef = ref;
    if (this.chartLib && ref) this.renderBar();
  }

  private barChart?:      Chart;
  private chartLib?:      typeof import('chart.js');
  private activeBarIndex = -1;

  readonly fmtNum   = fmtNum;
  readonly fmtGwh   = fmtGwh;
  readonly initials = initials;

  constructor() {
    effect(() => {
      this.daily();
      if (this.chartLib && this._barRef) this.renderBar();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.chartLib = await import('chart.js/auto');
    this.renderBar();
  }

  ngOnDestroy(): void {
    this.barChart?.destroy();
  }

  private renderBar(): void {
    if (!this.chartLib || !this._barRef) return;
    const data   = this.daily().slice(-30);
    const labels = data.map(d => {
      const dt = new Date(d.date);
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
    });
    const values = data.map(d => d.totalCups);

    const bgColor = (ctx: any): string | CanvasGradient => {
      if (ctx.dataIndex === this.activeBarIndex) return BAR_ACTIVE;
      const { ctx: c, chartArea } = ctx.chart;
      if (!chartArea) return BAR_COLOR;
      const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      g.addColorStop(0, `rgba(${BAR_RGB},0.9)`);
      g.addColorStop(1, `rgba(${BAR_RGB},0.45)`);
      return g;
    };

    if (this.barChart) {
      (this.barChart.data.labels as string[]) = labels;
      this.barChart.data.datasets[0].data = values;
      (this.barChart.data.datasets[0] as any).backgroundColor = bgColor;
      this.barChart.update('none');
      return;
    }

    this.barChart = new this.chartLib.Chart(this._barRef.nativeElement, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'CUPS',
          data: values,
          backgroundColor: bgColor as any,
          hoverBackgroundColor: BAR_ACTIVE,
          borderWidth: 0,
          borderRadius: 6,
          borderSkipped: false,
          barPercentage: 0.85,
          categoryPercentage: 0.88,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(161,161,170,0.7)', font: { size: 10 }, maxTicksLimit: 10 } },
          y: { beginAtZero: true, grid: { color: 'rgba(63,63,70,0.5)' }, ticks: { color: 'rgba(161,161,170,0.7)', font: { size: 10 } } },
        },
        onClick: (_evt: any, elements: any[]) => {
          if (!elements.length) return;
          const idx = elements[0].index;
          this.activeBarIndex = this.activeBarIndex === idx ? -1 : idx;
          this.barChart?.update();
        },
      },
    });
  }
}
