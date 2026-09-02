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

  // Default: margen sugerido del bracket según Excel oficial (RL4=25%, RL5=15%, etc.).
  // Se rehidrata desde `pricingInfo.commercialMarginPct` en el effect al llegar el pricing.
  // El colaborador puede bajarlo o subirlo con el slider si negocia distinto.
  readonly fijoMarginPct    = signal<number>(0);
  readonly feeEnergiaEurMwh = signal<number>(0);
  readonly mibgasOverride   = signal<number | null>(null);

  readonly fijoMarginDisplay = computed(() => Math.round(this.fijoMarginPct() * 100));

  /** Margen fijo Apolo en €/día (BOE × fracción de margen). Base para todos los desgloses. */
  readonly fijoMarginEurDia = computed<number>(() => {
    const boe = this.pricingInfo()?.precioFijoBoeDia ?? 0;
    return boe * this.fijoMarginPct();
  });

  /** Margen fijo Apolo en € del período real de la factura (día × dias). Es lo que el
   *  colaborador razona ("cuánto voy a cobrar en esta factura de 56 días"), no €/día. */
  readonly fijoMarginEurPeriodo = computed<number>(() => {
    return this.fijoMarginEurDia() * (this.result()?.dias ?? 0);
  });

  /** Precio fijo €/día que paga HOY el cliente con su comercializadora, extraído del OCR.
   *  Prioridad: (1) primera línea de disponibilidad con precio_dia y mayor importe (evita la
   *  complementaria pequeña), (2) importe_total / dias_total retro-calculado. Devuelve 0 si no
   *  se puede determinar — evita mostrar un cuadrito con dato falso. */
  readonly clientePrecioFijoDia = computed<number>(() => {
    const disp = this.ocrResult()?.disponibilidad;
    if (!disp) return 0;
    const lineaPrincipal = (disp.lineas ?? [])
      .filter(l => (l.precio_dia ?? 0) > 0)
      .sort((a, b) => (b.importe ?? 0) - (a.importe ?? 0))[0];
    if (lineaPrincipal?.precio_dia && lineaPrincipal.precio_dia > 0) return lineaPrincipal.precio_dia;
    if (disp.importe_total && disp.dias_total && disp.dias_total > 0) {
      return disp.importe_total / disp.dias_total;
    }
    return 0;
  });

  readonly mibgasDisplay = computed<number>(() =>
    this.mibgasOverride() ?? this.pricingInfo()?.mibgasEurPerMwh ?? 0);

  /** Etiqueta corta que explica de dónde salió el precio MIBGAS mostrado.
   *  Si el user ya editó (mibgasOverride no null), se ignora la fuente del backend. */
  readonly mibgasInfoLabel = computed<{ text: string; tone: 'good' | 'info' | 'warn' } | null>(() => {
    if (this.mibgasOverride() !== null) return { text: 'Precio manual', tone: 'warn' };
    const p = this.pricingInfo();
    if (!p) return null;
    const date = this.formatDate(p.mibgasDate);
    switch (p.mibgasSource) {
      case 'invoice-date':    return { text: `Precio MIBGAS del ${date} (fecha factura)`, tone: 'good' };
      case 'override-request': return { text: 'Precio manual', tone: 'warn' };
      case 'override-admin':  return { text: 'Precio manual del admin (sin fecha exacta)', tone: 'warn' };
      default:                return { text: `Spot MIBGAS del ${date} (último disponible)`, tone: 'info' };
    }
  });

  private formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
  }

  readonly apoloLoses = computed(() => {
    const r = this.result();
    return !!r && r.ahorroEstudio < 0;
  });

  /**
   * Retro-cálculo del precio €/kWh que paga el cliente en energía. Sirve para detectar
   * tarifas TUR/muy competitivas y calibrar el warning de "cliente no ganable".
   *
   * Fórmula: (total_recurrente / (1 + IVA)) − IH − alquiler − fijo_bracket − regulados
   *
   * Auditoría 2026-08-24 vs factura real LOGOS energía:
   *   - Antes usaba IVA=21% hardcoded → error en facturas con IVA reducido 10% (RDL 8/2023).
   *   - Antes usaba fijo estimado 0.05 €/día (doméstico) → subestimaba grandes consumidores.
   *   - Antes incluía cargos no recurrentes (impago, penalización…) del OCR en el total.
   *   Estos 3 errores se compensaban por casualidad; con IVA distinto o cargos puntuales
   *   el precio implícito quedaba lejos del real.
   */
  readonly clientePrecioEnergiaEstimado = computed<number>(() => {
    const r   = this.result();
    const ocr = this.ocrResult();
    const p   = this.pricingInfo();
    if (!r || !ocr || !p || r.kwhTotal <= 0) return 0;

    // IVA real del OCR (10% reducido gas o 21% general). Fallback 21%.
    const ivaPct = (ocr.iva?.porcentaje ?? 21) / 100;

    // Descontar cargos NO recurrentes (impago, reconexión, penalización, etc.)
    // — no reflejan el precio del suministro y no vamos a "cobrárselos" con Apolo.
    const cargosNoRecurrentes = (ocr.otros_servicios ?? [])
      .filter(s => this.isCargoNoRecurrente(s.concepto))
      .reduce((sum, s) => sum + (s.importe ?? 0), 0);
    const totalRecurrente = Math.max(0, r.totalActual - cargosNoRecurrentes);

    const baseSinIva  = totalRecurrente / (1 + ivaPct);
    const ih          = r.kwhTotal * (ocr.ih?.tasa ?? 0.00234);
    const alquiler    = ocr.equipos?.importe ?? 0;
    // Fijo BOE del bracket real (no hardcoded doméstico) — viene del backend.
    const fijoBracket = r.dias * p.precioFijoBoeDia;
    // Peajes y cargos regulatorios sueltos que el OCR pueda haber extraído aparte.
    const regulados   = (ocr.regulatorio?.cuota_gts     ?? 0)
                      + (ocr.regulatorio?.tasa_cnmc     ?? 0)
                      + (ocr.regulatorio?.peajes_canones ?? 0)
                      + (ocr.regulatorio?.cargos        ?? 0);

    const energiaEuros = Math.max(0, baseSinIva - ih - alquiler - fijoBracket - regulados);
    return energiaEuros / r.kwhTotal;
  });

  /** Cargos que aparecen en `ocr.otros_servicios` pero NO forman parte del precio
   *  recurrente del suministro (deben descontarse al comparar). */
  private isCargoNoRecurrente(concepto: string | undefined): boolean {
    if (!concepto) return false;
    const c = concepto.toLowerCase();
    return c.includes('impago')
        || c.includes('gestión de cobro') || c.includes('gestion de cobro')
        || c.includes('reconexión')       || c.includes('reconexion')
        || c.includes('penalización')     || c.includes('penalizacion')
        || c.includes('regularización')   || c.includes('regularizacion')
        || c.includes('recargo');
  }

  readonly esClienteTurProbable = computed(() =>
    this.apoloLoses() && this.clientePrecioEnergiaEstimado() < 0.045);

  /**
   * Precio MÍNIMO estructural de Apolo (€/MWh) — BOE puro sin margen ni fee.
   * Es el suelo por debajo del cual Apolo perdería dinero por kWh vendido.
   * Replica la fórmula del backend (CompareGasTariffsUseCase) con:
   *   - margen_producto = 0 (Apolo Gas Indexado)
   *   - fee_energia = 0
   * Sirve para categorizar la "ganabilidad" del cliente comparando su precio real.
   */
  readonly precioMinimoApoloEurMwh = computed<number>(() => {
    const p = this.pricingInfo();
    if (!p) return 0;
    const reg = p.regulatory;
    const cnmc = 1.0014;
    const suma = p.mibgasEurPerMwh
               + reg.deviationEurPerMwh
               + reg.managementCostEurPerMwh
               + reg.fneeEurPerMwh
               + reg.storageEurPerMwh
               + p.bracketAtrVariable * cnmc;
    return suma
      * (1 + reg.tasaMunicipal)
      * (1 + reg.lossesPercentage)
      * (1 + reg.financialCostPercentage);
  });

  /**
   * Semáforo de ganabilidad basado en el gap entre precio energía del cliente y
   * el mínimo estructural de Apolo. Umbrales pensados con margen de error de la
   * estimación (~1-2 €/MWh):
   *   - Verde:    gap ≤ -5   (cliente paga ≥5 €/MWh MÁS que Apolo mínimo → margen amplio)
   *   - Amarillo: gap entre -5 y +3 (cerca del límite, difícil pero negociable)
   *   - Rojo:     gap > 3   (cliente paga MENOS que Apolo mínimo → imposible por precio)
   */
  readonly ganabilidadInfo = computed<{
    tone: 'good' | 'warn' | 'bad';
    title: string;
    detail: string;
    strategy: string[];
  } | null>(() => {
    const p = this.pricingInfo();
    const r = this.result();
    if (!p || !r) return null;

    const minApolo = this.precioMinimoApoloEurMwh();
    const cliente  = this.clientePrecioEnergiaEstimado() * 1000; // €/kWh → €/MWh
    if (cliente <= 0 || minApolo <= 0) return null;

    const gap = minApolo - cliente;   // > 0 = cliente barato = Apolo pierde estructuralmente
    const perdidaPeriodo = r.ahorroEstudio < 0 ? Math.abs(r.ahorroEstudio) : 0;

    if (gap <= -5) {
      return {
        tone: 'good',
        title: 'Cliente ganable — tienes margen',
        detail: `Cliente paga ~${cliente.toFixed(0)} €/MWh · Mínimo Apolo: ${minApolo.toFixed(0)} €/MWh · ${Math.abs(gap).toFixed(0)} €/MWh a tu favor.`,
        strategy: [
          'Sube el margen fijo hasta donde el cliente tolere',
          'Cierra con precio + fijeza + soporte',
        ],
      };
    }
    if (gap <= 3) {
      return {
        tone: 'warn',
        title: 'Cliente en el límite — difícil pero posible',
        detail: `Cliente paga ~${cliente.toFixed(0)} €/MWh · Mínimo Apolo: ${minApolo.toFixed(0)} €/MWh · gap ${gap >= 0 ? '+' : ''}${gap.toFixed(0)} €/MWh.`,
        strategy: [
          'Con margen 0% apenas empatas — ajusta con cuidado',
          'Ofrece valor añadido (fijeza 12 meses, servicios) para justificar +margen',
        ],
      };
    }
    // gap > 3 → cliente paga menos que el mínimo estructural de Apolo
    return {
      tone: 'bad',
      title: 'Cliente NO ganable por precio',
      detail: `Cliente paga ${cliente.toFixed(0)} €/MWh · Mínimo Apolo (sin margen): ${minApolo.toFixed(0)} €/MWh · ${gap.toFixed(0)} €/MWh por debajo del coste Apolo.`
            + (perdidaPeriodo > 0 ? ` Apolo perdería ${perdidaPeriodo.toFixed(0)} €/factura si intenta igualar.` : ''),
      strategy: [
        'Ofrece producto FIJO si su contrato es indexado (protección ante subidas MIBGAS)',
        'Bundling luz + gas con descuento cruzado',
        'Pregunta cuándo vence su contrato — cuando venza, Apolo puede ser competitivo',
      ],
    };
  });

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
    // Cada factura nueva resetea sliders. El margen fijo arranca en el sugerido del
    // bracket (Excel oficial: RL4=25%, RL5=15%, etc.), no en 0. Antes arrancaba en 0
    // y el colaborador tenía que subirlo manualmente cada vez — riesgo de olvidar el
    // margen y firmar a BOE puro sin ganancia para Apolo.
    effect(() => {
      const p = this.pricingInfo();
      if (!p) return;
      untracked(() => {
        this.fijoMarginPct.set(p.commercialMarginPct ?? 0);
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
