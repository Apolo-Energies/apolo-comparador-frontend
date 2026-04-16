import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { SipsInfoCardComponent } from './components/sips-info-card.component';
import { DownloadIcon, SearchIcon, UiIconSource } from '@apolo-energies/icons';
import { SipsService } from '../../../../services/sips.service';
import { SipsDonutChartComponent, DonutDatum, TrendData } from './components/donut-chart/donut-chart.component';
import { SipsPowerChartComponent, PowerBarDatum } from './components/power-chart/power-chart.component';
import { SipsMonthlyChartComponent } from './components/montly-chart/monthly-chart.component';
import { SipsConsumo, SipsPs } from '../../../../entities/sips.model';
import { getMonthlyStackedChartData, MonthlyRowDatum } from '../../../../shared/utils/chart.utils';

const PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;

function wToKwh(wh: number): number {
  return wh / 1000;
}

function buildPeriodSummary(consumos: SipsConsumo[]): { periods: DonutDatum[]; totalFormatted: number } {
  const last12 = [...consumos]
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
    .slice(-12);

  const periods: DonutDatum[] = PERIODS.map(p => ({
    label: p,
    value: Math.round(last12.reduce((s, c) => s + wToKwh((c[`energia${p}`] as number) || 0), 0)),
  })).filter(d => d.value > 0);

  return {
    periods,
    totalFormatted: periods.reduce((s, d) => s + d.value, 0),
  };
}

function buildTrend(consumos: SipsConsumo[]): TrendData | null {
  const sorted = [...consumos].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  const last12 = sorted.slice(-12);
  if (last12.length < 12) return null;

  const total = (slice: SipsConsumo[]) =>
    slice.reduce(
      (s, c) => s + PERIODS.reduce((ps, p) => ps + wToKwh((c[`energia${p}`] as number) || 0), 0),
      0
    );

  const prev = total(last12.slice(0, 6));
  const curr = total(last12.slice(6));
  if (prev === 0) return null;

  const percent = Math.abs(Math.round(((curr - prev) / prev) * 100));
  return {
    percent,
    trend: curr > prev ? 'up' : curr < prev ? 'down' : 'equal',
  };
}

function buildPowerData(ps: SipsPs): PowerBarDatum[] {
  return PERIODS.map(p => ({
    label: p,
    value: (ps[`potenciaContratada${p}`] as number) || 0,
  })).filter(d => d.value > 0);
}

@Component({
  selector: 'app-sips-page',
  standalone: true,
  imports: [
    ButtonComponent,
    InputFieldComponent,
    SipsInfoCardComponent,
    SipsDonutChartComponent,
    SipsPowerChartComponent,
    SipsMonthlyChartComponent,
  ],
  templateUrl: './sips-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SipsPageComponent {
  private readonly sipsService = inject(SipsService);
  private readonly router = inject(Router);

  //readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };

  readonly cups = signal('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly rawPs = signal<SipsPs | null>(null);
  private readonly rawConsumos = signal<SipsConsumo[]>([]);

  readonly mappedPs = computed(() => this.rawPs());

  private readonly periodSummary = computed(() => buildPeriodSummary(this.rawConsumos()));

  readonly donutData = computed(() => this.periodSummary().periods);
  readonly donutTotal = computed(() => `${this.periodSummary().totalFormatted.toLocaleString('es-ES')} kWh`);
  readonly trend = computed(() => buildTrend(this.rawConsumos()));

  // aquí ya usas la función nueva con últimos 12 meses
  readonly monthlyRows = computed<MonthlyRowDatum[]>(() =>
    getMonthlyStackedChartData(this.rawConsumos())
  );

  readonly powerData = computed(() => {
    const ps = this.rawPs();
    return ps ? buildPowerData(ps) : [];
  });

  readonly showCharts = computed(() => !!this.rawPs() && this.donutData().length > 0);
  readonly hasData = computed(() => !!this.rawPs());

  onConsultar(): void {
    const cups = this.cups().trim();
    if (!cups) return;

    this.loading.set(true);
    this.error.set(null);

    this.sipsService.getByCups(cups).subscribe({
      next: ({ ps, consumos }) => {
        this.rawPs.set(ps);
        this.rawConsumos.set(consumos);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se encontraron datos para el CUPS indicado');
        this.rawPs.set(null);
        this.rawConsumos.set([]);
        this.loading.set(false);
      },
    });
  }

  onExportar(): void {
    const cups = this.cups().trim();
    if (!cups) return;

    this.sipsService.downloadExcel(cups).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sips-${cups}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  onComparativa(): void {
    const ps = this.rawPs();
    if (!ps) return;
    this.router.navigate(['/dashboard/comparator'], {
      queryParams: { cups: ps.cups },
    });
  }

  onClear(): void {
    this.cups.set('');
    this.rawPs.set(null);
    this.rawConsumos.set([]);
    this.error.set(null);
  }
}
