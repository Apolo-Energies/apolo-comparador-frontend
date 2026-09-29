import { ComparadorFormValue, ComparadorPeriodo, ComparadorResult, FeeMode, OcrResult } from '../models/comparator.model';
import { Tariff } from '../models/provider.model';
import { PERIOD_NUMBERS } from '../../shared/constants/period';
import { environment } from '../../../environments/environment';
import { round6, round3 } from './calculator-rounding.helpers';
import { calculateComision, resolveAnnualKwh } from './calculator-commission.helpers';
import { calcularPrecios, calcularPotencia, getProductType } from './calculator-tariff.helpers';

// Spanish electricity tax rates (legal/regulatory — update here if they ever change)
const IE_RATE  = 0.0511269632; // Impuesto Eléctrico 5.11 % (vigente España)
const IVA_RATE = 0.21;         // IVA 21 %

// Coste propio de Apolo en productos Fijo (tenant Apolo únicamente) — €/kWh sobre
// el consumo total de la factura ACTUAL. Cambiar aquí si el valor se renegocia.
const FIXED_PRODUCT_SURCHARGE_EUR_KWH = 0.012;

export const calcularFactura = (
  form: ComparadorFormValue,
  ocr: OcrResult,
  tariffs: Tariff[],
  annualKwhOverride?: number,
): ComparadorResult => {
  const PS = PERIOD_NUMBERS;

  // En modo Periods, cada P1..P6 puede tener su propia fee. Si no, se usa la global.
  const feeE = (i: number): number =>
    form.feeMode === FeeMode.Periods && form.feeEnergiaByPeriod?.[i] != null
      ? form.feeEnergiaByPeriod[i]
      : form.feeEnergia;
  const feeP = (i: number): number =>
    form.feeMode === FeeMode.Periods && form.feePotenciaByPeriod?.[i] != null
      ? form.feePotenciaByPeriod[i]
      : form.feePotencia;

  const energiaPrecios  = PS.map((p, i) => calcularPrecios(tariffs, form.tariff, form.producto, p, form.precioMedio, feeE(i)));
  const potenciaPrecios = PS.map((p, i) => calcularPotencia(tariffs, form.tariff, p, feeP(i), form.producto));

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

  // Totales de la factura ACTUAL (OCR) — se necesitan ya acá porque el cargo
  // de "otros no comunes" de la oferta (más abajo) se calcula sobre el
  // consumo de la factura actual, no sobre la energía de nuestra tarifa.
  const totalEnergiaActual  = ocr.totales_electricidad?.energia?.activa      ?? 0;
  const totalPotenciaActual = ocr.totales_electricidad?.potencia?.contratada ?? 0;
  // kwhTotal: sum directly from OCR (avoids nested find; same result as periodos sum)
  const kwhTotal            = round6((ocr.energia ?? []).reduce((s, e) => s + (e.activa?.kwh ?? 0), 0));

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

  // Coste propio de la oferta (no viene de la tarifa que armamos, a diferencia de los
  // "otros comunes" de arriba): en el tenant Apolo, los productos Fijo cargan
  // FIXED_PRODUCT_SURCHARGE_EUR_KWH €/kWh sobre el consumo total de la factura
  // ACTUAL (kwhTotal). Para cualquier otro tenant o tipo de producto no aplica.
  const isApolo    = environment.features.userDetail;
  const productType = getProductType(tariffs, form.tariff, form.producto);
  const otrosNoComunesOferta = (isApolo && productType === 'Fixed')
    ? round6(kwhTotal * FIXED_PRODUCT_SURCHARGE_EUR_KWH)
    : 0;

  const subTotal = baseIE + impuestoElectrico + extraSinIE + alquilerSinIE + otrosNoComunesOferta;
  const iva      = subTotal * IVA_RATE;
  const total    = round6(subTotal + iva);

  // ── Factura ACTUAL (reconstruida con misma estructura) ────────────────────
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

  const diasFacturados = dias || 1;
  const consumoAnual   = resolveAnnualKwh(annualKwhOverride, kwhTotal, diasFacturados);

  const deltaEnergia  = (kwhTotal > 0)
    ? ((totalEnergiaActual  - totalEnergia)  / kwhTotal) * consumoAnual
    : 0;
  const deltaPotencia = (totalPotenciaActual - totalPotencia)  / diasFacturados * 365;
  const deltaOtros    = (otrosNoComunesActual - otrosNoComunesOferta) / diasFacturados * 365;

  const ahorroAnio = (deltaEnergia + deltaPotencia + deltaOtros) * (1 + IE_RATE + IVA_RATE);

  return {
    comision:       calculateComision(form, ocr, annualKwhOverride),
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
    otrosNoComunesOferta,
  };
};
