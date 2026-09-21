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
import { DecimalPipe } from '@angular/common';
import { ButtonComponent, DialogComponent, InputFieldComponent, SliderComponent } from '@apolo-energies/ui';
import { ApoloIcons, FileDownIcon, FileSpreadsheetIcon, LightningIcon, UiIconSource } from '@apolo-energies/icons';
import { GasOcrResult, GasResult } from '../../../../../../core/models/comparator-gas.model';
import { GasDownloadEvent } from '../../comparator-gas-events.model';
import { ApoloGasPricing } from '../../../../../../core/services/comparator-gas.service';
import { GasOverridesController } from './gas-overrides.controller';
import {
  computeClientePrecioEnergiaEstimado,
  computeClientePrecioFijoDia,
  computeGanabilidadInfo,
  computePrecioMinimoApoloEurMwh,
  formatEurValue,
  formatPriceValue,
  isApoloLosing,
  isClienteTurProbable,
  truncateValue,
} from './comparator-gas-modal.helpers';

export interface GasModalOverrides {
  fijoMarginPct:    number;   // fracción decimal (1.00 = +100%)
  feeEnergiaEurMwh: number;
  mibgasOverride:   number | null;  // €/MWh o null si mantiene el del backend
}

@Component({
  selector: 'app-comparator-gas-modal',
  standalone: true,
  imports: [DecimalPipe, DialogComponent, InputFieldComponent, ButtonComponent, ApoloIcons, SliderComponent],
  templateUrl: './comparator-gas-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparatorGasModalComponent {
  // ── inputs ─────────────────────────────────────────────────────────────────
  readonly open         = input(false);
  readonly ocrResult    = input<GasOcrResult | null>(null);
  readonly result       = input<GasResult | null>(null);
  readonly pricingError = input<string | null>(null);
  readonly pricingInfo  = input<ApoloGasPricing | null>(null);

  readonly showExcelButton     = input(true);
  readonly showContratarButton = input(false);

  readonly contratarButtonLabel   = input<string>('Contratar Apolo');
  readonly pdfButtonLabel         = input<string>('Descargar PDF');
  readonly contratarButtonVariant = input<'default' | 'secondary'>('secondary');
  readonly pdfButtonVariant       = input<'default' | 'secondary'>('default');

  // ── outputs ────────────────────────────────────────────────────────────────
  readonly openChange      = output<boolean>();
  readonly download        = output<GasDownloadEvent>();
  readonly contratar       = output<void>();
  readonly overridesChange = output<GasModalOverrides>();

  // ── icons ──────────────────────────────────────────────────────────────────
  readonly excelIcon:     UiIconSource = { type: 'apolo', icon: FileSpreadsheetIcon, size: 16 };
  readonly pdfIcon:       UiIconSource = { type: 'apolo', icon: FileDownIcon,        size: 16 };
  readonly lightningIcon: UiIconSource = { type: 'apolo', icon: LightningIcon,       size: 36 };

  // Precios ofertados: plegado por defecto — el colaborador expande si quiere revisar
  // el desglose €/kWh, €/día. Estado inicial (siempre plegado) porque es info de detalle.
  readonly periodosOpen = signal(false);

  // ── overrides (margen fijo / fee energía / MIBGAS manual) ───────────────────
  private readonly overrides = new GasOverridesController({
    pricingInfo: () => this.pricingInfo(),
    result:      () => this.result(),
    onChange:    () => this.emitOverrides(),
  });

  readonly fijoMarginPct        = this.overrides.fijoMarginPct;
  readonly feeEnergiaEurMwh     = this.overrides.feeEnergiaEurMwh;
  readonly mibgasOverride       = this.overrides.mibgasOverride;
  readonly fijoMarginDisplay    = this.overrides.fijoMarginDisplay;
  readonly fijoMarginEurDia     = this.overrides.fijoMarginEurDia;
  readonly fijoMarginEurPeriodo = this.overrides.fijoMarginEurPeriodo;
  readonly mibgasDisplay        = this.overrides.mibgasDisplay;
  readonly mibgasInfoLabel      = this.overrides.mibgasInfoLabel;

  // ── cálculos de ganabilidad (fórmulas puras en comparator-gas-modal.helpers) ─
  readonly apoloLoses = computed(() => isApoloLosing(this.result()));

  readonly clientePrecioFijoDia = computed<number>(() =>
    computeClientePrecioFijoDia(this.ocrResult()));

  readonly clientePrecioEnergiaEstimado = computed<number>(() =>
    computeClientePrecioEnergiaEstimado(this.result(), this.ocrResult(), this.pricingInfo()));

  readonly esClienteTurProbable = computed(() =>
    isClienteTurProbable(this.apoloLoses(), this.clientePrecioEnergiaEstimado()));

  readonly precioMinimoApoloEurMwh = computed<number>(() =>
    computePrecioMinimoApoloEurMwh(this.pricingInfo()));

  readonly ganabilidadInfo = computed(() =>
    computeGanabilidadInfo(
      this.pricingInfo(),
      this.result(),
      this.precioMinimoApoloEurMwh(),
      this.clientePrecioEnergiaEstimado(),
    ));

  constructor() {
    // Cada factura nueva resetea sliders (ver comentario en GasOverridesController.reset).
    effect(() => {
      const p = this.pricingInfo();
      if (!p) return;
      untracked(() => {
        this.overrides.reset(p);
        this.emitOverrides();
      });
    });
  }

  onFijoMarginChange(percentInt: number): void { this.overrides.onFijoMarginChange(percentInt); }
  onFeeEnergiaChange(value: number): void { this.overrides.onFeeEnergiaChange(value); }
  onMibgasChange(value: string): void { this.overrides.onMibgasChange(value); }

  private emitOverrides(): void {
    this.overridesChange.emit(this.overrides.snapshot());
  }

  close() { this.openChange.emit(false); }

  onDownload(type: 'pdf' | 'excel') {
    if (!this.result()) return;
    this.download.emit({ type });
  }

  onContratar() { this.contratar.emit(); }

  readonly truncate    = truncateValue;
  readonly formatEur   = formatEurValue;
  readonly formatPrice = formatPriceValue;
}
