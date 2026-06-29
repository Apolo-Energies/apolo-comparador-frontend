import { ComparadorFormValue, ComparadorPeriodo, ComparadorResult, OcrResult } from '../features/dashboard/pages/comparator/comparator.models';
import { Tariff } from '../entities/provider.model';
import { PERIOD_NUMBERS, PeriodNumber, numberToPeriod } from '../shared/constants/period';

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Spanish electricity tax rates (legal/regulatory — update here if they ever change)
const IE_RATE  = 0.00511269632; // Impuesto Eléctrico 0.5 % (vigente España)
const IVA_RATE = 0.21;         // IVA 21 %

const SNAP_PRODUCTS_SET = new Set(['Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi']);

const calculateComision = (form: ComparadorFormValue, ocr: OcrResult): number => {
  if (!ocr.energia || !ocr.potencia) return 0;

  const { producto, feeEnergia, feePotencia, comisionEnergia } = form;
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
  const consumoAnual       = consumoPeriodo * (365 / diasFactura);
  const energia            = (feeEnergia * comisionEnergia * consumoAnual) / 1000;
  const potencia           = feePotencia * coeficientePotencia * potenciaContratada;
  return round3(energia + potencia);
};


const getTariff = (tariffs: Tariff[], code: string) =>
  tariffs.find(t => t.code === code);

const getBaseValue = (tariffs: Tariff[], tarifa: string, producto: string, periodo: PeriodNumber): number => {
  const t    = getTariff(tariffs, tarifa);
  const prod = t?.products.find(p => p.name === producto);
  const periodoStr = numberToPeriod(periodo);
  return prod?.periods.find(p => p.period === periodoStr)?.value ?? 0;
};

const getProductType = (tariffs: Tariff[], tarifa: string, producto: string): 'Fixed' | 'Indexed' => {
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

const calcularPrecios = (
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

const calcularPotencia = (
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

export const calcularFactura = (
  form: ComparadorFormValue,
  ocr: OcrResult,
  tariffs: Tariff[]
): ComparadorResult => {
  const PS = PERIOD_NUMBERS;

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

  const totalEnergia           = round6(periodos.reduce((a, p) => a + p.costeEnergia, 0));
  const totalPotencia          = round6(periodos.reduce((a, p) => a + p.costePotencia, 0));

  const energiaReactiva = ocr.totales_electricidad?.energia?.reactiva ?? 0;
  const excesoPotencia  = ocr.totales_electricidad?.potencia?.exceso  ?? 0;

  // Clasifica cada concepto OCR según su flag en_base_ie
  const bonoSocialImporte = ocr.bono_social?.importe ?? 0;
  const bonoSocialEnIE    = ocr.bono_social?.en_base_ie ?? false;
  const alquilerImporte   = ocr.equipos?.importe ?? 0;
  const alquilerEnIE      = ocr.equipos?.en_base_ie ?? false;
  const otrosConIE        = (ocr.otros_servicios ?? []).filter(o =>  o.en_base_ie).reduce((s, o) => s + (o.importe ?? 0), 0);
  const otrosSinIE        = (ocr.otros_servicios ?? []).filter(o => !o.en_base_ie).reduce((s, o) => s + (o.importe ?? 0), 0);

  // Descuentos clasificados por en_base_ie
  const descuentosConIE  = (ocr.descuentos ?? []).filter(d =>  d.en_base_ie).reduce((t, d) => t + (d.importe ?? 0), 0);
  const descuentosSinIE  = (ocr.descuentos ?? []).filter(d => !d.en_base_ie).reduce((t, d) => t + (d.importe ?? 0), 0);

  // ── Factura OFERTA ────────────────────────────────────────────────────────
  const costesComunesConIE = energiaReactiva + excesoPotencia
    + (bonoSocialEnIE ? bonoSocialImporte : 0)
    + (alquilerEnIE   ? alquilerImporte   : 0)
    + otrosConIE;

  const baseIE            = totalEnergia + totalPotencia + costesComunesConIE;
  const impuestoElectrico = round6(baseIE * IE_RATE);

  const extraSinIE    = (bonoSocialEnIE ? 0 : bonoSocialImporte) + otrosSinIE;
  const alquilerSinIE = alquilerEnIE ? 0 : alquilerImporte;

  const subTotal = baseIE + impuestoElectrico + extraSinIE + alquilerSinIE;
  const iva      = subTotal * IVA_RATE;
  const total    = round6(subTotal + iva);

  // ── Factura ACTUAL (reconstruida con misma estructura) ────────────────────
  const totalEnergiaActual  = ocr.totales_electricidad?.energia?.activa      ?? 0;
  const totalPotenciaActual = ocr.totales_electricidad?.potencia?.contratada ?? 0;
  const otrosNoComunesActual = descuentosConIE + descuentosSinIE;

  const costesComunesConIEActual = energiaReactiva + excesoPotencia
    + (bonoSocialEnIE ? bonoSocialImporte : 0)
    + (alquilerEnIE   ? alquilerImporte   : 0)
    + otrosConIE;

  const baseIEActual   = totalEnergiaActual + totalPotenciaActual + costesComunesConIEActual + descuentosConIE;
  const ieActual       = round6(baseIEActual * IE_RATE);
  const subTotalActual = baseIEActual + ieActual + extraSinIE + alquilerSinIE;
  const ivaActual      = subTotalActual * IVA_RATE;
  const totalActual    = round6(subTotalActual + ivaActual);

  const ahorroEstudio  = round3(totalActual - total);
  const ahorro_porcent = parseFloat(((ahorroEstudio / (totalActual || 1)) * 100).toFixed(2));

  // kwhTotal: sum directly from OCR (avoids nested find; same result as periodos sum)
  const kwhTotal       = round6((ocr.energia ?? []).reduce((s, e) => s + (e.activa?.kwh ?? 0), 0));
  const diasFacturados = dias || 1;
  const consumoAnual   = kwhTotal * (365 / diasFacturados);

  const deltaEnergia  = (kwhTotal > 0)
    ? ((totalEnergiaActual  - totalEnergia)  / kwhTotal) * consumoAnual
    : 0;
  const deltaPotencia = (totalPotenciaActual - totalPotencia)  / diasFacturados * 365;
  const deltaOtros    = otrosNoComunesActual / diasFacturados * 365;

  const ahorroAnio = (deltaEnergia + deltaPotencia + deltaOtros) * (1 + IE_RATE + IVA_RATE);

  return {
    comision:       calculateComision(form, ocr),
    ahorroEstudio,
    ahorro_porcent,
    ahorroXAnio:    Number(ahorroAnio.toFixed(2)),
    periodos,
    dias,

    totalActual,
    baseIEActual,
    ieActual,
    extraSinIE,
    costesComunesConIEActual,
    otrosNoComunesActual,
    subTotalActual,
    ivaActual,

    totalOferta:   total,
    baseIEOferta:  baseIE,
    ieOferta:      impuestoElectrico,
    subTotalOferta: subTotal,
    ivaOferta:     iva,
  };
};
