import { ComparadorFormValue, ComparadorPeriodo, ComparadorResult, OcrResult } from '../features/dashboard/pages/comparator/comparator.models';
import { Tariff } from '../entities/provider.model';

type Periodo = 1 | 2 | 3 | 4 | 5 | 6;
type PeriodoString = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

// Convertir número de período a string (1 -> "P1", 2 -> "P2", etc.)
const periodToString = (periodo: Periodo): PeriodoString => `P${periodo}` as PeriodoString;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

const SNAP_PRODUCTS_SET = new Set(['Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi']);

const calculateComision = (form: ComparadorFormValue, ocr: OcrResult): number => {
  if (!ocr.energia || !ocr.potencia) return 0;

  const { producto, feeEnergia, feePotencia, comisionEnergia } = form;
  const coeficientePotencia = 0.55;

  if (SNAP_PRODUCTS_SET.has(producto)) {
    console.log('[calculateComision] SNAP → comision =', comisionEnergia);
    return comisionEnergia;
  }

  const consumoPeriodo     = ocr.energia.reduce((acc, item) => acc + (item?.activa?.kwh ?? 0), 0);
  const potenciaContratada = ocr.potencia.reduce((acc, item) => acc + (item?.contratada?.kw ?? 0), 0);
  const isPromo            = producto === 'Promo 3M Pro';

  if (isPromo) {
    const consumoEnergia = (consumoPeriodo / 12) * 3;
    const energia        = (feeEnergia / 100) * consumoEnergia * comisionEnergia;
    const potencia       = feePotencia * coeficientePotencia * potenciaContratada;
    const result         = round3(energia + potencia);
    console.log('[calculateComision] PROMO', { consumoEnergia, feeEnergia, comisionEnergia, feePotencia, potenciaContratada, result });
    return result;
  }

  const coeficienteEnergia = 10 * consumoPeriodo;
  const energia            = (feeEnergia * comisionEnergia * coeficienteEnergia) / 1000;
  const potencia           = feePotencia * coeficientePotencia * potenciaContratada;
  const result             = round3(energia + potencia);
  console.log('[calculateComision] NORMAL', { feeEnergia, comisionEnergia, coeficienteEnergia, feePotencia, potenciaContratada, result });
  return result;
};

const POTENCIA_FIJA_SNAP: Record<string, number> = {
  'Fijo Snap Mini': 0.0795,
  'Fijo Snap':      0.0895,
  'Fijo Snap Maxi': 0.0995,
};

const getTariff = (tariffs: Tariff[], code: string) =>
  tariffs.find(t => t.code === code);

const getBaseValue = (tariffs: Tariff[], tarifa: string, producto: string, periodo: Periodo): number => {
  const t    = getTariff(tariffs, tarifa);
  const prod = t?.products.find(p => p.name === producto);
  const periodoStr = periodToString(periodo);
  return prod?.periods.find(p => p.period === periodoStr)?.value ?? 0;
};

const getRepartoOmie = (tariffs: Tariff[], tarifa: string, periodo: Periodo): number => {
  const t       = getTariff(tariffs, tarifa);
  const periodoStr = periodToString(periodo);
  const reparto = t?.omieDistributions.find(r => r.periods.some(p => p.period === periodoStr));
  return reparto?.periods.find(p => p.period === periodoStr)?.factor ?? 0;
};

const getPotenciaBOE = (tariffs: Tariff[], tarifa: string, periodo: Periodo): number => {
  const t       = getTariff(tariffs, tarifa);
  const periodoStr = periodToString(periodo);
  const boe     = t?.boePowers.find(r => r.periods.some(p => p.period === periodoStr));
  return boe?.periods.find(p => p.period === periodoStr)?.value ?? 0;
};

const calcularPrecios = (
  tariffs: Tariff[],
  tarifa: string,
  modalidad: string,
  periodo: Periodo,
  precioMedioOmie: number,
  feeEnergia: number
): { base: number; oferta: number } => {
  const modalidadBase = (modalidad === 'Index Coste' || modalidad === 'Index Promo')
    ? 'Index Base'
    : modalidad;

  const valorTarifa = getBaseValue(tariffs, tarifa, modalidadBase, periodo);
  const repartoOmie = getRepartoOmie(tariffs, tarifa, periodo);

  let precioBase = 0;
  if (modalidad.startsWith('Fijo')) {
    precioBase = valorTarifa;
  } else if (modalidad === 'Index Coste' || modalidad === 'Passpool') {
    precioBase = valorTarifa + (precioMedioOmie * repartoOmie * 1.15) / 1000;
  } else if (modalidad === 'Index Base') {
    precioBase = valorTarifa + ((precioMedioOmie + 5) * repartoOmie * 1.15) / 1000;
  } else if (modalidad === 'Index Promo') {
    precioBase = valorTarifa + ((precioMedioOmie + 8) * repartoOmie * 1.15) / 1000;
  } else {
    precioBase = valorTarifa + ((precioMedioOmie + 5) * repartoOmie * 1.15) / 1000;
  }

  return {
    base:   round6(precioBase),
    oferta: round6(precioBase + feeEnergia / 1000),
  };
};

const calcularPotencia = (
  tariffs: Tariff[],
  tarifa: string,
  periodo: Periodo,
  feePotencia: number,
  modalidad: string
): { base: number; oferta: number } => {
  const potenciaBase = getPotenciaBOE(tariffs, tarifa, periodo);

  if (modalidad in POTENCIA_FIJA_SNAP) {
    return { base: round6(potenciaBase), oferta: POTENCIA_FIJA_SNAP[modalidad] };
  }

  const potenciaOferta = modalidad === 'Index Promo'
    ? potenciaBase
    : potenciaBase + feePotencia / 365;

  return { base: round6(potenciaBase), oferta: round6(potenciaOferta) };
};

export const calcularFactura = (
  form: ComparadorFormValue,
  ocr: OcrResult,
  tariffs: Tariff[]
): ComparadorResult => {
  const PS: Periodo[] = [1, 2, 3, 4, 5, 6];

  const energiaPrecios  = PS.map(p => calcularPrecios(tariffs, form.tariff, form.producto, p, form.precioMedio, form.feeEnergia));
  const potenciaPrecios = PS.map(p => calcularPotencia(tariffs, form.tariff, p, form.feePotencia, form.producto));

  const dias = ocr.periodo_facturacion?.numero_dias ?? 0;

  const periodos: ComparadorPeriodo[] = PS.map((periodo, idx) => {
    const kwh = ocr.energia?.[idx]?.activa?.kwh ?? 0;
    const kw  = ocr.potencia?.[idx]?.contratada?.kw ?? 0;

    if (kwh === 0 && kw === 0) return null as unknown as ComparadorPeriodo;

    const precioEnergiaOferta  = energiaPrecios[idx]?.oferta ?? 0;
    const precioPotenciaOferta = potenciaPrecios[idx]?.oferta ?? 0;
    const costeEnergia  = kwh > 0 ? round6(kwh * precioEnergiaOferta) : 0;
    const costePotencia = kw  > 0 ? round6(kw * precioPotenciaOferta * dias) : 0;

    return { periodo, precioEnergiaOferta, precioPotenciaOferta, costeEnergia, costePotencia };
  }).filter(Boolean) as ComparadorPeriodo[];

  const descuentoElectricidad = (ocr.descuentos ?? []).reduce((t, d) => t + (d.importe ?? 0), 0);
  const totalEnergia  = round6(periodos.reduce((a, p) => a + p.costeEnergia, 0));
  const totalPotencia = round6(periodos.reduce((a, p) => a + p.costePotencia, 0));

  const costesComunesConIE =
    (ocr.totales_electricidad?.energia?.reactiva ?? 0) +
    (ocr.totales_electricidad?.potencia?.exceso ?? 0) -
    descuentoElectricidad;

  const impuestoElectrico = round6((totalEnergia + totalPotencia + costesComunesConIE) * 0.0511269632);
  const subTotal   = totalEnergia + totalPotencia + costesComunesConIE + impuestoElectrico;
  const iva        = subTotal * 0.21;
  const total      = round6(subTotal + iva);
  const ahorroEstudio  = round3((ocr.total ?? 0) - total);
  const ahorro_porcent = parseFloat(((ahorroEstudio / (ocr.total ?? 1)) * 100).toFixed(2));

  const kwhTotal  = round6(periodos.reduce((a, p) => a + (ocr.energia?.find(e => e.p === p.periodo)?.activa?.kwh ?? 0), 0));
  const diasFacturados = dias || 1;
  const totalEnergiaActual  = ocr.totales_electricidad?.energia?.activa ?? 0;
  const totalPotenciaActual = ocr.totales_electricidad?.potencia?.contratada ?? 0;

  const ahorroAnio = (
    ((totalEnergiaActual - totalEnergia) / (kwhTotal || 1) * (10 * kwhTotal)) +
    ((totalPotenciaActual - totalPotencia) / diasFacturados * 365)
  ) * (1 + 0.0511269632 + 0.21);

  return {
    comision:       calculateComision(form, ocr),
    ahorroEstudio,
    ahorro_porcent,
    ahorroXAnio:    Number(ahorroAnio.toFixed(2)),
    periodos,
    dias,
  };
};
