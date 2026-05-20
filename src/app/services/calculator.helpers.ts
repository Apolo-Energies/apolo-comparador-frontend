import { ComparadorFormValue, ComparadorPeriodo, ComparadorResult, OcrResult } from '../features/dashboard/pages/comparator/comparator.models';
import { Tariff } from '../entities/provider.model';
import { PERIOD_NUMBERS, PeriodNumber, numberToPeriod } from '../shared/constants/period';

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

// Spanish electricity tax rates (legal/regulatory — update here if they ever change)
const IE_RATE  = 0.0511269632; // Impuesto Eléctrico 5.11269632 %
const IVA_RATE = 0.21;         // IVA 21 %

const SNAP_PRODUCTS_SET = new Set(['Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi']);

const calculateComision = (form: ComparadorFormValue, ocr: OcrResult): number => {
  if (!ocr.energia || !ocr.potencia) return 0;

  const { producto, feeEnergia, feePotencia, comisionEnergia } = form;
  const coeficientePotencia = 0.55;

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

  const coeficienteEnergia = 10 * consumoPeriodo;
  const energia            = (feeEnergia * comisionEnergia * coeficienteEnergia) / 1000;
  const potencia           = feePotencia * coeficientePotencia * potenciaContratada;
  return round3(energia + potencia);
};

const POTENCIA_FIJA_SNAP: Record<string, number> = {
  'Fijo Snap Mini': 0.0795,
  'Fijo Snap':      0.0895,
  'Fijo Snap Maxi': 0.0995,
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

  // Legacy products keep their historical extra OMIE margin (Index Base + 5, Index Promo + 8).
  // Every other Indexed product uses the plain OMIE formula.
  let omieMargin = 0;
  if (modalidad === 'Index Base')  omieMargin = 5;
  if (modalidad === 'Index Promo') omieMargin = 8;

  const precioBase = productType === 'Indexed'
    ? valorTarifa + ((precioMedioOmie + omieMargin) * repartoOmie * 1.15) / 1000
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

  const descuentoElectricidad  = (ocr.descuentos ?? []).reduce((t, d) => t + (d.importe ?? 0), 0);
  const totalEnergia           = round6(periodos.reduce((a, p) => a + p.costeEnergia, 0));
  const totalPotencia          = round6(periodos.reduce((a, p) => a + p.costePotencia, 0));

  const energiaReactiva      = ocr.totales_electricidad?.energia?.reactiva ?? 0;
  const excesoPotencia       = ocr.totales_electricidad?.potencia?.exceso  ?? 0;
  const costesComunesConIE   = energiaReactiva + excesoPotencia - descuentoElectricidad;

  const baseIE             = totalEnergia + totalPotencia + costesComunesConIE;
  const impuestoElectrico  = round6(baseIE * IE_RATE);

  const costosComunesSinIE = ocr.bono_social?.importe ?? 0;
  const alquilerEquipo     = ocr.equipos?.importe     ?? 0;

  const subTotal = baseIE + impuestoElectrico + costosComunesSinIE + alquilerEquipo;
  const iva      = subTotal * IVA_RATE;
  const total    = round6(subTotal + iva);
  const ahorroEstudio  = round3((ocr.total ?? 0) - total);
  const ahorro_porcent = parseFloat(((ahorroEstudio / (ocr.total ?? 1)) * 100).toFixed(2));

  // kwhTotal: sum directly from OCR (avoids nested find; same result as periodos sum)
  const kwhTotal  = round6((ocr.energia ?? []).reduce((s, e) => s + (e.activa?.kwh ?? 0), 0));
  const diasFacturados      = dias || 1;
  const consumoAnual        = kwhTotal * 10;
  const totalEnergiaActual  = ocr.totales_electricidad?.energia?.activa    ?? 0;
  const totalPotenciaActual = ocr.totales_electricidad?.potencia?.contratada ?? 0;
  const otrosNoComunesActual = (ocr.otros_servicios ?? []).reduce((s, o) => s + (o.importe ?? 0), 0);

  const deltaEnergia  = (kwhTotal > 0)
    ? ((totalEnergiaActual  - totalEnergia)  / kwhTotal) * consumoAnual
    : 0;
  const deltaPotencia = (totalPotenciaActual - totalPotencia)  / diasFacturados * 365;
  const deltaOtros    = otrosNoComunesActual / diasFacturados * 365;

  const ahorroAnio = (deltaEnergia + deltaPotencia + deltaOtros) * (1 + IE_RATE + IVA_RATE);

  console.group('%c[Total Factura Actual]', 'color:#6366f1;font-weight:bold');
  console.log('Fuente  : OCR — importe total leído de la factura');
  console.log(`%cValor   : ${ocr.total ?? 0} €`, 'color:#10b981;font-weight:bold');
  console.groupEnd();

  console.group('%c[Total Factura Oferta]', 'color:#6366f1;font-weight:bold');

  console.group('1) Energía por período');
  periodos.forEach(p => {
    const kwh = ocr.energia?.find(e => e.p === p.periodo)?.activa?.kwh ?? 0;
    console.log(`  P${p.periodo} : ${kwh} kWh × ${p.precioEnergiaOferta} €/kWh = ${p.costeEnergia} €`);
  });
  console.log(`%c  → Total energía : ${totalEnergia} €`, 'color:#10b981');
  console.groupEnd();

  console.group('2) Potencia por período');
  periodos.forEach(p => {
    const kw = ocr.potencia?.[(p.periodo as number) - 1]?.contratada?.kw ?? 0;
    console.log(`  P${p.periodo} : ${kw} kW × ${p.precioPotenciaOferta} €/kW/día × ${dias} días = ${p.costePotencia} €`);
  });
  console.log(`%c  → Total potencia : ${totalPotencia} €`, 'color:#10b981');
  console.groupEnd();

  console.group('3) Costes comunes con IE (base IE)');
  console.log(`  Energía reactiva    : ${energiaReactiva} €`);
  console.log(`  Exceso potencia     : ${excesoPotencia} €`);
  console.log(`  Descuentos          : -${descuentoElectricidad} €`);
  console.log(`%c  → Total comunes con IE : ${costesComunesConIE} €`, 'color:#10b981');
  console.groupEnd();

  console.log(`4) Base IE            : ${totalEnergia} + ${totalPotencia} + ${costesComunesConIE} = ${baseIE} €`);
  console.log(`5) IE (${(IE_RATE * 100).toFixed(8)}%)  : ${baseIE} × ${IE_RATE} = ${impuestoElectrico} €`);

  console.log(`6) Costes comunes sin IE (bono social) : ${costosComunesSinIE} €`);
  console.log(`7) Alquiler de equipo                  : ${alquilerEquipo} €`);
  console.log(`8) Otros costes no comunes (oferta)    : 0 €`);

  console.log(`9) Subtotal : ${totalEnergia} + ${totalPotencia} + ${costesComunesConIE} + ${impuestoElectrico} + ${costosComunesSinIE} + ${alquilerEquipo} = ${subTotal} €`);
  console.log(`10) IVA (${IVA_RATE * 100}%)      : ${subTotal} × ${IVA_RATE} = ${iva.toFixed(6)} €`);
  console.log(`%c→ TOTAL OFERTA : ${subTotal} + ${iva.toFixed(6)} = ${total} €`, 'color:#10b981;font-weight:bold');

  console.groupEnd();

  console.group('%c[Ahorro Cliente]', 'color:#3b82f6;font-weight:bold');

  console.group('Ahorro estudio (mes)');
  console.log('Fórmula : total_factura_actual - total_factura_oferta');
  console.log(`        = ${ocr.total ?? 0} - ${total}`);
  console.log(`%cResultado : ${ahorroEstudio} €`, 'color:#10b981;font-weight:bold');
  console.groupEnd();

  console.group('Porcentaje de ahorro');
  console.log('Fórmula : (ahorroEstudio / total_factura_actual) × 100');
  console.log(`        = (${ahorroEstudio} / ${ocr.total ?? 1}) × 100`);
  console.log(`%cResultado : ${ahorro_porcent} %`, 'color:#10b981;font-weight:bold');
  console.groupEnd();

  console.group('Ahorro anual');
  console.log('Fórmula : (Δenergía + Δpotencia + Δotros) × (1 + IE + IVA)');
  console.log(`  consumoAnual  = kwhTotal × 10 = ${kwhTotal} × 10 = ${consumoAnual} kWh`);
  console.log('  Δenergía  = (totalEnergíaActual - totalEnergíaOferta) / kWhTotal × consumoAnual');
  console.log(`            = (${totalEnergiaActual} - ${totalEnergia}) / ${kwhTotal} × ${consumoAnual}`);
  console.log(`            = ${deltaEnergia.toFixed(4)} €`);
  console.log('  Δpotencia = (totalPotenciaActual - totalPotenciaOferta) / diasFacturados × 365');
  console.log(`            = (${totalPotenciaActual} - ${totalPotencia}) / ${diasFacturados} × 365`);
  console.log(`            = ${deltaPotencia.toFixed(4)} €`);
  console.log('  Δotros    = otrosCostesNoComunesActual / diasFacturados × 365');
  console.log(`            = ${otrosNoComunesActual} / ${diasFacturados} × 365`);
  console.log(`            = ${deltaOtros.toFixed(4)} €`);
  console.log(`  Base      : ${deltaEnergia.toFixed(4)} + ${deltaPotencia.toFixed(4)} + ${deltaOtros.toFixed(4)} = ${(deltaEnergia + deltaPotencia + deltaOtros).toFixed(4)} €`);
  console.log(`  Factor    : × (1 + ${IE_RATE} + ${IVA_RATE}) = × ${1 + IE_RATE + IVA_RATE}`);
  console.log(`%cResultado : ${Number(ahorroAnio.toFixed(2))} €/año`, 'color:#10b981;font-weight:bold');
  console.groupEnd();

  console.groupEnd(); // [Ahorro Cliente]

  return {
    comision:       calculateComision(form, ocr),
    ahorroEstudio,
    ahorro_porcent,
    ahorroXAnio:    Number(ahorroAnio.toFixed(2)),
    periodos,
    dias,
  };
};
