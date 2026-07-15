import {
  GasFormValue,
  GasOcrResult,
  GasProductsByTariff,
  GasResult,
} from './comparator-gas.models';

const IVA_DEFAULT = 0.21;
// IH (Impuesto sobre Hidrocarburos): tasa por defecto cuando la factura no la trae.
// 0.00234 €/kWh es la tarifa general; 0.00108 es la reducida para grandes consumidores.
const IH_TASA_DEFAULT = 0.00234;

// Placeholder por si en el futuro se lanzan productos "Snap" en gas con comisión fija (mismo patrón que luz).
const SNAP_GAS: Record<string, number> = {};
const SNAP_GAS_PRODUCTS = new Set(Object.keys(SNAP_GAS));

const round = (n: number, d = 2) =>
  Math.round(n * Math.pow(10, d)) / Math.pow(10, d);

export function calcularFacturaGas(
  form: GasFormValue,
  ocr: GasOcrResult,
  productsByTariff: GasProductsByTariff,
  /**
   * Consumo anual real del CUPS (SIPS/CNMC). Si viene > 0 se usa como
   * `consumoAnualKwh` en vez de la proyección `kwhTotal × 365/dias`.
   * Necesario en gas por la alta estacionalidad (una factura de invierno
   * proyectada anualmente sobre-estima el consumo real ~5×).
   */
  annualKwhOverride?: number,
): GasResult | null {
  const product = productsByTariff[form.tariff]?.find(p => p.name === form.producto);
  if (!product) return null;

  const kwhTotal = ocr.consumo?.kwh_total ?? 0;
  const dias     = ocr.periodo_facturacion?.numero_dias ?? 30;
  const ihTasa   = ocr.ih?.tasa ?? IH_TASA_DEFAULT;
  const ivaPct   = (ocr.iva?.porcentaje ?? IVA_DEFAULT * 100) / 100;

  // ── Precios (base + fee). feeEnergia llega en €/MWh, convertimos a €/kWh con /1000.
  const precioEnergiaOferta = round(product.precioEnergia + form.feeEnergia / 1000, 6);
  const precioFijoOferta    = round(product.precioFijoDia + form.feeFijo, 6);

  // Precios actuales derivados del OCR (mismo criterio que buildReportPayload del service).
  const precioEnergiaActual = kwhTotal > 0 && ocr.consumo?.importe_total
    ? ocr.consumo.importe_total / kwhTotal
    : (ocr.consumo?.lineas?.[0]?.precio_kwh ?? product.precioEnergia);

  const diasFijoActual = ocr.disponibilidad?.dias_total ?? dias;
  const precioFijoActual = diasFijoActual > 0 && ocr.disponibilidad?.importe_total
    ? ocr.disponibilidad.importe_total / diasFijoActual
    : (ocr.disponibilidad?.lineas?.[0]?.precio_dia ?? product.precioFijoDia);

  // ── Costes comunes (idénticos en factura actual y en factura Apolo) ──────
  const alquilerEquipo    = ocr.equipos?.importe             ?? 0;
  const bonoSocialTermico = ocr.bono_social_termico?.importe ?? 0;
  const servicios         = ocr.servicios?.base_imponible    ?? 0;
  const otrosServicios    = (ocr.otros_servicios ?? []).reduce((s, o) => s + (o.importe ?? 0), 0);
  const regulatorio       = (ocr.regulatorio?.peajes_canones ?? 0)
                          + (ocr.regulatorio?.cargos         ?? 0)
                          + (ocr.regulatorio?.tasa_cnmc      ?? 0)
                          + (ocr.regulatorio?.cuota_gts      ?? 0);
  const costesComunes = alquilerEquipo + bonoSocialTermico + servicios + otrosServicios + regulatorio;

  // Descuentos: solo aplican a la factura actual (Apolo no los replica).
  const descuentos = (ocr.descuentos ?? []).reduce((s, d) => s + (d.importe ?? 0), 0);

  // IH: si el OCR lo trae, se respeta en la actual; en la oferta se recalcula con la tasa detectada.
  const ihImporteActual = ocr.ih?.importe ?? (kwhTotal * ihTasa);
  const ihImporteOferta = kwhTotal * ihTasa;

  // ── Factura OFERTA (Apolo) ──────────────────────────────────────────────
  const costeEnergiaOferta = kwhTotal * precioEnergiaOferta;
  const costeFijoOferta    = dias * precioFijoOferta;
  const baseIvaOferta      = costeEnergiaOferta + costeFijoOferta + ihImporteOferta + costesComunes;
  const ivaImporteOferta   = baseIvaOferta * ivaPct;
  const totalOferta        = round(baseIvaOferta + ivaImporteOferta, 2);

  // ── Factura ACTUAL (reconstruida con misma estructura) ──────────────────
  const costeEnergiaActual = kwhTotal * precioEnergiaActual;
  const costeFijoActual    = dias * precioFijoActual;
  const baseIvaActual      = costeEnergiaActual + costeFijoActual + ihImporteActual + costesComunes - descuentos;
  const ivaImporteActual   = baseIvaActual * ivaPct;
  const totalActual        = round(baseIvaActual + ivaImporteActual, 2);

  // ── Ahorros ─────────────────────────────────────────────────────────────
  const ahorroEstudio   = round(totalActual - totalOferta, 2);
  // Consumo anual: SIPS si viene, sino fallback a proyección desde la factura.
  const consumoAnualKwh = annualKwhOverride && annualKwhOverride > 0
    ? annualKwhOverride
    : (dias > 0 ? kwhTotal * (365 / dias) : kwhTotal);
  const ahorroXAnio     = dias > 0 ? round(ahorroEstudio * (365 / dias), 2) : ahorroEstudio;
  const ahorroPorcent   = totalActual > 0
    ? round((ahorroEstudio / totalActual) * 100, 2)
    : 0;

  // ── Comisión (misma fórmula que luz, sin ramas custom por producto) ─────
  // - Snap → valor fijo (mapa SNAP_GAS, hoy vacío).
  // - Cualquier otro → (feeEnergia × pct × consumoAnual) / 1000.
  //   Si el producto tiene feeLocked=true, feeEnergia=0 y la comisión queda en 0.
  //   Igual comportamiento que luz.
  const comisionPct = form.comisionEnergia || 0;
  const comision = SNAP_GAS_PRODUCTS.has(product.name)
    ? comisionPct
    : round((form.feeEnergia * comisionPct * consumoAnualKwh) / 1000, 2);

  return {
    comision,
    ahorroEstudio,
    ahorroXAnio,
    ahorro_porcent: ahorroPorcent,
    precioEnergiaOferta,
    precioFijoOferta,
    totalActual,
    totalOferta,
    baseIvaOferta:    round(baseIvaOferta, 2),
    ivaImporteOferta: round(ivaImporteOferta, 2),
    dias,
    kwhTotal,
    consumoAnualKwh:  round(consumoAnualKwh, 2),
  };
}

/**
 * Espejo de ComparatorService.getComisionBase para gas.
 * Devuelve la comisión "base" (fracción para no-snap, valor fijo para snap) que
 * consume el helper de cálculo. Si no llega commissionPct, cae a 0.
 */
export function getComisionBaseGas(
  producto: string,
  _tariff: string,
  _productsByTariff: GasProductsByTariff,
  commissionPct: number | undefined,
): number {
  if (SNAP_GAS_PRODUCTS.has(producto)) return SNAP_GAS[producto] ?? 0;
  return commissionPct ? commissionPct / 100 : 0;
}

// Productos por defecto mientras no haya admin para gestionarlos. Precios placeholder
// realistas para que la calculadora produzca números coherentes. Editar aquí (o crear
// admin de productos de gas) cuando se quiera ajustar.
export const DEFAULT_GAS_PRODUCTS: GasProductsByTariff = {
  'R1': [
    { name: 'Fijo Gas Mini',  type: 'Fixed',   precioEnergia: 0.0650, precioFijoDia: 0.1500, feeLocked: true  },
    { name: 'Fijo Gas',       type: 'Fixed',   precioEnergia: 0.0625, precioFijoDia: 0.1500, feeLocked: true  },
    { name: 'Fijo Gas Maxi',  type: 'Fixed',   precioEnergia: 0.0600, precioFijoDia: 0.1500, feeLocked: true  },
    { name: 'Indexado',       type: 'Indexed', precioEnergia: 0.0550, precioFijoDia: 0.1500, feeLocked: false },
  ],
  'R2': [
    { name: 'Fijo Gas Mini',  type: 'Fixed',   precioEnergia: 0.0625, precioFijoDia: 0.2500, feeLocked: true  },
    { name: 'Fijo Gas',       type: 'Fixed',   precioEnergia: 0.0600, precioFijoDia: 0.2500, feeLocked: true  },
    { name: 'Fijo Gas Maxi',  type: 'Fixed',   precioEnergia: 0.0575, precioFijoDia: 0.2500, feeLocked: true  },
    { name: 'Indexado',       type: 'Indexed', precioEnergia: 0.0525, precioFijoDia: 0.2500, feeLocked: false },
  ],
  'R3': [
    { name: 'Fijo Gas Pyme',  type: 'Fixed',   precioEnergia: 0.0600, precioFijoDia: 0.6500, feeLocked: false },
    { name: 'Indexado',       type: 'Indexed', precioEnergia: 0.0500, precioFijoDia: 0.6500, feeLocked: false },
  ],
  'R4': [
    { name: 'Fijo Gas Empresa', type: 'Fixed',   precioEnergia: 0.0580, precioFijoDia: 1.4500, feeLocked: false },
    { name: 'Indexado',         type: 'Indexed', precioEnergia: 0.0480, precioFijoDia: 1.4500, feeLocked: false },
  ],
  'R5': [
    { name: 'Fijo Gas Industria', type: 'Fixed',   precioEnergia: 0.0560, precioFijoDia: 2.5000, feeLocked: false },
    { name: 'Indexado',           type: 'Indexed', precioEnergia: 0.0460, precioFijoDia: 2.5000, feeLocked: false },
  ],
  'R6': [
    { name: 'Fijo Gas Industria', type: 'Fixed',   precioEnergia: 0.0540, precioFijoDia: 3.8000, feeLocked: false },
    { name: 'Indexado',           type: 'Indexed', precioEnergia: 0.0440, precioFijoDia: 3.8000, feeLocked: false },
  ],
};

// Normaliza la tarifa detectada (R1, RL1, RL01) al formato Rn que usan los productos.
export function normalizeGasTariff(raw?: string): string {
  if (!raw) return '';
  const upper = raw.trim().toUpperCase();
  const match = upper.match(/^R[L]?(\d+)$/);
  if (!match) return upper;
  const n = parseInt(match[1], 10);
  return `R${n}`;
}
