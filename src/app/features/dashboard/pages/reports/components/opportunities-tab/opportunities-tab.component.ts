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
import { OpportunitySummary, OpportunityStatus } from '../../../../../../entities/opportunity.model';
import { fmtDate, statusClass, statusLabel } from '../../report-utils';

const DONUT_COLORS = ['#7C67F2','#8FDBFF','#FFB86B','#F691A6','#C4C4C4','#999DF8'];

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
  private chartLib?:   typeof import('chart.js');

  readonly fmtDate     = fmtDate;
  readonly statusClass = statusClass;
  readonly statusLabel = statusLabel;

  constructor() {
    effect(() => {
      this.opps();
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

    if (this.donutChart) {
      this.donutChart.data.labels = labels;
      this.donutChart.data.datasets[0].data = values;
      this.donutChart.update('none');
      return;
    }

    this.donutChart = new this.chartLib.Chart(this._donutRef.nativeElement, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: DONUT_COLORS, borderWidth: 2, borderColor: 'rgba(23,24,26,1)' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: 'rgba(161,161,170,0.8)', font: { size: 11 }, padding: 12 } } },
      },
    });
  }
}
