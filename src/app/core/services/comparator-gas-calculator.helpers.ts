import type { ApoloGasPricing } from './comparator-gas.service';
import { GasOcrResult, GasResult } from '../models/comparator-gas.model';

/** Response shape del backend GET /gas/comparison (subset — sólo lo que usamos). */
export interface GasComparisonBackendResponse {
  bracket: {
    code: string;
    minAnnualKwh: number;
    maxAnnualKwh: number | null;
    fixedTermPerYearEur: number;           // BOE puro sin margen
    atrVariableEurPerMwh: number;
    commercialMarginPercentage: number;
  };
  mibgasEurPerMwh: number;
  mibgasDate: string;
  mibgasSource: string;
  regulatory: {
    fneeEurPerMwh: number;
    storageEurPerMwh: number;
    deviationEurPerMwh: number;
    managementCostEurPerMwh: number;
    lossesPercentage: number;
    financialCostPercentage: number;
    tasaMunicipal: number;
  };
  results: Array<{
    productId: number;
    providerName: string;
    productName: string;
    isHouseProvider: boolean;
    variableEurPerMwh: number;
    fixedTermPerYearEur: number;
    annualCostEur: number;
    marginEurPerMwh: number;
  }>;
}

/** Payload mirror del backend GenerateGasPdfDto. */
export interface GenerateGasReportPayload {
  fileId:  string;
  cups:    string;
  datos: {
    titulo:            string;
    tarifa:            string;
    modalidad:         string;
    periodo:           string;
    diasFactura:       number;
    ahorro:            number;
    ahorroPorcentaje:  number;
    ahorroAnual:       number;
    consumoAnualKwh:   number;
    feeEnergia:        number;
    feeFijo:           number;
  };
  cliente: {
    nombreCliente: string;
    cif:           string;
    direccion:     string;
    cp:            string;
    provincia:     string;
  };
  consumo: {
    kwhTotal:       number;
    dias:           number;
    alquilerEquipo: number | null;
    ihTasa:         number | null;
  };
  precios: {
    precioEnergiaActual: number;
    precioEnergiaOferta: number;
    precioFijoActual:    number;
    precioFijoOferta:    number;
  };
  totales: {
    baseActual:     number | null;
    baseOferta:     number | null;
    ivaActual:      number | null;
    ivaOferta:      number | null;
    ivaPorcentaje:  number;
    totalActual:    number | null;
    totalOferta:    number | null;
  };
}

/**
 * Normaliza la fecha de factura del OCR a formato ISO `YYYY-MM-DD` que espera el
 * backend (`DateOnly?`). Acepta ISO (con o sin timezone) o formato español
 * `d/M/yyyy` con separadores `/`, `-` o `.`. Tolera día/mes sin cero delante
 * (Matil a veces devuelve "1/2/2026"). Devuelve undefined si no reconoce el
 * formato — en ese caso el backend cae a su prioridad anterior.
 */
export function normalizeInvoiceDate(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const es = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (es) {
    const day = es[1].padStart(2, '0');
    const month = es[2].padStart(2, '0');
    return `${es[3]}-${month}-${day}`;
  }
  return undefined;
}

/**
 * Mapea la respuesta cruda del backend (POST /gas/comparison) al pricing Apolo
 * del producto "house" (nuestro producto activo). Devuelve null si la respuesta
 * no trae ningún producto house — el caller debe mostrar error.
 */
export function mapBackendResponseToPricing(res: GasComparisonBackendResponse): ApoloGasPricing | null {
  const house = res.results.find(r => r.isHouseProvider);
  if (!house) return null;
  return {
    productName:            house.productName,
    precioEnergiaEurKwh:    house.variableEurPerMwh / 1000,
    precioFijoDiaEur:       house.fixedTermPerYearEur / 365,   // con margen aplicado
    precioFijoBoeDia:       res.bracket.fixedTermPerYearEur / 365,  // BOE puro
    mibgasEurPerMwh:        res.mibgasEurPerMwh,
    mibgasDate:             res.mibgasDate,
    mibgasSource:           res.mibgasSource,
    bracketCode:            res.bracket.code,
    bracketMinKwh:          res.bracket.minAnnualKwh,
    bracketMaxKwh:          res.bracket.maxAnnualKwh,
    bracketAtrVariable:     res.bracket.atrVariableEurPerMwh,
    commercialMarginPct:    res.bracket.commercialMarginPercentage,
    regulatory: {
      fneeEurPerMwh:            res.regulatory.fneeEurPerMwh,
      storageEurPerMwh:         res.regulatory.storageEurPerMwh,
      deviationEurPerMwh:       res.regulatory.deviationEurPerMwh,
      managementCostEurPerMwh:  res.regulatory.managementCostEurPerMwh,
      lossesPercentage:         res.regulatory.lossesPercentage,
      financialCostPercentage:  res.regulatory.financialCostPercentage,
      tasaMunicipal:            res.regulatory.tasaMunicipal,
    },
    marginProductEurPerMwh: house.marginEurPerMwh,
  };
}

/**
 * Construye el payload del reporte (mismo shape que el DTO C# GenerateGasPdfDto).
 * Toma los números calculados por el frontend para que coincidan con lo que ve el usuario.
 */
export function buildGasReportPayload(
  result: GasResult,
  ocr:    GasOcrResult,
  fileId: string,
): GenerateGasReportPayload {
  const cliente = ocr.cliente;
  const direccion = [
    cliente?.direccion?.tipo_via,
    cliente?.direccion?.nombre_via,
    cliente?.direccion?.numero,
    cliente?.direccion?.detalles,
  ].filter(Boolean).join(' ');

  // Prefiere el consumo anual efectivo (SIPS o proyección) que el helper calculó.
  const consumoAnualKwh = result.consumoAnualKwh > 0
    ? Math.round(result.consumoAnualKwh)
    : (result.dias > 0 ? Math.round(result.kwhTotal * (365 / result.dias)) : result.kwhTotal);

  const ivaPct = (ocr.iva?.porcentaje ?? 21) / 100;
  const precioEnergiaActual = result.kwhTotal > 0 && ocr.consumo?.importe_total
    ? ocr.consumo.importe_total / result.kwhTotal
    : (ocr.consumo?.lineas?.[0]?.precio_kwh ?? 0);
  const precioFijoActual = result.dias > 0 && ocr.disponibilidad?.importe_total
    ? ocr.disponibilidad.importe_total / result.dias
    : (ocr.disponibilidad?.lineas?.[0]?.precio_dia ?? 0);

  return {
    fileId,
    cups: cliente?.cups ?? '',
    datos: {
      titulo:           'Comparativa de gas',
      tarifa:           ocr.contrato?.tarifa ?? '',
      modalidad:        'Apolo Gas',
      periodo:          ocr.periodo_facturacion?.fecha_fin ?? '',
      diasFactura:      result.dias,
      ahorro:           result.ahorroEstudio,
      ahorroPorcentaje: result.ahorro_porcent,
      ahorroAnual:      result.ahorroXAnio,
      consumoAnualKwh,
      feeEnergia:       0,
      feeFijo:          0,
    },
    cliente: {
      nombreCliente: cliente?.titular ?? '',
      cif:           cliente?.nif ?? '',
      direccion,
      cp:            cliente?.direccion?.cp        ?? '',
      provincia:     cliente?.direccion?.provincia ?? '',
    },
    consumo: {
      kwhTotal:       result.kwhTotal,
      dias:           result.dias,
      alquilerEquipo: ocr.equipos?.importe ?? null,
      ihTasa:         ocr.ih?.tasa ?? null,
    },
    precios: {
      precioEnergiaActual,
      precioEnergiaOferta: result.precioEnergiaOferta,
      precioFijoActual,
      precioFijoOferta:    result.precioFijoOferta,
    },
    totales: {
      baseActual:     null,
      baseOferta:     result.baseIvaOferta,
      ivaActual:      null,
      ivaOferta:      result.ivaImporteOferta,
      ivaPorcentaje:  ivaPct,
      totalActual:    result.totalActual,
      totalOferta:    result.totalOferta,
    },
  };
}
