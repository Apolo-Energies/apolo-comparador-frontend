import { ComparadorFormValue, FeeMode, OcrResult } from '../models/comparator.model';
import { FLAT_COMMISSION_PRODUCT_NAMES } from '../../shared/constants/flat-commission-products';
import { round3 } from './calculator-rounding.helpers';

const SNAP_PRODUCTS_SET = new Set(FLAT_COMMISSION_PRODUCT_NAMES);

// Preferir SIPS (histórico real 12 meses) sobre la extrapolación de la factura,
// que sesga por estacionalidad (una factura de invierno puede sobreestimar +50%).
// Ver comparator.ts:loadSipsAnnualKwh y sumAnnualKwh en sips.service.ts.
export const resolveAnnualKwh = (override: number | undefined, kwhTotal: number, dias: number): number =>
  override && override > 0
    ? override
    : (dias > 0 ? kwhTotal * (365 / dias) : kwhTotal);

// Devuelve la fee efectiva a usar en fórmulas escalares (comisión). En modo
// 'periods' hace media ponderada por consumo/potencia para representar de
// forma coherente lo que realmente se cobrará al cliente.
const resolveEffectiveFeeEnergia = (form: ComparadorFormValue, ocr: OcrResult): number => {
  if (form.feeMode !== FeeMode.Periods || !form.feeEnergiaByPeriod?.length) return form.feeEnergia;
  const kwhs = (ocr.energia ?? []).map(e => e.activa?.kwh ?? 0);
  const totalKwh = kwhs.reduce((s, k) => s + k, 0);
  if (totalKwh === 0) return form.feeEnergia;
  const weighted = form.feeEnergiaByPeriod.reduce((s, fee, i) => s + fee * (kwhs[i] ?? 0), 0);
  return weighted / totalKwh;
};

const resolveEffectiveFeePotencia = (form: ComparadorFormValue, ocr: OcrResult): number => {
  if (form.feeMode !== FeeMode.Periods || !form.feePotenciaByPeriod?.length) return form.feePotencia;
  const kws = (ocr.potencia ?? []).map(p => p.contratada?.kw ?? 0);
  const totalKw = kws.reduce((s, k) => s + k, 0);
  if (totalKw === 0) return form.feePotencia;
  const weighted = form.feePotenciaByPeriod.reduce((s, fee, i) => s + fee * (kws[i] ?? 0), 0);
  return weighted / totalKw;
};

export const calculateComision = (
  form: ComparadorFormValue,
  ocr: OcrResult,
  annualKwhOverride?: number,
): number => {
  if (!ocr.energia || !ocr.potencia) return 0;

  const { producto, comisionEnergia } = form;
  const feeEnergia  = resolveEffectiveFeeEnergia(form, ocr);
  const feePotencia = resolveEffectiveFeePotencia(form, ocr);
  const coeficientePotencia = 0.50;

  if (SNAP_PRODUCTS_SET.has(producto)) {
    return comisionEnergia;
  }

  const consumoPeriodo     = ocr.energia.reduce((acc, item) => acc + (item?.activa?.kwh ?? 0), 0);
  const potenciaContratada = ocr.potencia.reduce((acc, item) => acc + (item?.contratada?.kw ?? 0), 0);
  const isPromo            = producto === 'Promo 3M Pro';

  if (isPromo) {
    const consumoEnergia = (consumoPeriodo / 12) * 3;
    const energia        = (feeEnergia / 100) * consumoEnergia * comisionEnergia;
    const potencia       = feePotencia * coeficientePotencia * potenciaContratada;
    return round3(energia + potencia);
  }

  const diasFactura        = ocr.periodo_facturacion?.numero_dias || 1;
  const consumoAnual       = resolveAnnualKwh(annualKwhOverride, consumoPeriodo, diasFactura);
  const energia            = (feeEnergia * comisionEnergia * consumoAnual) / 1000;
  const potencia           = feePotencia * coeficientePotencia * potenciaContratada;
  return round3(energia + potencia);
};
