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
import { SummaryApiResult, DailySummaryApiItem, HistoryItem } from '../../../../../../core/models/dashboard-api.model';
import { fmtNum, fmtGwh, initials } from '../../report-utils';
import { ThemeService } from '../../../../../../core/services/theme.service';
import { chartTheme, textOn } from '../../../../../../shared/utils/chart-theme';

/** Opacidades del degradado de las barras (el color sale del tema, chart-theme.ts). */
const BAR_ALPHA_TOP = 'e6';    // 90 %
const BAR_ALPHA_BOTTOM = '73'; // 45 %

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

  private readonly theme = inject(ThemeService);
  private readonly palette = computed(() => chartTheme(this.theme.portalDark()));
  /** Avatares de colaboradores: color de serie en orden fijo y letra con contraste. */
  readonly colabColors = computed(() => this.palette().series.slice(0, 6));
  readonly colabText   = computed(() => this.colabColors().map(textOn));
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
  private lastDark: boolean | null = null;

  readonly fmtNum   = fmtNum;
  readonly fmtGwh   = fmtGwh;
  readonly initials = initials;

  constructor() {
    effect(() => {
      this.daily();
      // Al cambiar de tema se rehace el gráfico: chart.js no lee variables CSS.
      const dark = this.theme.portalDark();
      if (dark !== this.lastDark) { this.barChart?.destroy(); this.barChart = undefined; this.lastDark = dark; }
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

    const t = this.palette();
    const bgColor = (ctx: any): string | CanvasGradient => {
      if (ctx.dataIndex === this.activeBarIndex) return t.barActive;
      const { ctx: c, chartArea } = ctx.chart;
      if (!chartArea) return t.bar;
      const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      g.addColorStop(0, t.bar + BAR_ALPHA_TOP);
      g.addColorStop(1, t.bar + BAR_ALPHA_BOTTOM);
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
          hoverBackgroundColor: t.barActive,
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
          x: { grid: { display: false }, ticks: { color: t.axis, font: { size: 10 }, maxTicksLimit: 10 } },
          y: { beginAtZero: true, border: { display: false }, grid: { color: t.grid }, ticks: { color: t.axis, font: { size: 10 } } },
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
