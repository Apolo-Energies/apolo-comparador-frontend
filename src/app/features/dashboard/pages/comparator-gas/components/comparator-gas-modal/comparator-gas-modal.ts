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
import {
  ButtonComponent,
  DialogComponent,
  SelectFieldComponent,
  SelectOption,
  SliderComponent,
} from '@apolo-energies/ui';
import { ApoloIcons, FileDownIcon, FileSpreadsheetIcon, LightningIcon, UiIconSource } from '@apolo-energies/icons';
import {
  GasDownloadEvent,
  GasFormValue,
  GasOcrResult,
  GasProductsByTariff,
  GasResult,
} from '../../comparator-gas.models';
import { normalizeGasTariff } from '../../gas-calculator.helpers';

@Component({
  selector: 'app-comparator-gas-modal',
  standalone: true,
  imports: [
    DialogComponent,
    SelectFieldComponent,
    SliderComponent,
    ButtonComponent,
    ApoloIcons,
  ],
  templateUrl: './comparator-gas-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparatorGasModalComponent {
  // ── inputs ─────────────────────────────────────────────────────────────────
  readonly open              = input(false);
  readonly ocrResult         = input<GasOcrResult | null>(null);
  readonly productsByTariff  = input<GasProductsByTariff>({});
  readonly feeLockedProducts = input<string[]>([]);
  readonly comisionBase      = input(0);
  readonly maxFeeEnergia     = input(30);
  readonly maxFeeFijo        = input(0.10);
  readonly result            = input<GasResult | null>(null);

  // Visibility flags (mismas que luz para reutilizar UX)
  readonly showFeeEnergia       = input(true);
  readonly showFeeFijo          = input(true);
  readonly showComisionCard     = input(true);
  readonly showExcelButton      = input(true);
  readonly showContratarButton  = input(false);
  readonly showProductoSelector = input(true);

  readonly contratarButtonLabel   = input<string>('Contratar Apolo');
  readonly pdfButtonLabel         = input<string>('Descargar PDF');
  readonly contratarButtonVariant = input<'default' | 'secondary'>('secondary');
  readonly pdfButtonVariant       = input<'default' | 'secondary'>('default');

  // ── outputs ────────────────────────────────────────────────────────────────
  readonly openChange = output<boolean>();
  readonly formChange = output<GasFormValue>();
  readonly download   = output<GasDownloadEvent>();
  readonly contratar  = output<GasFormValue>();

  // ── icons ──────────────────────────────────────────────────────────────────
  readonly excelIcon:     UiIconSource = { type: 'apolo', icon: FileSpreadsheetIcon, size: 16 };
  readonly pdfIcon:       UiIconSource = { type: 'apolo', icon: FileDownIcon,        size: 16 };
  readonly lightningIcon: UiIconSource = { type: 'apolo', icon: LightningIcon,       size: 36 };

  // ── UI state ───────────────────────────────────────────────────────────────
  readonly preciosOpen = signal(false);

  // ── form signals ───────────────────────────────────────────────────────────
  readonly tariff          = signal('');
  readonly producto        = signal('');
  readonly feeEnergia      = signal(0);
  readonly feeFijo         = signal(0);
  readonly comisionEnergia = signal(0);

  // ── derived select options ─────────────────────────────────────────────────
  readonly tarifaOptions = computed<SelectOption[]>(() =>
    Object.keys(this.productsByTariff()).map(t => ({ value: t, label: t }))
  );

  readonly productoOptions = computed<SelectOption[]>(() =>
    (this.productsByTariff()[this.tariff()] ?? []).map(p => ({ value: p.name, label: p.name }))
  );

  readonly isFeeBlocked = computed(() =>
    this.feeLockedProducts().includes(this.producto())
  );

  constructor() {
    // Cuando llega un OCR, autoseleccionar tarifa + primer producto.
    effect(() => {
      const ocr = this.ocrResult();
      if (!ocr) return;
      untracked(() => {
        const tarifasDisponibles = Object.keys(this.productsByTariff());
        const tariffFromOcr = normalizeGasTariff(ocr.contrato?.tarifa);
        const tariff = tarifasDisponibles.includes(tariffFromOcr)
          ? tariffFromOcr
          : (tarifasDisponibles[0] ?? '');
        const productos = this.productsByTariff()[tariff] ?? [];
        const producto = productos[0]?.name ?? '';
        this.tariff.set(tariff);
        this.producto.set(producto);
        this.feeEnergia.set(0);
        this.feeFijo.set(0);
        this.comisionEnergia.set(this.comisionBase());
        this.emitFormChange();
      });
    });

    effect(() => {
      const base = this.comisionBase();
      untracked(() => this.comisionEnergia.set(base));
    }, { allowSignalWrites: true });
  }

  // ── form handlers ──────────────────────────────────────────────────────────

  onTariffChange(value: string) {
    const productos = this.productsByTariff()[value] ?? [];
    const producto = productos[0]?.name ?? '';
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

  onFeeEnergiaChange(value: number) {
    this.feeEnergia.set(value);
    this.emitFormChange();
  }

  onFeeFijoChange(value: number) {
    this.feeFijo.set(value);
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
      this.feeFijo.set(0);
    }
  }

  private buildFormValue(): GasFormValue {
    return {
      tariff:          this.tariff(),
      producto:        this.producto(),
      feeEnergia:      this.feeEnergia(),
      feeFijo:         this.feeFijo(),
      comisionEnergia: this.comisionEnergia(),
    };
  }

  private emitFormChange() {
    this.formChange.emit(this.buildFormValue());
  }

  // ── formatting ─────────────────────────────────────────────────────────────

  truncate(value: number): number {
    return Math.trunc(value);
  }

  formatEur(value: number | null | undefined): string {
    if (value === null || value === undefined) return '0,00 €';
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  formatPrice(value: number | null | undefined, digits = 6): string {
    if (value === null || value === undefined) return '0';
    return value.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
}
