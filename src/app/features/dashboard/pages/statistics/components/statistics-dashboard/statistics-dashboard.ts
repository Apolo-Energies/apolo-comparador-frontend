import { ChangeDetectionStrategy, Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { forkJoin } from 'rxjs';
import { ButtonComponent } from '@apolo-energies/ui';
import { DownloadIcon, UiIconSource } from '@apolo-energies/icons';

import { DashboardStatsService } from '../../../../../../services/dashboard-stats.service';
import { mapDailyToChart, mapMonthlyToChart, mapSummaryToKpis } from '../../mappers/dashboard.mapper';
import { ChartBar, DASHBOARD_STATUS, DateRange, DashboardStatus, KpiCardViewModel } from '../../models/dashboard-ui.models';
import { SummaryApiResult } from '../../models/dashboard-api.models';
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
  private dashboardService = inject(DashboardStatsService);
  private platformId       = inject(PLATFORM_ID);

  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };

  /** Exposed to the template for chart configuration. */
  readonly chartColor  = CHART_COLOR;
  readonly chartTitles = CHART_TITLES;

  readonly status      = signal<DashboardStatus>(DASHBOARD_STATUS.LOADING);
  readonly kpis        = signal<KpiCardViewModel[]>([]);
  readonly dailyBars   = signal<ChartBar[]>([]);
  readonly monthlyBars = signal<ChartBar[]>([]);
  readonly dateRange   = signal<DateRange>({ from: null, to: null });

  /** Derived state booleans — keep template free of string comparisons. */
  readonly isLoading = computed(() => this.status() === DASHBOARD_STATUS.LOADING);
  readonly isSuccess = computed(() => this.status() === DASHBOARD_STATUS.SUCCESS);
  readonly isError   = computed(() => this.status() === DASHBOARD_STATUS.ERROR);
  readonly isEmpty   = computed(() => this.status() === DASHBOARD_STATUS.EMPTY);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  private load(): void {
    this.status.set(DASHBOARD_STATUS.LOADING);
    const range = this.dateRange();

    forkJoin({
      summary: this.dashboardService.getSummary(range),
      daily:   this.dashboardService.getDailySummary(range),
      monthly: this.dashboardService.getMonthlySummary(range),
    }).subscribe({
      next: ({ summary, daily, monthly }) => {
        this.kpis.set(mapSummaryToKpis(summary));
        this.dailyBars.set(mapDailyToChart(daily));
        this.monthlyBars.set(mapMonthlyToChart(monthly));
        this.status.set(
          this.isDashboardEmpty(summary)
            ? DASHBOARD_STATUS.EMPTY
            : DASHBOARD_STATUS.SUCCESS,
        );
      },
      error: () => this.status.set(DASHBOARD_STATUS.ERROR),
    });
  }

  private isDashboardEmpty(result: SummaryApiResult): boolean {
    return result.totalCups === 0;
  }

  onDateRangeChange(range: DateRange): void {
    this.dateRange.set(range);
    this.load();
  }

  onExportReport(): void {
    // TODO: conectar con endpoint de descarga de reporte
  }

  onRetry(): void {
    this.load();
  }
}
