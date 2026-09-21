import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ButtonComponent, DialogComponent, InputFieldComponent, SelectFieldComponent, SliderComponent } from '@apolo-energies/ui';
import { ApoloIcons, FileDownIcon, FileSpreadsheetIcon, LightningIcon, UiIconSource } from '@apolo-energies/icons';
import { ComparadorFormValue, ComparadorResult, FeeMode, OcrResult } from '../../../../../../core/models/comparator.model';
import { ComparadorDownloadEvent } from '../../comparator-events.model';
import { ComparatorProductsByTariff } from '../../comparator-ui.model';
import { PERIOD_NUMBERS } from '../../../../../../shared/constants/period';
import { ComparatorFormController } from './comparator-form.controller';
import {
  formatEurValue,
  formatPctValue,
  formatPriceValue,
  getPrecioEnergiaValue,
  getPrecioPotenciaValue,
  truncateValue,
} from './comparator-modal.helpers';

@Component({
  selector: 'app-comparator-modal',
  standalone: true,
  imports: [DialogComponent, SelectFieldComponent, InputFieldComponent, SliderComponent, ButtonComponent, ApoloIcons],
  templateUrl: './comparator-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparatorModalComponent {
  // ── inputs ─────────────────────────────────────────────────────────────────
  readonly open               = input(false);
  readonly ocrResult          = input<OcrResult | null>(null);
  readonly productsByTariff   = input<ComparatorProductsByTariff>({});
  readonly feeLockedProducts  = input<string[]>([]);
  readonly isReferrer         = input(false);
  readonly comisionBase       = input(0);
  readonly referrerDefaultFee = input(0.3);
  readonly maxFeeEnergia      = input(30);
  readonly maxFeePotencia     = input(5);
  readonly result             = input<ComparadorResult | null>(null);

  // ── visibility flags (default = current private behavior) ──────────────────
  readonly showPrecioMedio      = input(true);
  readonly showFeeEnergia       = input(true);
  readonly showFeePotencia      = input(true);
  readonly showComisionCard     = input(true);
  readonly showExcelButton      = input(true);
  readonly showContratarButton  = input(false);
  readonly showProductoSelector = input(true);

  // ── button labels / variants ───────────────────────────────────────────────
  readonly contratarButtonLabel   = input<string>('Contratar Apolo');
  readonly pdfButtonLabel         = input<string>('Descargar PDF');
  readonly contratarButtonVariant = input<'default' | 'secondary'>('secondary');
  readonly pdfButtonVariant       = input<'default' | 'secondary'>('default');

  // ── outputs ────────────────────────────────────────────────────────────────
  readonly openChange = output<boolean>();
  readonly formChange = output<ComparadorFormValue>();
  readonly download   = output<ComparadorDownloadEvent>();
  readonly contratar  = output<ComparadorFormValue>();

  // ── icons ──────────────────────────────────────────────────────────────────
  readonly excelIcon:     UiIconSource = { type: 'apolo', icon: FileSpreadsheetIcon, size: 16 };
  readonly pdfIcon:       UiIconSource = { type: 'apolo', icon: FileDownIcon,        size: 16 };
  readonly lightningIcon: UiIconSource = { type: 'apolo', icon: LightningIcon,       size: 36 };

  // ── UI state ───────────────────────────────────────────────────────────────
  readonly periodosOpen = signal(false);

  // ── form (tariff / producto / fees / comisión) ──────────────────────────────
  private readonly form = new ComparatorFormController({
    productsByTariff:  () => this.productsByTariff(),
    feeLockedProducts: () => this.feeLockedProducts(),
    isReferrer:        () => this.isReferrer(),
    comisionBase:      () => this.comisionBase(),
    onChange:          () => this.emitFormChange(),
  });

  readonly tariff              = this.form.tariff;
  readonly producto            = this.form.producto;
  readonly precioMedio         = this.form.precioMedio;
  readonly feeEnergia          = this.form.feeEnergia;
  readonly feePotencia         = this.form.feePotencia;
  readonly comisionEnergia     = this.form.comisionEnergia;
  readonly feeMode             = this.form.feeMode;
  readonly feeEnergiaByPeriod  = this.form.feeEnergiaByPeriod;
  readonly feePotenciaByPeriod = this.form.feePotenciaByPeriod;

  readonly energiaPeriods     = this.form.energiaPeriods;
  readonly potenciaPeriods    = this.form.potenciaPeriods;
  readonly energiaGridClass   = this.form.energiaGridClass;
  readonly potenciaGridClass  = this.form.potenciaGridClass;

  readonly hasEnergiaOverrides   = this.form.hasEnergiaOverrides;
  readonly hasPotenciaOverrides  = this.form.hasPotenciaOverrides;
  readonly hasPerPeriodOverrides = this.form.hasPerPeriodOverrides;

  readonly tarifaOptions   = this.form.tarifaOptions;
  readonly productoOptions = this.form.productoOptions;
  readonly isFeeBlocked    = this.form.isFeeBlocked;

  readonly effectiveComision = this.form.effectiveComision;

  // Expongo el enum a la template para poder hacer feeMode() === FeeMode.Global.
  protected readonly FeeMode = FeeMode;

  constructor() {
    effect(() => {
      const ocr = this.ocrResult();
      if (!ocr) return;
      untracked(() => {
        const tarifas  = Object.keys(this.productsByTariff());
        const ocrTarifa = ocr.contrato?.tarifa ?? '';
        const tariff   = tarifas.includes(ocrTarifa) ? ocrTarifa : (tarifas[0] ?? '');
        const producto = this.productsByTariff()[tariff]?.[0] ?? '';
        this.form.reset(tariff, producto, this.referrerDefaultFee());
        this.emitFormChange();
      });
    });

    effect(() => {
      const base = this.comisionBase();
      untracked(() => this.form.syncComisionBase(base));
    }, { allowSignalWrites: true });
  }

  // ── form handlers (delegados a ComparatorFormController) ────────────────────

  onTariffChange(value: string) { this.form.onTariffChange(value); }
  onProductoChange(value: string) { this.form.onProductoChange(value); }
  onPrecioMedioChange(value: string) { this.form.onPrecioMedioChange(value); }
  onFeeEnergiaChange(value: number) { this.form.onFeeEnergiaChange(value); }
  onFeePotenciaChange(value: number) { this.form.onFeePotenciaChange(value); }
  onFeeModeChange(mode: FeeMode) { this.form.onFeeModeChange(mode); }
  onFeeEnergiaPeriodChange(index: number, raw: string | number) { this.form.onFeeEnergiaPeriodChange(index, raw); }
  onFeePotenciaPeriodChange(index: number, raw: string | number) { this.form.onFeePotenciaPeriodChange(index, raw); }
  resetFeeEnergiaOverrides() { this.form.resetFeeEnergiaOverrides(); }
  resetFeePotenciaOverrides() { this.form.resetFeePotenciaOverrides(); }
  onComisionEnergiaChange(value: string) { this.form.onComisionEnergiaChange(value); }

  // ── actions ────────────────────────────────────────────────────────────────

  close() {
    this.openChange.emit(false);
  }

  onDownload(type: 'pdf' | 'excel') {
    if (!this.result()) return;
    this.download.emit({ type, formValue: this.form.buildFormValue() });
  }

  onContratar() {
    this.contratar.emit(this.form.buildFormValue());
  }

  private emitFormChange() {
    this.formChange.emit(this.form.buildFormValue());
  }

  // ── formatting ─────────────────────────────────────────────────────────────

  readonly PERIODOS = PERIOD_NUMBERS;

  getPrecioEnergia(periodos: { periodo: number | string; precioEnergiaOferta?: number }[], p: number): string {
    return getPrecioEnergiaValue(periodos, p);
  }

  getPrecioPotencia(periodos: { periodo: number | string; precioPotenciaOferta?: number }[], p: number): string {
    return getPrecioPotenciaValue(periodos, p);
  }

  readonly truncate    = truncateValue;
  readonly formatEur   = formatEurValue;
  readonly formatPct   = formatPctValue;
  readonly formatPrice = formatPriceValue;
}
