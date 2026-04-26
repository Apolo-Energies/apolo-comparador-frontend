import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '@apolo-energies/ui';
import { DownloadIcon, UiIconSource } from '@apolo-energies/icons';

import { mapDailyToChart, mapMonthlyToChart, mapSummaryToKpis } from '../../mappers/dashboard.mapper';
import { ChartBar, DASHBOARD_STATUS, DateRange, DashboardStatus, KpiCardViewModel } from '../../models/dashboard-ui.models';
import { DailySummaryApiItem, MonthlySummaryApiItem, SummaryApiResult } from '../../models/dashboard-api.models';
import { KpiCardComponent } from '../kpi-card/kpi-card';
import { BarChartComponent } from '../bar-chart/bar-chart';
import { DateRangePickerComponent } from '../date-range-picker/date-range-picker';

const CHART_COLOR = '#a78bfa';

const CHART_TITLES = {
  DAILY:   'Presupuestos Por Día',
  MONTHLY: 'Presupuestos Por Mes',
} as const;

@Component({
  selector: 'app-statistics-dashboard',
  standalone: true,
  imports: [ButtonComponent, KpiCardComponent, BarChartComponent, DateRangePickerComponent],
  templateUrl: './statistics-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsDashboardComponent {
  summary = input<SummaryApiResult | null>(null);
  dailySummary = input<DailySummaryApiItem[]>([]);
  monthlySummary = input<MonthlySummaryApiItem[]>([]);
  loading = input(false);

  rangeChange = output<DateRange>();
  retryRequest = output<void>();

  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };

  /** Exposed to the template for chart configuration. */
  readonly chartColor  = CHART_COLOR;
  readonly chartTitles = CHART_TITLES;

  readonly status      = signal<DashboardStatus>(DASHBOARD_STATUS.LOADING);
  readonly kpis        = signal<KpiCardViewModel[]>([]);
  readonly dailyBars   = signal<ChartBar[]>([]);
  readonly monthlyBars = signal<ChartBar[]>([]);

  /** Derived state booleans — keep template free of string comparisons. */
  readonly isLoading = computed(() => this.loading() || this.status() === DASHBOARD_STATUS.LOADING);
  readonly isSuccess = computed(() => this.status() === DASHBOARD_STATUS.SUCCESS);
  readonly isError   = computed(() => this.status() === DASHBOARD_STATUS.ERROR);
  readonly isEmpty   = computed(() => this.status() === DASHBOARD_STATUS.EMPTY);

  constructor() {
    effect(() => {
      const summaryData = this.summary();
      const dailyData = this.dailySummary();
      const monthlyData = this.monthlySummary();

      if (summaryData) {
        this.kpis.set(mapSummaryToKpis(summaryData));
        this.dailyBars.set(mapDailyToChart(dailyData));
        this.monthlyBars.set(mapMonthlyToChart(monthlyData));
        this.status.set(
          this.isDashboardEmpty(summaryData)
            ? DASHBOARD_STATUS.EMPTY
            : DASHBOARD_STATUS.SUCCESS,
        );
      } else if (!this.loading()) {
        this.status.set(DASHBOARD_STATUS.EMPTY);
      }
    });
  }

  private isDashboardEmpty(result: SummaryApiResult): boolean {
    return result.totalCups === 0;
  }

  onDateRangeChange(range: DateRange): void {
    this.rangeChange.emit(range);
  }

  onExportReport(): void {
    // TODO: conectar con endpoint de descarga de reporte
  }

  onRetry(): void {
    this.retryRequest.emit();
  }
}
