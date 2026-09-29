import { Tariff } from '../../../../../../core/models/provider.model';
import { calcularFactura } from '../../../../../../core/services/calculator.helpers';
import { TramiteType } from '../../models/person.model';
import { ComparadorFormValue, ComparadorResult, OcrResult } from '../../../../../../core/models/comparator.model';

export interface TramiteOption { value: TramiteType; label: string; }

export interface PriceRow {
  periodo:        number | string;
  energiaBase:    number;
  energiaOferta:  number;
  potenciaOferta: number;
}

export interface CalcFull {
  ref:            ComparadorResult;
  result:         ComparadorResult;
  referenceTotal: number;
}

export const TRAMITE_OPTIONS: TramiteOption[] = [
  { value: 'ALTA_NUEVA',      label: 'Alta nueva'      },
  { value: 'NUEVO_TITULAR',   label: 'Nuevo titular'   },
  { value: 'CAMBIO_TARIFA',   label: 'Cambio tarifa'   },
  { value: 'CAMBIO_POTENCIA', label: 'Cambio potencia' },
];

export const fmt2 = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Finds the product name for the given id within a tariff list. */
export function findSelectedProductName(tariffs: Tariff[], productId: string): string {
  const id = parseInt(productId);
  if (!id) return '';
  for (const t of tariffs) {
    const prod = t.products.find(p => p.id === id);
    if (prod) return prod.name;
  }
  return '';
}

/** Maps a product's price type to the short OCR code used by the store. */
export function findProductPriceType(tariffs: Tariff[], productId: string): 'F' | 'I' | 'M' {
  const prodId = parseInt(productId);
  for (const t of tariffs) {
    const p = t.products.find(prod => prod.id === prodId);
    if (p) return p.type === 'Fixed' ? 'F' : p.type === 'Indexed' ? 'I' : 'M';
  }
  return 'M';
}

/** Commission percentage configured directly on the selected product, if any. */
export function findProductCommissionPercentage(tariffs: Tariff[], code: string, name: string): number | null | undefined {
  const tariff  = tariffs.find(t => t.code === code);
  const product = tariff?.products.find(p => p.name === name);
  return product?.commissionPercentage;
}

/**
 * Commission base (as a fraction, e.g. 0.05) used by the energy/power commission formulas.
 * Priority: product-level percentage > flat per-product override > user's global commission %.
 */
export function computeCommissionBase(
  productCommissionPercentage: number | null | undefined,
  flatCommissionOverride: number | undefined,
  fallbackCommissionPct: number,
): number {
  if (productCommissionPercentage != null) return productCommissionPercentage / 100;
  if (flatCommissionOverride !== undefined) return flatCommissionOverride;
  return (fallbackCommissionPct || 0) / 100;
}

/** Builds the OCR-shaped payload consumed by `calcularFactura` from SIPS-derived arrays. */
export function buildOcrResult(annualKwhByPeriod: number[], contractedKwByPeriod: number[]): OcrResult {
  return {
    total:    0,
    energia:  annualKwhByPeriod.map((kwh) => ({ activa: { kwh } })),
    potencia: contractedKwByPeriod.map((kw) => ({ contratada: { kw } })),
    periodo_facturacion:  { numero_dias: 365 },
    totales_electricidad: { energia: { activa: 0 }, potencia: { contratada: 0 } },
  };
}

export interface CalcFullParams {
  tariffs:              Tariff[];
  code:                 string;
  name:                 string;
  omiePrice:            number;
  feeEnergia:           number;
  feePotencia:          number;
  commBase:             number;
  annualKwhByPeriod:    number[];
  contractedKwByPeriod: number[];
}

/** Runs `calcularFactura` twice (reference vs. offered) to get the full comparison. */
export function computeCalcFull(params: CalcFullParams): CalcFull | null {
  const { tariffs, code, name, omiePrice, feeEnergia, feePotencia, commBase, annualKwhByPeriod, contractedKwByPeriod } = params;
  if (!tariffs.length || !code || !name) return null;

  const ocr = buildOcrResult(annualKwhByPeriod, contractedKwByPeriod);

  const formRef: ComparadorFormValue = {
    tariff: code, producto: name,
    precioMedio: omiePrice, feeEnergia: 0, feePotencia: 0, comisionEnergia: 0,
  };
  const ref = calcularFactura(formRef, ocr, tariffs);

  const formActual: ComparadorFormValue = {
    tariff: code, producto: name,
    precioMedio: omiePrice,
    feeEnergia,
    feePotencia,
    comisionEnergia: commBase,
  };
  const result = calcularFactura(formActual, ocr, tariffs);

  // Annual estimated bill at offered prices (always positive, meaningful to show client)
  const referenceTotal = ref.totalOferta;
  return { ref, result, referenceTotal };
}

export function buildPriceTable(full: CalcFull | null): PriceRow[] {
  if (!full) return [];
  return full.result.periodos.map(p => ({
    periodo:        p.periodo,
    energiaBase:    full.ref.periodos.find(r => r.periodo === p.periodo)?.precioEnergiaOferta ?? 0,
    energiaOferta:  p.precioEnergiaOferta,
    potenciaOferta: p.precioPotenciaOferta,
  }));
}

// ── commission: consumoAnual × (feeEnergia / 1000) × comisionUsuario ──────
export function computeCommissionEnergy(hasFlatOverride: boolean, commBase: number, feeEnergia: number, annualKwh: number): number {
  if (!commBase) return 0;
  if (hasFlatOverride) return commBase; // SNAP: importe fijo
  return parseFloat(((feeEnergia * commBase * annualKwh) / 1000).toFixed(3));
}

// Potencia: feePotencia × 0.55 × potenciaContratada × comisionUsuario
export function computeCommissionPotencia(hasFlatOverride: boolean, commBase: number, feePotencia: number, totalKw: number): number {
  if (hasFlatOverride) return 0;
  return parseFloat((feePotencia * 0.55 * totalKw * commBase).toFixed(3));
}
