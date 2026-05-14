import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { SipsInfoCardComponent } from './components/sips-info-card.component';
import { DownloadIcon, UiIconSource } from '@apolo-energies/icons';
import { SipsService } from '../../../../services/sips.service';
import { SipsDonutChartComponent, DonutDatum, TrendData } from './components/donut-chart/donut-chart.component';
import { SipsPowerChartComponent, PowerBarDatum } from './components/power-chart/power-chart.component';
import { SipsMonthlyChartComponent } from './components/montly-chart/monthly-chart.component';
import { SipsConsumo, SipsPs } from '../../../../entities/sips.model';
import { getMonthlyStackedChartData, MonthlyRowDatum } from '../../../../shared/utils/chart.utils';
import { PERIODS } from '../../../../shared/constants/period';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';

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
    SipsInfoCardComponent,
    SipsDonutChartComponent,
    SipsPowerChartComponent,
    SipsMonthlyChartComponent,
    BrandLoaderComponent,
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
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);

  // Format español: ES + 16 dígitos + 2 alfanuméricos (con sufijo opcional de control).
  // Lo dejamos amplio para no rechazar CUPS válidos atípicos; el backend valida realmente.
  private static readonly CUPS_PATTERN = /^ES[0-9]{16}[A-Z0-9]{2}[A-Z0-9]{0,2}$/i;

  readonly parsedCups = computed(() => {
    const raw = this.cups();
    if (!raw.trim()) return { valid: [] as string[], invalid: 0 };
    const tokens = raw
      .split(/[\n,;]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);
    const seen = new Set<string>();
    const valid: string[] = [];
    let invalid = 0;
    for (const t of tokens) {
      if (!SipsPageComponent.CUPS_PATTERN.test(t)) { invalid++; continue; }
      if (seen.has(t)) continue;
      seen.add(t);
      valid.push(t);
    }
    return { valid, invalid };
  });

  readonly validCount = computed(() => this.parsedCups().valid.length);
  readonly invalidCount = computed(() => this.parsedCups().invalid);
  readonly isSingle = computed(() => this.validCount() === 1);
  readonly isMulti = computed(() => this.validCount() > 1);

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

  onCupsInput(el: HTMLTextAreaElement): void {
    this.cups.set(el.value);
    // Auto-grow: shrink first to let scrollHeight recalc, then size to content.
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  onConsultar(): void {
    const valid = this.parsedCups().valid;
    if (valid.length !== 1) return;
    const cups = valid[0];

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

  onExportClick(): void {
    const valid = this.parsedCups().valid;
    if (valid.length === 0) return;
    if (valid.length === 1) {
      this.exportSingle(valid[0]);
    } else {
      this.exportMulti(valid);
    }
  }

  onExport(): void {
    // Invocado desde la info-card de un CUPS ya consultado.
    const ps = this.rawPs();
    if (ps?.cups) this.exportSingle(ps.cups);
  }

  private exportSingle(cups: string): void {
    this.exporting.set(true);
    this.error.set(null);
    this.sipsService.downloadExcel(cups).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, `sips-${cups}.xlsx`);
        this.exporting.set(false);
      },
      error: () => {
        this.error.set('No se pudo generar el Excel');
        this.exporting.set(false);
      },
    });
  }

  private exportMulti(cups: string[]): void {
    this.exporting.set(true);
    this.error.set(null);
    this.sipsService.downloadMultiExcel(cups).subscribe({
      next: (blob) => {
        const stamp = new Date().toISOString().slice(0, 10);
        this.triggerDownload(blob, `multicups-${stamp}.xlsx`);
        this.exporting.set(false);
      },
      error: () => {
        this.error.set('No se pudo generar el Excel multi-CUPS');
        this.exporting.set(false);
      },
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
