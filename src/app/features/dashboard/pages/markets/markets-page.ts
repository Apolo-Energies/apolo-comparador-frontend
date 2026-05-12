import { ChangeDetectionStrategy, Component, NgZone, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MarketDataService } from '../../../../services/market-data.service';
import { MarketKpis, MarketSeries } from '../../../../entities/market-data.model';
import { MarketKpiCardComponent } from './components/market-kpi-card/market-kpi-card';
import { MarketLineChartComponent } from './components/market-line-chart/market-line-chart';

@Component({
  selector: 'app-markets-page',
  standalone: true,
  imports: [MarketKpiCardComponent, MarketLineChartComponent],
  templateUrl: './markets-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketsPageComponent implements OnInit {
  private readonly marketData = inject(MarketDataService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  readonly kpis = signal<MarketKpis | null>(null);
  readonly electricitySeries = signal<MarketSeries | null>(null);
  readonly gasSeries = signal<MarketSeries | null>(null);

  readonly kpisLoading = signal(true);
  readonly electricityLoading = signal(true);
  readonly gasLoading = signal(true);
  readonly error = signal<string | null>(null);

  readonly gasSpot = computed(() => this.kpis()?.gas ?? null);
  readonly electricitySpot = computed(() => this.kpis()?.electricity ?? null);
  readonly co2Spot = computed(() => this.kpis()?.co2 ?? null);
  readonly brentSpot = computed(() => this.kpis()?.brent ?? null);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.error.set(null);
    this.zone.runOutsideAngular(() => {
      queueMicrotask(() => this.loadAll());
    });
  }

  private loadAll(): void {
    this.marketData.getKpis().subscribe({
      next: (kpis) => {
        this.kpis.set(kpis);
        this.kpisLoading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los precios de mercado');
        this.kpisLoading.set(false);
      },
    });

    this.marketData.getElectricityFutures(90).subscribe({
      next: (series) => {
        this.electricitySeries.set(series);
        this.electricityLoading.set(false);
      },
      error: () => this.electricityLoading.set(false),
    });

    this.marketData.getGasFutures(90).subscribe({
      next: (series) => {
        this.gasSeries.set(series);
        this.gasLoading.set(false);
      },
      error: () => this.gasLoading.set(false),
    });
  }
}
