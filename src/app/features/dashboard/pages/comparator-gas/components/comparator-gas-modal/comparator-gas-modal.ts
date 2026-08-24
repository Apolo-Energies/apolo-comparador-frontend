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
import { GasDownloadEvent, GasOcrResult, GasResult } from '../../comparator-gas.models';
import { ApoloGasPricing } from '../../../../../../services/comparator-gas.service';

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

  readonly periodosOpen = signal(true);
  readonly desgloseOpen = signal(false);

  // Default 0% (solo BOE) — el colaborador sube el margen si el cliente lo tolera.
  readonly fijoMarginPct    = signal<number>(0);
  readonly feeEnergiaEurMwh = signal<number>(0);
  readonly mibgasOverride   = signal<number | null>(null);

  readonly fijoMarginDisplay = computed(() => Math.round(this.fijoMarginPct() * 100));

  readonly mibgasDisplay = computed<number>(() =>
    this.mibgasOverride() ?? this.pricingInfo()?.mibgasEurPerMwh ?? 0);

  readonly apoloLoses = computed(() => {
    const r = this.result();
    return !!r && r.ahorroEstudio < 0;
  });

  // Retro-cálculo grueso del precio €/kWh que paga el cliente actual, para detectar
  // TUR: base sin IVA, quitando IH + alquiler + un fijo estimado. Solo aproximado
  // (no sabemos el fijo real del cliente sin OCR); < 0.045 €/kWh sugiere TUR.
  readonly clientePrecioEnergiaEstimado = computed<number>(() => {
    const r   = this.result();
    const ocr = this.ocrResult();
    if (!r || !ocr || r.kwhTotal <= 0) return 0;
    const baseSinIva  = r.totalActual / 1.21;
    const ih          = r.kwhTotal * (ocr.ih?.tasa ?? 0.00234);
    const alquiler    = ocr.equipos?.importe ?? 0;
    const fijoEstimado = r.dias * 0.05;
    const energiaEuros = Math.max(0, baseSinIva - ih - alquiler - fijoEstimado);
    return energiaEuros / r.kwhTotal;
  });

  readonly esClienteTurProbable = computed(() =>
    this.apoloLoses() && this.clientePrecioEnergiaEstimado() < 0.045);

  /** Reproduce la fórmula del backend paso a paso para que el usuario vea de
   *  dónde sale cada número. Debe cuadrar con VariableEurPerMwh del response. */
  readonly desgloseCalc = computed(() => {
    const p = this.pricingInfo();
    const r = this.result();
    if (!p || !r) return null;

    const reg    = p.regulatory;
    const cnmc   = 1.0014;
    const peajeCnmc = p.bracketAtrVariable * cnmc;
    const sumaBase  = p.mibgasEurPerMwh + reg.deviationEurPerMwh + reg.managementCostEurPerMwh
                    + p.marginProductEurPerMwh + reg.fneeEurPerMwh + peajeCnmc + reg.storageEurPerMwh;
    const multTm    = sumaBase * (1 + reg.tasaMunicipal);
    const multTmPe  = multTm * (1 + reg.lossesPercentage);
    const multFinal = multTmPe * (1 + reg.financialCostPercentage);
    const feeEurKwh = this.feeEnergiaEurMwh() / 1000;

    return {
      mibgas:      p.mibgasEurPerMwh,
      ds:          reg.deviationEurPerMwh,
      cg:          reg.managementCostEurPerMwh,
      marginProd:  p.marginProductEurPerMwh,
      fnee:        reg.fneeEurPerMwh,
      peajeAtr:    p.bracketAtrVariable,
      peajeCnmc,
      storage:     reg.storageEurPerMwh,
      sumaBase,
      tmPct:       reg.tasaMunicipal,
      pePct:       reg.lossesPercentage,
      cfinPct:     reg.financialCostPercentage,
      multTm, multTmPe, multFinal,
      variableEurKwh: multFinal / 1000,
      feeEurKwh,
      variableFinalEurKwh: multFinal / 1000 + feeEurKwh,

      fijoBoeAnual: p.precioFijoBoeDia * 365,
      fijoBoeDia:   p.precioFijoBoeDia,
      fijoMarginPct: this.fijoMarginPct(),
      fijoConMargen: r.precioFijoOferta,

      // Totales del período (para el consumo real)
      kwhTotal:     r.kwhTotal,
      dias:         r.dias,
      costeEnergia: r.kwhTotal * r.precioEnergiaOferta,
      costeFijo:    r.dias * r.precioFijoOferta,
      baseIva:      r.baseIvaOferta,
      iva:          r.ivaImporteOferta,
      total:        r.totalOferta,
    };
  });

  constructor() {
    // Cada factura nueva resetea sliders (BOE puro) — el colaborador negocia
    // desde la offer más competitiva y sube margen si el cliente lo tolera.
    effect(() => {
      const p = this.pricingInfo();
      if (!p) return;
      untracked(() => {
        this.fijoMarginPct.set(0);
        this.feeEnergiaEurMwh.set(0);
        this.mibgasOverride.set(null);
        this.emitOverrides();
      });
    });
  }

  onFijoMarginChange(percentInt: number): void {
    this.fijoMarginPct.set(percentInt / 100);
    this.emitOverrides();
  }

  onFeeEnergiaChange(value: number): void {
    this.feeEnergiaEurMwh.set(value);
    this.emitOverrides();
  }

  onMibgasChange(value: string): void {
    const parsed = value === '' || value == null ? null : Number(value);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
    this.mibgasOverride.set(parsed);
    this.emitOverrides();
  }

  private emitOverrides(): void {
    this.overridesChange.emit({
      fijoMarginPct:    this.fijoMarginPct(),
      feeEnergiaEurMwh: this.feeEnergiaEurMwh(),
      mibgasOverride:   this.mibgasOverride(),
    });
  }

  close() { this.openChange.emit(false); }

  onDownload(type: 'pdf' | 'excel') {
    if (!this.result()) return;
    this.download.emit({ type });
  }

  onContratar() { this.contratar.emit(); }

  truncate(value: number): number { return Math.trunc(value); }

  formatEur(value: number | null | undefined): string {
    if (value === null || value === undefined) return '0,00 €';
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }

  formatPrice(value: number | null | undefined, digits = 6): string {
    if (value === null || value === undefined) return '0';
    return value.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
}
