import { Tariff } from '../models/provider.model';
import { PeriodNumber, numberToPeriod } from '../../shared/constants/period';
import { round6 } from './calculator-rounding.helpers';

const getTariff = (tariffs: Tariff[], code: string) =>
  tariffs.find(t => t.code === code);

const getBaseValue = (tariffs: Tariff[], tarifa: string, producto: string, periodo: PeriodNumber): number => {
  const t    = getTariff(tariffs, tarifa);
  const prod = t?.products.find(p => p.name === producto);
  const periodoStr = numberToPeriod(periodo);
  return prod?.periods.find(p => p.period === periodoStr)?.value ?? 0;
};

export const getProductType = (tariffs: Tariff[], tarifa: string, producto: string): 'Fixed' | 'Indexed' => {
  const t    = getTariff(tariffs, tarifa);
  const prod = t?.products.find(p => p.name === producto);
  return prod?.type ?? 'Fixed';
};

const getRepartoOmie = (tariffs: Tariff[], tarifa: string, periodo: PeriodNumber): number => {
  const t       = getTariff(tariffs, tarifa);
  const periodoStr = numberToPeriod(periodo);
  const reparto = t?.omieDistributions.find(r => r.periods.some(p => p.period === periodoStr));
  return reparto?.periods.find(p => p.period === periodoStr)?.factor ?? 0;
};

const getPotenciaBOE = (tariffs: Tariff[], tarifa: string, periodo: PeriodNumber): number => {
  const t       = getTariff(tariffs, tarifa);
  const periodoStr = numberToPeriod(periodo);
  const boe     = t?.boePowers.find(r => r.periods.some(p => p.period === periodoStr));
  return boe?.periods.find(p => p.period === periodoStr)?.value ?? 0;
};

// Si el producto trae powerPeriods configurados (ej. 'Asociados' en Coexpal), se usan en lugar
// del BOE de la tarifa. Devuelve null si el producto no define powerPeriods.
const getPotenciaProducto = (
  tariffs: Tariff[], tarifa: string, producto: string, periodo: PeriodNumber,
): number | null => {
  const t    = getTariff(tariffs, tarifa);
  const prod = t?.products.find(p => p.name === producto);
  if (!prod?.powerPeriods?.length) return null;
  const periodoStr = numberToPeriod(periodo);
  return prod.powerPeriods.find(p => p.period === periodoStr)?.value ?? null;
};

const getAtrMultiplier = (tarifa: string): number =>
  tarifa.startsWith('6.') ? 1.07 : 1.15;

export const calcularPrecios = (
  tariffs: Tariff[],
  tarifa: string,
  modalidad: string,
  periodo: PeriodNumber,
  precioMedioOmie: number,
  feeEnergia: number
): { base: number; oferta: number } => {
  // Legacy mapping: Index Coste / Index Promo share the base prices stored under "Index Base".
  // New custom products use their own stored prices.
  const modalidadBase = (modalidad === 'Index Coste' || modalidad === 'Index Promo')
    ? 'Index Base'
    : modalidad;

  const valorTarifa = getBaseValue(tariffs, tarifa, modalidadBase, periodo);
  const repartoOmie = getRepartoOmie(tariffs, tarifa, periodo);
  const productType = getProductType(tariffs, tarifa, modalidad);
  const atrMultiplier = getAtrMultiplier(tarifa);

  // Legacy products keep their historical extra OMIE margin (Index Base + 5, Index Promo + 8).
  // Every other Indexed product uses the plain OMIE formula.
  let omieMargin = 0;
  if (modalidad === 'Index Base')  omieMargin = 5;
  if (modalidad === 'Index Promo') omieMargin = 8;

  const precioBase = productType === 'Indexed'
    ? valorTarifa + ((precioMedioOmie + omieMargin) * repartoOmie * atrMultiplier) / 1000
    : valorTarifa;

  return {
    base:   round6(precioBase),
    oferta: round6(precioBase + feeEnergia / 1000),
  };
};

export const calcularPotencia = (
  tariffs: Tariff[],
  tarifa: string,
  periodo: PeriodNumber,
  feePotencia: number,
  modalidad: string
): { base: number; oferta: number } => {
  // Index Coste / Index Promo share power base prices with Index Base (same as energy)
  const modalidadPotencia = (modalidad === 'Index Coste' || modalidad === 'Index Promo')
    ? 'Index Base'
    : modalidad;
  const potenciaProducto = getPotenciaProducto(tariffs, tarifa, modalidadPotencia, periodo);
  const potenciaBase     = potenciaProducto ?? getPotenciaBOE(tariffs, tarifa, periodo);

  const potenciaOferta = potenciaBase + feePotencia / 365;

  return { base: round6(potenciaBase), oferta: round6(potenciaOferta) };
};
