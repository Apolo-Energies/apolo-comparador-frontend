import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { DashboardStatsService } from '../../../../services/dashboard-stats.service';
import { OpportunityService } from '../../../../services/opportunity.service';
import { SummaryApiResult, DailySummaryApiItem, HistoryItem } from '../statistics/models/dashboard-api.models';
import { OpportunitySummary, OpportunityStatus } from '../../../../entities/opportunity.model';
import { ReportsAnalyticsTabComponent, ColabPeriod } from './components/analytics-tab/analytics-tab.component';
import { ReportsOpportunitiesTabComponent } from './components/opportunities-tab/opportunities-tab.component';
import { ReportsAlertsTabComponent } from './components/alerts-tab/alerts-tab.component';

type ReportTab = 'analitica' | 'oportunidades' | 'alertas';

const STAGNANT_DAYS = 3;
const CRITICAL_DAYS = 7;

@Component({
  selector: 'app-reports-page',
  standalone: true,
  imports: [BrandLoaderComponent, ReportsAnalyticsTabComponent, ReportsOpportunitiesTabComponent, ReportsAlertsTabComponent],
  templateUrl: './reports-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent {
  private readonly stats  = inject(DashboardStatsService);
  private readonly oppSvc = inject(OpportunityService);
  private readonly cdr    = inject(ChangeDetectorRef);

  readonly activeTab = signal<ReportTab>('analitica');
  readonly loading   = signal(false);

  readonly tabs: { id: ReportTab; label: string }[] = [
    { id: 'analitica',     label: 'Analítica'     },
    { id: 'oportunidades', label: 'Oportunidades' },
    { id: 'alertas',       label: 'Alertas'       },
  ];

  readonly summary      = signal<SummaryApiResult | null>(null);
  readonly daily        = signal<DailySummaryApiItem[]>([]);
  readonly opps         = signal<OpportunitySummary[]>([]);
  readonly historyItems = signal<HistoryItem[]>([]);

  readonly colabPeriod  = signal<ColabPeriod>('all');
  readonly colabRows    = signal<HistoryItem[]>([]);
  readonly colabLoading = signal(false);

  readonly totalComparativas = computed(() => this.summary()?.totalCups ?? 0);

  readonly stagnant = computed(() => {
    const now = Date.now();
    return this.opps()
      .filter(o => o.status === OpportunityStatus.Pending || o.status === OpportunityStatus.Negotiation)
      .map(o => ({ ...o, days: Math.floor((now - new Date(o.updatedAt).getTime()) / 86400000) }))
      .filter(o => o.days >= STAGNANT_DAYS)
      .sort((a, b) => b.days - a.days);
  });

  readonly alertBadge     = computed(() => this.stagnant().length);
  readonly criticalCount  = computed(() => this.stagnant().filter(o => o.days >= CRITICAL_DAYS).length);
  readonly warningCount   = computed(() => this.stagnant().filter(o => o.days < CRITICAL_DAYS).length);
  readonly activeOppCount = computed(() =>
    this.opps().filter(o => o.status === OpportunityStatus.Pending || o.status === OpportunityStatus.Negotiation).length
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      analytics: this.stats.getConsolidatedData().pipe(catchError(() => of(null))),
      opps:      this.oppSvc.list({ pageSize: 500 }).pipe(catchError(() => of(null))),
    }).subscribe(({ analytics, opps }) => {
      if (analytics) {
        this.summary.set(analytics.summary);
        this.daily.set(analytics.dailySummary ?? []);
        this.historyItems.set(analytics.history?.items ?? []);
        // Sync colabRows if showing "all time" (no extra fetch needed)
        if (this.colabPeriod() === 'all') {
          this.colabRows.set(analytics.history?.items ?? []);
        }
      }
      if (opps) this.opps.set(opps.items);
      this.loading.set(false);
      this.cdr.markForCheck();
    });
  }

  setTab(tab: ReportTab): void { this.activeTab.set(tab); }

  onColabPeriodChange(period: ColabPeriod): void {
    if (this.colabPeriod() === period) return;
    this.colabPeriod.set(period);

    if (period === 'all') {
      this.colabRows.set(this.historyItems());
      return;
    }

    const today = new Date();
    let from: Date;
    let to: Date;

    if (period === 'week') {
      // Previous calendar week: Monday–Sunday
      const dow          = today.getDay(); // 0=Sun, 1=Mon … 6=Sat
      const daysSinceMon = dow === 0 ? 6 : dow - 1;
      const thisMonday   = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMon);
      from = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 7);
      to   = new Date(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate() - 1);
    } else {
      // Last 30 days
      from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
      to   = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }

    this.colabLoading.set(true);
    this.stats.getConsolidatedData(
      { from, to },
      undefined, undefined, undefined, undefined, undefined, undefined,
      true,
    ).pipe(catchError(() => of(null)))
     .subscribe(data => {
       this.colabRows.set(data?.history?.items ?? []);
       this.colabLoading.set(false);
       this.cdr.markForCheck();
     });
  }
}
