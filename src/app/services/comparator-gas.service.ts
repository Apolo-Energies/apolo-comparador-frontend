import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  GasOcrResult,
  GasResult,
  GasUploadResponse,
} from '../features/dashboard/pages/comparator-gas/comparator-gas.models';

/** Componentes de gas_regulatory_params activos — expuestos para el desglose del modal. */
export interface GasRegulatoryBreakdown {
  fneeEurPerMwh:           number;
  storageEurPerMwh:        number;
  deviationEurPerMwh:      number;
  managementCostEurPerMwh: number;
  lossesPercentage:        number;
  financialCostPercentage: number;
  tasaMunicipal:           number;
}

/** Precio Apolo calculado por el backend (POST /gas/comparison) + info del bracket
 *  y componentes de la fórmula, para poder desglosar en el modal. */
export interface ApoloGasPricing {
  productName:         string;
  /** Precio final al cliente €/kWh (viene ya con TM/PE/CFIN aplicados). */
  precioEnergiaEurKwh: number;
  /** Precio final al cliente €/día (BOE × (1 + margen_bracket)). */
  precioFijoDiaEur:    number;
  /** Peaje BOE puro €/día — base del desglose fijo. */
  precioFijoBoeDia:    number;
  mibgasEurPerMwh:     number;
  mibgasDate:          string;
  bracketCode:         string;
  bracketMinKwh:       number;
  /** null = tramo sin horquilla superior (RL industrial más grande). */
  bracketMaxKwh:       number | null;
  bracketAtrVariable:  number;
  commercialMarginPct: number;
  regulatory:          GasRegulatoryBreakdown;
  /** Margen sobre variable del producto Apolo. 0 en "Apolo Gas Indexado" por diseño. */
  marginProductEurPerMwh: number;
}

/** Response shape del backend GET /gas/comparison (subset — sólo lo que usamos). */
interface GasComparisonBackendResponse {
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
interface GenerateGasReportPayload {
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

@Injectable({ providedIn: 'root' })
export class ComparatorGasService {
  private readonly http = inject(HttpClient);

  /**
   * POST /gas/comparison — pricing Apolo real según la fórmula regulatoria oficial.
   * Devuelve null si el request falla o no hay producto Apolo activo; el caller
   * debe mostrar error (no hay fallback estático a propósito, ver comparator-gas.ts).
   * `mibgasOverride` pisa temporalmente el spot del backend para simular escenarios.
   */
  getApoloPricing(annualKwh: number, mibgasOverride?: number | null): Observable<ApoloGasPricing | null> {
    if (!annualKwh || annualKwh <= 0) {
      return new Observable<ApoloGasPricing | null>(s => { s.next(null); s.complete(); });
    }
    const body: Record<string, unknown> = { annualConsumptionKwh: annualKwh };
    if (mibgasOverride !== null && mibgasOverride !== undefined && mibgasOverride > 0) {
      body['mibgasOverrideEurPerMwh'] = mibgasOverride;
    }
    return new Observable<ApoloGasPricing | null>(subscriber => {
      this.http.post<GasComparisonBackendResponse>(
        `${environment.apiUrl}/gas/comparison`,
        body,
      ).subscribe({
        next: (res) => {
          const house = res.results.find(r => r.isHouseProvider);
          if (!house) { subscriber.next(null); subscriber.complete(); return; }
          subscriber.next({
            productName:            house.productName,
            precioEnergiaEurKwh:    house.variableEurPerMwh / 1000,
            precioFijoDiaEur:       house.fixedTermPerYearEur / 365,   // con margen aplicado
            precioFijoBoeDia:       res.bracket.fixedTermPerYearEur / 365,  // BOE puro
            mibgasEurPerMwh:        res.mibgasEurPerMwh,
            mibgasDate:             res.mibgasDate,
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
          });
          subscriber.complete();
        },
        error: () => { subscriber.next(null); subscriber.complete(); },
      });
    });
  }

  uploadGas(file: File, userId?: string): Observable<GasUploadResponse> {
    const form = new FormData();
    form.append('File', file, file.name);
    form.append('Name', file.name.replace(/\.pdf$/i, ''));
    form.append('Type', 'PDF');
    if (userId) form.append('UserId', userId);

    return this.http.post<GasUploadResponse>(
      `${environment.apiUrl}/files/upload-and-process-gas`,
      form,
    );
  }

  downloadPdf(payload: GenerateGasReportPayload): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/reports/gas/pdf`, payload, { responseType: 'blob' });
  }

  downloadExcel(payload: GenerateGasReportPayload): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/reports/gas/excel`, payload, { responseType: 'blob' });
  }

  /**
   * Construye el payload del reporte (mismo shape que el DTO C# GenerateGasPdfDto).
   * Toma los números calculados por el frontend para que coincidan con lo que ve el usuario.
   */
  buildReportPayload(
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

  /** Descarga PDF o Excel y dispara el guardado en el navegador. */
  download(
    type:   'pdf' | 'excel',
    result: GasResult | null,
    ocr:    GasOcrResult | null,
    fileId: string,
  ): void {
    if (!result || !ocr) return;
    const payload = this.buildReportPayload(result, ocr, fileId);
    const obs = type === 'pdf' ? this.downloadPdf(payload) : this.downloadExcel(payload);
    const filename = type === 'pdf' ? 'comparativa-gas.pdf' : 'comparativa-gas.xlsx';
    obs.subscribe(blob => this.triggerBlobDownload(blob, filename));
  }

  private triggerBlobDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
