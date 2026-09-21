import { ApoloGasPricing } from '../../../../../../core/services/comparator-gas.service';
import { GasOcrResult, GasResult } from '../../../../../../core/models/comparator-gas.model';

/** Formatea una fecha ISO (`YYYY-MM-DD...`) como `DD/MM/YYYY`. Devuelve '—' si no hay fecha. */
export function formatShortDate(iso: string | undefined): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Cargos que aparecen en `ocr.otros_servicios` pero NO forman parte del precio
 *  recurrente del suministro (deben descontarse al comparar). */
export function isCargoNoRecurrente(concepto: string | undefined): boolean {
  if (!concepto) return false;
  const c = concepto.toLowerCase();
  return c.includes('impago')
      || c.includes('gestión de cobro') || c.includes('gestion de cobro')
      || c.includes('reconexión')       || c.includes('reconexion')
      || c.includes('penalización')     || c.includes('penalizacion')
      || c.includes('regularización')   || c.includes('regularizacion')
      || c.includes('recargo');
}

/** Precio fijo €/día que paga HOY el cliente con su comercializadora, extraído del OCR.
 *  Prioridad: (1) primera línea de disponibilidad con precio_dia y mayor importe (evita la
 *  complementaria pequeña), (2) importe_total / dias_total retro-calculado. Devuelve 0 si no
 *  se puede determinar — evita mostrar un cuadrito con dato falso. */
export function computeClientePrecioFijoDia(ocr: GasOcrResult | null): number {
  const disp = ocr?.disponibilidad;
  if (disp) {
    const lineaPrincipal = (disp.lineas ?? [])
      .filter(l => (l.precio_dia ?? 0) > 0)
      .sort((a, b) => (b.importe ?? 0) - (a.importe ?? 0))[0];
    if (lineaPrincipal?.precio_dia && lineaPrincipal.precio_dia > 0) return lineaPrincipal.precio_dia;
    if (disp.importe_total && disp.dias_total && disp.dias_total > 0) {
      return disp.importe_total / disp.dias_total;
    }
  }
  // Fallback TUR: término fijo viene como €/mes en lugar de €/día en la sección "ENERGÍA".
  const totalDisp = ocr?.totales_gas?.disponibilidad;
  const dias = ocr?.periodo_facturacion?.numero_dias;
  if (totalDisp && totalDisp > 0 && dias && dias > 0) return totalDisp / dias;
  return 0;
}

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
export function computeClientePrecioEnergiaEstimado(
  result:  GasResult | null,
  ocr:     GasOcrResult | null,
  pricing: ApoloGasPricing | null,
): number {
  if (!result || !ocr || !pricing || result.kwhTotal <= 0) return 0;

  // IVA real del OCR (10% reducido gas o 21% general). Fallback 21%.
  const ivaPct = (ocr.iva?.porcentaje ?? 21) / 100;

  // Descontar cargos NO recurrentes (impago, reconexión, penalización, etc.)
  // — no reflejan el precio del suministro y no vamos a "cobrárselos" con Apolo.
  const cargosNoRecurrentes = (ocr.otros_servicios ?? [])
    .filter(s => isCargoNoRecurrente(s.concepto))
    .reduce((sum, s) => sum + (s.importe ?? 0), 0);
  const totalRecurrente = Math.max(0, result.totalActual - cargosNoRecurrentes);

  const baseSinIva  = totalRecurrente / (1 + ivaPct);
  const ih          = result.kwhTotal * (ocr.ih?.tasa ?? 0.00234);
  const alquiler    = ocr.equipos?.importe ?? 0;
  // Fijo BOE del bracket real (no hardcoded doméstico) — viene del backend.
  const fijoBracket = result.dias * pricing.precioFijoBoeDia;
  // Peajes y cargos regulatorios sueltos que el OCR pueda haber extraído aparte.
  const regulados   = (ocr.regulatorio?.cuota_gts     ?? 0)
                    + (ocr.regulatorio?.tasa_cnmc     ?? 0)
                    + (ocr.regulatorio?.peajes_canones ?? 0)
                    + (ocr.regulatorio?.cargos        ?? 0);

  const energiaEuros = Math.max(0, baseSinIva - ih - alquiler - fijoBracket - regulados);
  return energiaEuros / result.kwhTotal;
}

/**
 * Precio MÍNIMO estructural de Apolo (€/MWh) — BOE puro sin margen ni fee.
 * Es el suelo por debajo del cual Apolo perdería dinero por kWh vendido.
 * Replica la fórmula del backend (CompareGasTariffsUseCase) con:
 *   - margen_producto = 0 (Apolo Gas Indexado)
 *   - fee_energia = 0
 * Sirve para categorizar la "ganabilidad" del cliente comparando su precio real.
 */
export function computePrecioMinimoApoloEurMwh(pricing: ApoloGasPricing | null): number {
  if (!pricing) return 0;
  const reg = pricing.regulatory;
  const cnmc = 1.0014;
  const suma = pricing.mibgasEurPerMwh
             + reg.deviationEurPerMwh
             + reg.managementCostEurPerMwh
             + reg.fneeEurPerMwh
             + reg.storageEurPerMwh
             + pricing.bracketAtrVariable * cnmc;
  return suma
    * (1 + reg.tasaMunicipal)
    * (1 + reg.lossesPercentage)
    * (1 + reg.financialCostPercentage);
}

export interface GanabilidadInfo {
  tone:     'good' | 'warn' | 'bad';
  title:    string;
  detail:   string;
  strategy: string[];
}

/**
 * Semáforo de ganabilidad basado en el gap entre precio energía del cliente y
 * el mínimo estructural de Apolo. Umbrales pensados con margen de error de la
 * estimación (~1-2 €/MWh):
 *   - Verde:    gap ≤ -5   (cliente paga ≥5 €/MWh MÁS que Apolo mínimo → margen amplio)
 *   - Amarillo: gap entre -5 y +3 (cerca del límite, difícil pero negociable)
 *   - Rojo:     gap > 3   (cliente paga MENOS que Apolo mínimo → imposible por precio)
 */
export function computeGanabilidadInfo(
  pricing:              ApoloGasPricing | null,
  result:               GasResult | null,
  minApolo:             number,
  clienteEurKwhEstimado: number,
): GanabilidadInfo | null {
  if (!pricing || !result) return null;

  const cliente = clienteEurKwhEstimado * 1000; // €/kWh → €/MWh
  if (cliente <= 0 || minApolo <= 0) return null;

  const gap = minApolo - cliente;   // > 0 = cliente barato = Apolo pierde estructuralmente
  const perdidaPeriodo = result.ahorroEstudio < 0 ? Math.abs(result.ahorroEstudio) : 0;

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
}

export function isApoloLosing(result: GasResult | null): boolean {
  return !!result && result.ahorroEstudio < 0;
}

export function isClienteTurProbable(apoloLoses: boolean, clienteEurKwhEstimado: number): boolean {
  return apoloLoses && clienteEurKwhEstimado < 0.045;
}

export function truncateValue(value: number): number {
  return Math.trunc(value);
}

export function formatEurValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0,00 €';
  return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function formatPriceValue(value: number | null | undefined, digits = 6): string {
  if (value === null || value === undefined) return '0';
  return value.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
