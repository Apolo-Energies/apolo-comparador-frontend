import { ComparadorFormValue, ComparadorResult, OcrResult } from '../models/comparator.model';
import { ReportPayload } from '../models/comparison-history.model';
import { PERIODS } from '../../shared/constants/period';

/**
 * Construye el payload del PDF (mismo shape que consume el backend en
 * POST /comparison-history/pdf y que se persiste en el snapshot para
 * regenerar el PDF idéntico desde la sección de Oportunidades).
 *
 * Extraído de ComparatorService: pure mapping, sin HttpClient (mismo patrón
 * que buildGasReportPayload en comparator-gas-calculator.helpers.ts). Todos
 * los totales vienen ya calculados por calcularFactura (calculator.helpers.ts) —
 * este helper solo reordena los mismos números en el shape que espera el backend.
 */
export function buildComparatorReportPayload(
  form: ComparadorFormValue,
  result: ComparadorResult,
  ocr: OcrResult,
  fileId: string,
  annualKwhOverride?: number,
): ReportPayload {
  const dias = result.dias ?? ocr.periodo_facturacion?.numero_dias ?? 0;
  const alquilerEquipo = ocr.equipos?.importe ?? 0;

  // All totals come from the calculator (same numbers shown on screen)
  const {
    totalActual, ieActual, ivaActual, subTotalActual,
    extraSinIE, costesComunesConIEActual, otrosNoComunesActual,
    totalOferta, ieOferta, ivaOferta, subTotalOferta, otrosNoComunesOferta,
  } = result;

  const lineas = [
    ...PERIODS.map((label, idx) => {
      const kwh = ocr.energia?.[idx]?.activa?.kwh ?? 0;
      const precioActual = ocr.energia?.[idx]?.activa?.tarifa ?? 0;
      const costeActual  = ocr.energia?.[idx]?.activa?.importe ?? 0;
      const periodo = result.periodos.find(p => Number(p.periodo) === idx + 1);
      return {
        termino:      `ENERGÍA ${label}`,
        unidad:       'kWh',
        valor:        kwh,
        precioActual,
        costeActual,
        precioOferta: periodo?.precioEnergiaOferta ?? 0,
        costeOferta:  periodo?.costeEnergia ?? 0,
      };
    }),
    ...PERIODS.map((label, idx) => {
      const kw = ocr.potencia?.[idx]?.contratada?.kw ?? 0;
      const precioActual = ocr.potencia?.[idx]?.contratada?.tarifa ?? 0;
      const costeActual  = ocr.potencia?.[idx]?.contratada?.importe ?? 0;
      const periodo = result.periodos.find(p => Number(p.periodo) === idx + 1);
      return {
        termino:      `POTENCIA ${label}`,
        unidad:       'kW',
        valor:        kw,
        precioActual,
        costeActual,
        precioOferta: periodo?.precioPotenciaOferta ?? 0,
        costeOferta:  periodo?.costePotencia ?? 0,
      };
    }),
  ];

  const totalKwhFactura = ocr.energia?.reduce((a, e) => a + (e.activa?.kwh ?? 0), 0) ?? 0;
  // Preferir SIPS (histórico real) sobre la extrapolación de la factura, que sesga
  // por estacionalidad. Mismo fallback que calcularFactura → resolveAnnualKwh.
  const consumoAnual = annualKwhOverride && annualKwhOverride > 0
    ? Math.round(annualKwhOverride)
    : (dias > 0 ? Math.round(totalKwhFactura * (365 / dias)) : 0);

  const payload = {
    fileId,
    cups:       ocr.cliente?.cups ?? '',
    providerId: 1,
    datos: {
      titulo:             'Comparativa de oferta',
      tarifa:             form.tariff,
      modalidad:          form.producto,
      periodo:            ocr.periodo_facturacion?.fecha_fin ?? '',
      diasFactura:        dias,
      ahorro:             result.ahorroEstudio,
      ahorroPorcentaje:   result.ahorro_porcent,
      ahorroAnual:        result.ahorroXAnio,
      consumoAnual,
      precioPromedioOmie: form.precioMedio,
      feeEnergia:         form.feeEnergia,
      feePotencia:        form.feePotencia,
    },
    cliente: {
      nombreCliente: ocr.cliente?.titular ?? '',
      razonSocial:   '',
      cif:           ocr.cliente?.nif ?? '',
      direccion: [
        ocr.cliente?.direccion?.tipo_via,
        ocr.cliente?.direccion?.nombre_via,
        ocr.cliente?.direccion?.numero,
        ocr.cliente?.direccion?.detalles,
      ].filter(Boolean).join(' '),
      cp:        ocr.cliente?.direccion?.cp        ?? '',
      provincia: ocr.cliente?.direccion?.provincia ?? '',
    },
    totales: {
      baseActual:              subTotalActual,
      baseOferta:              subTotalOferta,
      impuestoElectricoActual: ieActual,
      impuestoElectricoOferta: ieOferta,
      alquilerEquipo,
      ivaActual,
      ivaOferta,
      totalActual,
      totalOferta,
      otrosNoComunesActual,
      otrosNoComunesOferta,
      otrosComunesSinIeActual: extraSinIE,
      otrosComunesSinIeOferta: extraSinIE,
      otrosComunesConIeActual: costesComunesConIEActual,
      otrosComunesConIeOferta: costesComunesConIEActual,
    },
    lineas,
  };

  return payload;
}
