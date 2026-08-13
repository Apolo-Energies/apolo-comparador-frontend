import { GasOcrResult, GasResult } from './comparator-gas.models';

const IVA_DEFAULT = 0.21;
// IH (Impuesto Hidrocarburos): 0.00234 €/kWh general, 0.00108 reducida para grandes
// consumidores. Fallback solo si el OCR no captura la tasa de la factura.
const IH_TASA_DEFAULT = 0.00234;

// Prorrateo a mes fiscal (30 días) para comparar clientes con ciclos distintos:
// facturas Nedgia son bimestrales, otras mensuales, otras trimestrales.
const DIAS_POR_MES = 30;

const round = (n: number, d = 2) =>
  Math.round(n * Math.pow(10, d)) / Math.pow(10, d);

export interface CalcularFacturaGasOverrides {
  /**
   * Slider del colaborador: margen del fijo Apolo como fracción sobre el BOE puro.
   * Ausente = respeta el margen del bracket que vino del backend.
   * 0 = solo BOE (loss leader), 1 = +100% (default Excel RL1).
   */
  fijoMarginPct?: number;
  /** Slider del colaborador: fee €/MWh sumado al variable base. */
  feeEnergiaEurMwh?: number;
}

/**
 * Comparativa Apolo vs factura del cliente.
 *
 * <c>apoloPricing</c> es obligatorio: viene de POST /gas/comparison (fórmula
 * regulatoria oficial). El caller maneja el null → error UI. Total actual se
 * toma de <c>ocr.total</c> (verdad terreno, no reconstruimos desde OCR).
 */
export function calcularFacturaGas(
  ocr: GasOcrResult,
  apoloPricing: { precioEnergiaEurKwh: number; precioFijoDiaEur: number; precioFijoBoeDia: number },
  annualKwhOverride?: number,
  overrides?: CalcularFacturaGasOverrides,
): GasResult {
  const kwhTotal = ocr.consumo?.kwh_total ?? 0;
  const dias     = ocr.periodo_facturacion?.numero_dias ?? 30;
  const ihTasa   = ocr.ih?.tasa ?? IH_TASA_DEFAULT;
  const ivaPct   = (ocr.iva?.porcentaje ?? IVA_DEFAULT * 100) / 100;

  const precioFijoBoeDia = round(apoloPricing.precioFijoBoeDia, 6);
  const precioFijoOferta = overrides?.fijoMarginPct !== undefined
    ? round(precioFijoBoeDia * (1 + overrides.fijoMarginPct), 6)
    : round(apoloPricing.precioFijoDiaEur, 6);
  const margenFijoDia    = round(precioFijoOferta - precioFijoBoeDia, 6);

  const feeEnergiaEurKwh    = (overrides?.feeEnergiaEurMwh ?? 0) / 1000;
  const precioEnergiaOferta = round(apoloPricing.precioEnergiaEurKwh + feeEnergiaEurKwh, 6);

  // Costes que NO cobra la comercializadora (los cobra la distribuidora aparte):
  // alquiler contador + bono social térmico. El resto de conceptos regulatorios
  // (peajes, cuota GTS, tasa CNMC 0.14%) NO se suman aquí — Nedgia declara que ya
  // vienen incluidos en su Término Fijo/Energía, y el backend los aplica vía
  // peaje × 1.0014 y multiplicadores tm/pe/cfin. Sumarlos sería doble contabilidad.
  const alquilerEquipo    = ocr.equipos?.importe             ?? 0;
  const bonoSocialTermico = ocr.bono_social_termico?.importe ?? 0;
  const costesRegulados = alquilerEquipo + bonoSocialTermico;

  const ihImporteOferta = kwhTotal * ihTasa;

  const costeEnergiaOferta = kwhTotal * precioEnergiaOferta;
  const costeFijoOferta    = dias * precioFijoOferta;
  const baseIvaOferta      = costeEnergiaOferta + costeFijoOferta + ihImporteOferta + costesRegulados;
  const ivaImporteOferta   = baseIvaOferta * ivaPct;
  const totalOferta        = round(baseIvaOferta + ivaImporteOferta, 2);

  const totalActual = ocr.total && ocr.total > 0 ? round(ocr.total, 2) : 0;

  const factorMensual = dias > 0 ? DIAS_POR_MES / dias : 1;
  const totalActualMensual = round(totalActual * factorMensual, 2);
  const totalOfertaMensual = round(totalOferta * factorMensual, 2);

  // Ganancia Apolo = lo que se lleva sobre BOE puro. Cero cuando ambos sliders
  // están al mínimo. Se muestra en la UI para que el colaborador ajuste hasta
  // encontrar el punto donde gana sin perder al cliente.
  const consumoMensualKwh    = kwhTotal * factorMensual;
  const gananciaApoloMensual = round(margenFijoDia * DIAS_POR_MES + feeEnergiaEurKwh * consumoMensualKwh, 2);
  const gananciaApoloAnual   = round(gananciaApoloMensual * 12, 2);

  const ahorroEstudio   = round(totalActualMensual - totalOfertaMensual, 2);
  const consumoAnualKwh = annualKwhOverride && annualKwhOverride > 0
    ? annualKwhOverride
    : (dias > 0 ? kwhTotal * (365 / dias) : kwhTotal);
  const ahorroXAnio   = round(ahorroEstudio * 12, 2);
  const ahorroPorcent = totalActualMensual > 0
    ? round((ahorroEstudio / totalActualMensual) * 100, 2)
    : 0;

  return {
    ahorroEstudio,
    ahorroXAnio,
    ahorro_porcent: ahorroPorcent,
    precioEnergiaOferta,
    precioFijoOferta,
    precioFijoBoeDia,
    margenFijoDia,
    totalActual,
    totalOferta,
    totalActualMensual,
    totalOfertaMensual,
    gananciaApoloMensual,
    gananciaApoloAnual,
    baseIvaOferta:    round(baseIvaOferta, 2),
    ivaImporteOferta: round(ivaImporteOferta, 2),
    dias,
    kwhTotal,
    consumoAnualKwh:  round(consumoAnualKwh, 2),
  };
}

// Normaliza "RL01"/"RL1"/"R1" → "R1" (el frontend usa R1..R6 sin el prefijo L).
export function normalizeGasTariff(raw?: string): string {
  if (!raw) return '';
  const upper = raw.trim().toUpperCase();
  const match = upper.match(/^R[L]?(\d+)$/);
  if (!match) return upper;
  const n = parseInt(match[1], 10);
  return `R${n}`;
}
