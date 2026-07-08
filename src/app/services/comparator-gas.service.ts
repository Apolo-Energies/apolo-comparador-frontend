import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  GasFormValue,
  GasOcrResult,
  GasResult,
  GasUploadResponse,
} from '../features/dashboard/pages/comparator-gas/comparator-gas.models';

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
    form:   GasFormValue,
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

    const consumoAnualKwh = result.dias > 0
      ? Math.round(result.kwhTotal * (365 / result.dias))
      : result.kwhTotal;

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
        tarifa:           form.tariff,
        modalidad:        form.producto,
        periodo:          ocr.periodo_facturacion?.fecha_fin ?? '',
        diasFactura:      result.dias,
        ahorro:           result.ahorroEstudio,
        ahorroPorcentaje: result.ahorro_porcent,
        ahorroAnual:      result.ahorroXAnio,
        consumoAnualKwh,
        feeEnergia:       form.feeEnergia,
        feeFijo:          form.feeFijo,
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
    form:   GasFormValue,
    result: GasResult | null,
    ocr:    GasOcrResult | null,
    fileId: string,
  ): void {
    if (!result || !ocr) return;
    const payload = this.buildReportPayload(form, result, ocr, fileId);
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
