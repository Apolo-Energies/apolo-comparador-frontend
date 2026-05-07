import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ButtonComponent, DialogComponent, InputFieldComponent, SelectFieldComponent, SelectOption, SliderComponent } from '@apolo-energies/ui';
import { ApoloIcons, FileDownIcon, FileSpreadsheetIcon, LightningIcon, UiIconSource } from '@apolo-energies/icons';
import {
  ComparadorDownloadEvent,
  ComparadorFormValue,
  ComparadorResult,
  ComparatorProductsByTariff,
  OcrResult,
} from '../../comparator.models';
import { PERIOD_NUMBERS } from '../../../../../../shared/constants/period';

@Component({
  selector: 'app-comparador-modal',
  standalone: true,
  imports: [DialogComponent, SelectFieldComponent, InputFieldComponent, SliderComponent, ButtonComponent, ApoloIcons],
  templateUrl: './comparador-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparadorModalComponent {
  // ── inputs ─────────────────────────────────────────────────────────────────
  readonly open               = input(false);
  readonly ocrResult          = input<OcrResult | null>(null);
  readonly productsByTariff   = input<ComparatorProductsByTariff>({});
  readonly feeLockedProducts  = input<string[]>([]);
  readonly isReferrer         = input(false);
  readonly comisionBase       = input(0);
  readonly referrerDefaultFee = input(0.3);
  readonly maxFeeEnergia      = input(50);
  readonly maxFeePotencia     = input(25);
  readonly result             = input<ComparadorResult | null>(null);

  // ── visibility flags (default = current private behavior) ──────────────────
  readonly showPrecioMedio     = input(true);
  readonly showFeeEnergia      = input(true);
  readonly showFeePotencia     = input(true);
  readonly showComisionCard    = input(true);
  readonly showExcelButton     = input(true);
  readonly showContratarButton = input(false);
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
  readonly excelIcon:    UiIconSource = { type: 'apolo', icon: FileSpreadsheetIcon, size: 16 };
  readonly pdfIcon:      UiIconSource = { type: 'apolo', icon: FileDownIcon,        size: 16 };
  readonly lightningIcon: UiIconSource = { type: 'apolo', icon: LightningIcon, size: 36 };

  // ── UI state ───────────────────────────────────────────────────────────────
  readonly periodosOpen = signal(false);

  // ── form signals ───────────────────────────────────────────────────────────
  readonly tariff          = signal('');
  readonly producto        = signal('');
  readonly precioMedio     = signal(0);
  readonly feeEnergia      = signal(0);
  readonly feePotencia     = signal(0);
  readonly comisionEnergia = signal(0);

  // ── derived select options ─────────────────────────────────────────────────
  readonly tarifaOptions = computed<SelectOption[]>(() =>
    Object.keys(this.productsByTariff()).map(t => ({ value: t, label: t }))
  );

  readonly productoOptions = computed<SelectOption[]>(() =>
    (this.productsByTariff()[this.tariff()] ?? []).map(p => ({ value: p, label: p }))
  );

  readonly isFeeBlocked = computed(() =>
    this.feeLockedProducts().includes(this.producto())
  );

  readonly effectiveComision = computed(() =>
    this.isReferrer() ? this.comisionEnergia() : this.comisionBase()
  );

  constructor() {
    // Initialize form when ocrResult first arrives
    effect(() => {
      const ocr = this.ocrResult();
      if (!ocr) return;
      untracked(() => {
        const tarifas    = Object.keys(this.productsByTariff());
        const ocrTarifa  = ocr.contrato?.tarifa ?? '';
        const tariff     = tarifas.includes(ocrTarifa) ? ocrTarifa : (tarifas[0] ?? '');
        const producto   = this.productsByTariff()[tariff]?.[0] ?? '';
        this.tariff.set(tariff);
        this.producto.set(producto);
        this.precioMedio.set(0);
        this.feeEnergia.set(0);
        this.feePotencia.set(0);
        this.comisionEnergia.set(this.referrerDefaultFee());
        this.emitFormChange();
      });
    });

    // Sync comisionEnergia with comisionBase for non-referrers
    effect(() => {
      const base = this.comisionBase();
      untracked(() => {
        if (!this.isReferrer()) this.comisionEnergia.set(base);
      });
    }, { allowSignalWrites: true });
  }

  // ── form handlers ──────────────────────────────────────────────────────────

  onTariffChange(value: string) {
    const producto = this.productsByTariff()[value]?.[0] ?? '';
    this.tariff.set(value);
    this.producto.set(producto);
    this.applyFeeBlocking(producto);
    this.emitFormChange();
  }

  onProductoChange(value: string) {
    this.producto.set(value);
    this.applyFeeBlocking(value);
    this.emitFormChange();
  }

  onPrecioMedioChange(value: string) {
    this.precioMedio.set(Number(value) || 0);
    this.emitFormChange();
  }

  onFeeEnergiaChange(value: number) {
    this.feeEnergia.set(value);
    this.emitFormChange();
  }

  onFeePotenciaChange(value: number) {
    this.feePotencia.set(value);
    this.emitFormChange();
  }

  onComisionEnergiaChange(value: string) {
    this.comisionEnergia.set(Number(value) || 0);
    this.emitFormChange();
  }

  // ── actions ────────────────────────────────────────────────────────────────

  close() {
    this.openChange.emit(false);
  }

  onDownload(type: 'pdf' | 'excel') {
    if (!this.result()) return;
    this.download.emit({ type, formValue: this.buildFormValue() });
  }

  onContratar() {
    this.contratar.emit(this.buildFormValue());
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private applyFeeBlocking(producto: string) {
    if (this.feeLockedProducts().includes(producto)) {
      this.feeEnergia.set(0);
      this.feePotencia.set(0);
    }
  }

  private buildFormValue(): ComparadorFormValue {
    return {
      tariff:          this.tariff(),
      producto:        this.producto(),
      precioMedio:     this.precioMedio(),
      feeEnergia:      this.feeEnergia(),
      feePotencia:     this.feePotencia(),
      comisionEnergia: this.effectiveComision(),
    };
  }

  private emitFormChange() {
    this.formChange.emit(this.buildFormValue());
  }

  // ── formatting ─────────────────────────────────────────────────────────────

  readonly PERIODOS = PERIOD_NUMBERS;

  getPrecioEnergia(periodos: { periodo: number | string; precioEnergiaOferta?: number }[], p: number): string {
    const found = periodos.find(x => Number(x.periodo) === p);
    return found ? found.precioEnergiaOferta?.toFixed(6) ?? '0,000000' : '0,000000';
  }

  getPrecioPotencia(periodos: { periodo: number | string; precioPotenciaOferta?: number }[], p: number): string {
    const found = periodos.find(x => Number(x.periodo) === p);
    return found ? found.precioPotenciaOferta?.toFixed(6) ?? '0,000000' : '0,000000';
  }

  truncate(value: number): number {
    return Math.trunc(value);
  }

  formatEur(value: number): string {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  formatPct(value: number): string {
    return value.toFixed(2) + ' %';
  }

  formatPrice(value: number): string {
    return value.toFixed(6);
  }
}
