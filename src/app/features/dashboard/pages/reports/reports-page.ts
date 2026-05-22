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
import { ReportsAnalyticsTabComponent } from './components/analytics-tab/analytics-tab.component';
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
      }
      if (opps) this.opps.set(opps.items);
      this.loading.set(false);
      this.cdr.markForCheck();
    });
  }

  setTab(tab: ReportTab): void { this.activeTab.set(tab); }
}
