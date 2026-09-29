import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { SipsInfoCardComponent } from './components/sips-info-card.component';
import { DownloadIcon, SearchIcon, UiIconSource } from '@apolo-energies/icons';
import { SipsService } from '../../../../core/services/sips.service';
import { environment } from '../../../../../environments/environment';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { SipsDonutChartComponent } from './components/donut-chart/donut-chart.component';
import { SipsPowerChartComponent } from './components/power-chart/power-chart.component';
import { SipsMonthlyChartComponent } from './components/monthly-chart/monthly-chart.component';
import { SipsConsumo, SipsPs } from '../../../../core/models/sips.model';
import { getMonthlyStackedChartData, MonthlyRowDatum } from '../../../../shared/utils/chart.utils';
import { buildPeriodSummary, buildPowerData, buildTrend, parseCupsInput } from './sips-page.helpers';

@Component({
  selector: 'app-sips-page',
  standalone: true,
  imports: [
    ButtonComponent,
    SipsInfoCardComponent,
    SipsDonutChartComponent,
    SipsPowerChartComponent,
    SipsMonthlyChartComponent,
  ],
  templateUrl: './sips-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SipsPageComponent {
  private readonly sipsService  = inject(SipsService);
  private readonly router       = inject(Router);
  private readonly globalLoading = inject(GlobalLoadingService);

  readonly isApolo = environment.features.userDetail;

  //readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };
  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };

  readonly cups = signal('');
  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly error = signal<string | null>(null);

  readonly parsedCups = computed(() => parseCupsInput(this.cups()));

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
    this.globalLoading.start();
    this.error.set(null);

    this.sipsService.getByCups(cups).subscribe({
      next: ({ ps, consumos }) => {
        this.rawPs.set(ps);
        this.rawConsumos.set(consumos);
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.error.set('No se encontraron datos para el CUPS indicado');
        this.rawPs.set(null);
        this.rawConsumos.set([]);
        this.loading.set(false);
        this.globalLoading.stop();
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
    this.globalLoading.start();
    this.error.set(null);
    this.sipsService.downloadExcel(cups).subscribe({
      next: (blob) => {
        this.triggerDownload(blob, `sips-${cups}.xlsx`);
        this.exporting.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.error.set('No se pudo generar el Excel');
        this.exporting.set(false);
        this.globalLoading.stop();
      },
    });
  }

  private exportMulti(cups: string[]): void {
    this.exporting.set(true);
    this.globalLoading.start();
    this.error.set(null);
    this.sipsService.downloadMultiExcel(cups).subscribe({
      next: (blob) => {
        const stamp = new Date().toISOString().slice(0, 10);
        this.triggerDownload(blob, `multicups-${stamp}.xlsx`);
        this.exporting.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.error.set('No se pudo generar el Excel multi-CUPS');
        this.exporting.set(false);
        this.globalLoading.stop();
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
