import { GasOcrResult, GasResult } from './comparator-gas.models';

const IVA_DEFAULT = 0.21;
// IH (Impuesto Hidrocarburos): 0.00234 €/kWh general, 0.00108 reducida para grandes
// consumidores. Fallback solo si el OCR no captura la tasa de la factura.
const IH_TASA_DEFAULT = 0.00234;

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

  // TODO cálculo se basa en los días REALES de la factura (no proyecta a mes ficticio).
  // Los campos "*Mensual" se mantienen por compatibilidad con el interface pero
  // ahora contienen el TOTAL DEL PERÍODO de la factura (66 días si es bimestral,
  // 30 si es mensual, etc.). La UI etiqueta acordemente.
  const totalActualMensual = totalActual;   // total del período real
  const totalOfertaMensual = totalOferta;   // total del período real

  // Ganancia Apolo sobre BOE puro en el PERÍODO real de la factura.
  const gananciaApoloMensual = round(margenFijoDia * dias + feeEnergiaEurKwh * kwhTotal, 2);

  const ahorroEstudio   = round(totalActual - totalOferta, 2);   // ahorro del período
  const consumoAnualKwh = annualKwhOverride && annualKwhOverride > 0
    ? annualKwhOverride
    : (dias > 0 ? kwhTotal * (365 / dias) : kwhTotal);

  // Escala a año calendario (365 días) desde el período real, sin pasar por
  // un "mes de 30 días" que introducía un sesgo de ~1.4% (12×30=360 ≠ 365).
  const escalaAnual        = dias > 0 ? 365 / dias : 12;
  const ahorroXAnio        = round(ahorroEstudio * escalaAnual, 2);
  const gananciaApoloAnual = round(gananciaApoloMensual * escalaAnual, 2);

  const ahorroPorcent = totalActual > 0
    ? round((ahorroEstudio / totalActual) * 100, 2)
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
