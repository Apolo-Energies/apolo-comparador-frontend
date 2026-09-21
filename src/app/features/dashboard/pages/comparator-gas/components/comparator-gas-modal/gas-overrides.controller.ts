import { computed, signal } from '@angular/core';
import { ApoloGasPricing } from '../../../../../../core/services/comparator-gas.service';
import { GasResult } from '../../../../../../core/models/comparator-gas.model';
import { formatShortDate } from './comparator-gas-modal.helpers';
import type { GasModalOverrides } from './comparator-gas-modal';

/** Dependencias externas (inputs del componente) que el controller necesita leer. */
export interface GasOverridesControllerContext {
  pricingInfo: () => ApoloGasPricing | null;
  result:      () => GasResult | null;
  /** Se invoca tras cada cambio manual del colaborador (no en el reset por factura nueva). */
  onChange:    () => void;
}

/**
 * Estado y handlers de los 3 sliders/inputs de override del modal de gas
 * (margen fijo, fee de energía, MIBGAS manual). Clase plana sin DI de
 * Angular, instanciada por `ComparatorGasModalComponent`.
 */
export class GasOverridesController {
  // Default: margen sugerido del bracket según Excel oficial (RL4=25%, RL5=15%, etc.).
  // Se rehidrata desde `pricingInfo.commercialMarginPct` en `reset()` al llegar el pricing.
  // El colaborador puede bajarlo o subirlo con el slider si negocia distinto.
  readonly fijoMarginPct    = signal<number>(0);
  readonly feeEnergiaEurMwh = signal<number>(0);
  readonly mibgasOverride   = signal<number | null>(null);

  readonly fijoMarginDisplay = computed(() => Math.round(this.fijoMarginPct() * 100));

  /** Margen fijo Apolo en €/día (BOE × fracción de margen). Base para todos los desgloses. */
  readonly fijoMarginEurDia = computed<number>(() => {
    const boe = this.ctx.pricingInfo()?.precioFijoBoeDia ?? 0;
    return boe * this.fijoMarginPct();
  });

  /** Margen fijo Apolo en € del período real de la factura (día × dias). Es lo que el
   *  colaborador razona ("cuánto voy a cobrar en esta factura de 56 días"), no €/día. */
  readonly fijoMarginEurPeriodo = computed<number>(() =>
    this.fijoMarginEurDia() * (this.ctx.result()?.dias ?? 0));

  readonly mibgasDisplay = computed<number>(() =>
    this.mibgasOverride() ?? this.ctx.pricingInfo()?.mibgasEurPerMwh ?? 0);

  /** Etiqueta corta que explica de dónde salió el precio MIBGAS mostrado.
   *  Si el user ya editó (mibgasOverride no null), se ignora la fuente del backend. */
  readonly mibgasInfoLabel = computed<{ text: string; tone: 'good' | 'info' | 'warn' } | null>(() => {
    if (this.mibgasOverride() !== null) return { text: 'Precio manual', tone: 'warn' };
    const p = this.ctx.pricingInfo();
    if (!p) return null;
    const date = formatShortDate(p.mibgasDate);
    switch (p.mibgasSource) {
      case 'invoice-date':     return { text: `Precio MIBGAS del ${date} (fecha factura)`, tone: 'good' };
      case 'override-request': return { text: 'Precio manual', tone: 'warn' };
      case 'override-admin':   return { text: 'Precio manual del admin (sin fecha exacta)', tone: 'warn' };
      default:                 return { text: `Spot MIBGAS del ${date} (último disponible)`, tone: 'info' };
    }
  });

  constructor(private readonly ctx: GasOverridesControllerContext) {}

  /** Cada factura nueva resetea sliders. El margen fijo arranca en el sugerido del
   *  bracket (Excel oficial: RL4=25%, RL5=15%, etc.), no en 0. Antes arrancaba en 0
   *  y el colaborador tenía que subirlo manualmente cada vez — riesgo de olvidar el
   *  margen y firmar a BOE puro sin ganancia para Apolo. No dispara `onChange`: el
   *  caller emite una sola vez tras resetear los 3 campos. */
  reset(pricingInfo: ApoloGasPricing | null): void {
    this.fijoMarginPct.set(pricingInfo?.commercialMarginPct ?? 0);
    this.feeEnergiaEurMwh.set(0);
    this.mibgasOverride.set(null);
  }

  onFijoMarginChange(percentInt: number): void {
    this.fijoMarginPct.set(percentInt / 100);
    this.ctx.onChange();
  }

  onFeeEnergiaChange(value: number): void {
    this.feeEnergiaEurMwh.set(value);
    this.ctx.onChange();
  }

  onMibgasChange(value: string): void {
    const parsed = value === '' || value == null ? null : Number(value);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return;
    this.mibgasOverride.set(parsed);
    this.ctx.onChange();
  }

  snapshot(): GasModalOverrides {
    return {
      fijoMarginPct:    this.fijoMarginPct(),
      feeEnergiaEurMwh: this.feeEnergiaEurMwh(),
      mibgasOverride:   this.mibgasOverride(),
    };
  }
}
