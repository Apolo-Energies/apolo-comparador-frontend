import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GasOcrResult,
  GasResult,
  GasUploadResponse,
} from '../models/comparator-gas.model';
import {
  GasComparisonBackendResponse,
  GenerateGasReportPayload,
  buildGasReportPayload,
  mapBackendResponseToPricing,
  normalizeInvoiceDate,
} from './comparator-gas-calculator.helpers';

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
  /** Fuente del precio MIBGAS: 'invoice-date' | 'override-request' | 'override-admin' | 'Mibgas'. */
  mibgasSource:        string;
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

@Injectable({ providedIn: 'root' })
export class ComparatorGasService {
  private readonly http = inject(HttpClient);

  /**
   * POST /gas/comparison — pricing Apolo real según la fórmula regulatoria oficial.
   * Devuelve null si el request falla o no hay producto Apolo activo; el caller
   * debe mostrar error (no hay fallback estático a propósito, ver comparator-gas.ts).
   * `mibgasOverride` pisa temporalmente el spot del backend para simular escenarios.
   * `invoiceDate` (ISO YYYY-MM-DD o dd/MM/yyyy) hace que el backend use el MIBGAS
   * histórico de esa fecha en vez del spot actual — comparativa consistente con el
   * momento en que se emitió la factura.
   */
  getApoloPricing(
    annualKwh: number,
    mibgasOverride?: number | null,
    invoiceDate?: string | null,
  ): Observable<ApoloGasPricing | null> {
    if (!annualKwh || annualKwh <= 0) {
      return new Observable<ApoloGasPricing | null>(s => { s.next(null); s.complete(); });
    }
    const body: Record<string, unknown> = { annualConsumptionKwh: annualKwh };
    if (mibgasOverride !== null && mibgasOverride !== undefined && mibgasOverride > 0) {
      body['mibgasOverrideEurPerMwh'] = mibgasOverride;
    }
    const normalizedDate = normalizeInvoiceDate(invoiceDate);
    if (normalizedDate) body['invoiceDate'] = normalizedDate;
    return new Observable<ApoloGasPricing | null>(subscriber => {
      this.http.post<GasComparisonBackendResponse>(
        `${environment.apiUrl}/gas/comparison`,
        body,
      ).subscribe({
        next: (res) => {
          subscriber.next(mapBackendResponseToPricing(res));
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
    return buildGasReportPayload(result, ocr, fileId);
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
