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
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { Chart } from 'chart.js';
import { ThemeService } from '../../../../../../core/services/theme.service';
import { chartTheme } from '../../../../../../shared/utils/chart-theme';
import { OpportunitySummary, OpportunityStatus } from '../../../../../../core/models/opportunity.model';
import { fmtDate, statusClass, statusLabel } from '../../report-utils';

// Colores del donut: paleta categórica por tema (shared/utils/chart-theme.ts).

@Component({
  selector: 'app-reports-opportunities-tab',
  standalone: true,
  imports: [],
  templateUrl: './opportunities-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsOpportunitiesTabComponent implements AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  readonly loading = input<boolean>(false);
  readonly opps    = input<OpportunitySummary[]>([]);

  readonly statusFilter = signal('');

  readonly oppCounts = computed(() => {
    const all = this.opps();
    return {
      pending:     all.filter(o => o.status === OpportunityStatus.Pending).length,
      negotiation: all.filter(o => o.status === OpportunityStatus.Negotiation).length,
      won:         all.filter(o => o.status === OpportunityStatus.Won).length,
      lost:        all.filter(o => o.status === OpportunityStatus.Lost).length,
      total:       all.length,
    };
  });

  readonly filteredOpps = computed(() => {
    const f = this.statusFilter();
    const all = this.opps();
    if (!f) return all;
    const map: Record<string, OpportunityStatus> = {
      pending:     OpportunityStatus.Pending,
      negotiation: OpportunityStatus.Negotiation,
      won:         OpportunityStatus.Won,
      lost:        OpportunityStatus.Lost,
    };
    return all.filter(o => o.status === map[f]);
  });

  private _donutRef?: ElementRef<HTMLCanvasElement>;

  @ViewChild('donutCanvas')
  set donutCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this._donutRef = ref;
    if (this.chartLib && ref) this.renderDonut();
  }

  private donutChart?: Chart;
  private readonly theme = inject(ThemeService);
  private lastDark: boolean | null = null;
  private chartLib?:   typeof import('chart.js');

  readonly fmtDate     = fmtDate;
  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;

  constructor() {
    effect(() => {
      this.opps();
      const dark = this.theme.portalDark();
      if (dark !== this.lastDark) { this.donutChart?.destroy(); this.donutChart = undefined; this.lastDark = dark; }
      if (this.chartLib && this._donutRef) this.renderDonut();
    });
  }

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    this.chartLib = await import('chart.js/auto');
    this.renderDonut();
  }

  ngOnDestroy(): void {
    this.donutChart?.destroy();
  }

  private renderDonut(): void {
    if (!this.chartLib || !this._donutRef) return;
    const counts: Record<string, number> = {};
    this.opps().forEach(o => { const t = o.tariff ?? 'Sin tarifa'; counts[t] = (counts[t] ?? 0) + 1; });
    const labels = Object.keys(counts);
    const values = Object.values(counts);

    const t = chartTheme(this.theme.portalDark());
    if (this.donutChart) {
      this.donutChart.data.labels = labels;
      this.donutChart.data.datasets[0].data = values;
      this.donutChart.update('none');
      return;
    }

    this.donutChart = new this.chartLib.Chart(this._donutRef.nativeElement, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: t.series, borderWidth: 2, borderColor: t.surface }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: t.axis, font: { size: 11 }, padding: 12 } } },
      },
    });
  }
}
