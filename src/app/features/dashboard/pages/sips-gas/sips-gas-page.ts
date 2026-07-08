import { DecimalPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { DownloadIcon, SearchIcon, UiIconSource } from '@apolo-energies/icons';
import { SipsGasInfoCardComponent } from './components/sips-gas-info-card.component';
import { GasSipsService } from '../../../../services/gas-sips.service';
import { GasSipsPs, GasSipsConsumption } from '../../../../entities/gas-sips.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { SipsDonutChartComponent, DonutDatum } from '../sips/components/donut-chart/donut-chart.component';
import { SipsMonthlyChartComponent } from '../sips/components/montly-chart/monthly-chart.component';
import { getGasMonthlyStackedChartData } from '../../../../shared/utils/chart.utils';
import { Period } from '../../../../shared/constants/period';

@Component({
  selector: 'app-sips-gas-page',
  standalone: true,
  imports: [ButtonComponent, SipsGasInfoCardComponent, SipsDonutChartComponent, SipsMonthlyChartComponent, DecimalPipe, DatePipe],
  templateUrl: './sips-gas-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SipsGasPageComponent {
  private readonly service = inject(GasSipsService);
  private readonly router = inject(Router);
  private readonly globalLoading = inject(GlobalLoadingService);

  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };
  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };

  readonly cups = signal('');
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);
  readonly notFound = signal(false);

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
      if (!SipsGasPageComponent.CUPS_PATTERN.test(t)) { invalid++; continue; }
      if (seen.has(t)) continue;
      seen.add(t);
      valid.push(t);
    }
    return { valid, invalid };
  });

  readonly validCount = computed(() => this.parsedCups().valid.length);
  readonly invalidCount = computed(() => this.parsedCups().invalid);
  readonly isSingle = computed(() => this.validCount() === 1);

  private readonly rawPs = signal<GasSipsPs | null>(null);
  readonly rawConsumptions = signal<GasSipsConsumption[]>([]);
  private readonly rawAnnualKwh = signal<number>(0);

  readonly mappedPs = computed(() => this.rawPs());
  readonly hasData = computed(() => !!this.rawPs());

  /** Gas solo tiene 2 periodos (P1 diurno, P2 nocturno). Restringe legend e iteracion del monthly chart. */
  readonly gasPeriods: readonly Period[] = ['P1', 'P2'];

  readonly donutTotal = computed(() => `${this.rawAnnualKwh().toLocaleString('es-ES')} kWh`);

  /** P2=0 para residencial — filtramos para que la leyenda no muestre slice fantasma. */
  readonly donutData = computed<DonutDatum[]>(() => {
    const cons = this.rawConsumptions();
    const p1 = cons.reduce((s, c) => s + (c.consumoP1Kwh ?? 0), 0);
    const p2 = cons.reduce((s, c) => s + (c.consumoP2Kwh ?? 0), 0);
    return [
      { label: 'P1', value: Math.round(p1) },
      { label: 'P2', value: Math.round(p2) },
    ].filter(d => d.value > 0);
  });

  readonly monthlyRows = computed(() => getGasMonthlyStackedChartData(this.rawConsumptions()));

  /** Compara los ultimos N/2 periodos contra los N/2 anteriores. Sin trend si hay <4 periodos. */
  readonly trend = computed<{ percent: number; trend: 'up' | 'down' | 'equal' } | null>(() => {
    const sorted = [...this.rawConsumptions()].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
    if (sorted.length < 4) return null;
    const half = Math.floor(sorted.length / 2);
    const prev = sorted.slice(0, half).reduce((s, c) => s + c.totalKwh, 0);
    const curr = sorted.slice(half).reduce((s, c) => s + c.totalKwh, 0);
    if (prev === 0) return null;
    const pct = Math.abs(Math.round(((curr - prev) / prev) * 100));
    return { percent: pct, trend: curr > prev ? 'up' : curr < prev ? 'down' : 'equal' };
  });

  readonly hasConsumptions = computed(() => this.rawConsumptions().length > 0);

  onCupsInput(el: HTMLTextAreaElement): void {
    this.cups.set(el.value);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  onConsultar(): void {
    const valid = this.parsedCups().valid;
    if (valid.length !== 1) return;
    const cups = valid[0];

    this.loading.set(true);
    this.globalLoading.start();
    this.error.set(null);
    this.notFound.set(false);

    this.service.getByCups(cups).subscribe({
      next: (res) => {
        if (res.ps == null) {
          this.notFound.set(true);
          this.rawPs.set(null);
          this.rawConsumptions.set([]);
          this.rawAnnualKwh.set(0);
        } else {
          this.rawPs.set(res.ps);
          this.rawConsumptions.set(res.consumptions ?? []);
          this.rawAnnualKwh.set(res.annualKwh ?? 0);
        }
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.error.set('No se pudo consultar el CUPS. Reintentá en unos segundos.');
        this.rawPs.set(null);
        this.rawConsumptions.set([]);
        this.rawAnnualKwh.set(0);
        this.loading.set(false);
        this.globalLoading.stop();
      },
    });
  }

  onExportClick(): void {
    this.error.set('Exportación a Excel para gas estará disponible próximamente.');
  }

  onExport(): void { this.onExportClick(); }

  onComparativa(): void {
    const ps = this.rawPs();
    if (!ps?.cups) return;
    this.router.navigate(['/dashboard/comparator-gas'], { queryParams: { cups: ps.cups } });
  }

  onClear(): void {
    this.cups.set('');
    this.rawPs.set(null);
    this.rawConsumptions.set([]);
    this.rawAnnualKwh.set(0);
    this.error.set(null);
    this.notFound.set(false);
  }
}
