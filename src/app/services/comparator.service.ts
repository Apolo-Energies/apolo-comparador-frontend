import { Injectable, inject, signal } from '@angular/core';

export interface BatchFileResult {
  fileName: string;
  success:  boolean;
  data: {
    fileId:   string;
    ocrData:  OcrResult;
  } | null;
  error: string | null;
}
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ComparadorFormValue, ComparadorResult, OcrResult } from '../features/dashboard/pages/comparator/comparator.models';
import { environment } from '../../environments/environment';
import { Tariff } from '../entities/provider.model';
import {
  ReportPayload, SaveComparisonRequest, SaveComparisonResponse,
} from '../entities/comparison-history.model';
import { ProviderService } from './provider.service';
import { CommissionService } from './commission.service';
import { PublicComparatorService } from './public-comparator.service';
import { calcularFactura } from './calculator.helpers';
import { PERIODS } from '../shared/constants/period';

export type { ReportPayload, SaveComparisonRequest, SaveComparisonResponse };

const SNAP_ENERGIA: Record<string, number> = {
  'Fijo Snap Mini': 50,
  'Fijo Snap': 75,
  'Fijo Snap Maxi': 100,
};

const SNAP_PRODUCTS = ['Fijo Snap Mini', 'Fijo Snap', 'Fijo Snap Maxi'];

@Injectable({ providedIn: 'root' })
export class ComparatorService {
  private http = inject(HttpClient);
  private providerService = inject(ProviderService);
  private commissionService = inject(CommissionService);
  private publicService = inject(PublicComparatorService);

  readonly tariffs = signal<Tariff[]>([]);

  loadTariffs() {
    this.providerService.getByUser().pipe(
      tap(res => this.tariffs.set(res.tariffs))
    ).subscribe();
  }

  invalidateTariffs(): void {
    this.tariffs.set([]);
  }

  loadTariffsPublic() {
    this.publicService.getTariffs().pipe(
      tap(res => this.tariffs.set(res.tariffs))
    ).subscribe();
  }

  getComisionBase(producto: string, tariffCode?: string, commissionPct?: number): number {
    // Product-level commission override: if the product has a specific commission set, use it
    if (tariffCode) {
      const tariff  = this.tariffs().find(t => t.code === tariffCode);
      const product = tariff?.products.find(p => p.name === producto);
      if (product?.commissionPercentage != null) {
        return product.commissionPercentage / 100;
      }
    }

    if (SNAP_PRODUCTS.includes(producto)) {
      return SNAP_ENERGIA[producto] ?? 0;
    }
    // Use explicit commission (from selected user) or fall back to own commission signal
    const pct = commissionPct ?? this.commissionService.commission();
    return pct ? pct / 100 : 0;
  }

  upload(file: File, userId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('name', file.name);
    if (userId) form.append('userId', userId);
    return this.http.post<{ fileId: string; ocrData: OcrResult }>(`${environment.apiUrl}/files/upload-and-process`, form);
  }

  batchProcess(files: File[], userId?: string): Observable<BatchFileResult[]> {
    const form = new FormData();
    files.forEach(f => form.append('Files', f, f.name));
    if (userId) form.append('UserId', userId);
    return this.http.post<BatchFileResult[]>(`${environment.apiUrl}/files/batch-process`, form);
  }

  calculate(form: ComparadorFormValue, ocr: OcrResult): ComparadorResult {
    return calcularFactura(form, ocr, this.tariffs());
  }

  /**
   * Construye el payload del PDF (mismo shape que consume el backend en
   * POST /comparison-history/pdf y que se persiste en el snapshot para
   * regenerar el PDF idéntico desde la sección de Oportunidades).
   */
  buildReportPayload(
    form: ComparadorFormValue,
    result: ComparadorResult,
    ocr: OcrResult,
    fileId: string,
  ): ReportPayload {
    const dias = result.dias ?? ocr.periodo_facturacion?.numero_dias ?? 0;
    const alquilerEquipo = ocr.equipos?.importe ?? 0;

    // All totals come from the calculator (same numbers shown on screen)
    const {
      totalActual, ieActual, ivaActual, subTotalActual,
      extraSinIE, costesComunesConIEActual, otrosNoComunesActual,
      totalOferta, ieOferta, ivaOferta, subTotalOferta,
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
    const consumoAnual = dias > 0 ? Math.round(totalKwhFactura * (365 / dias)) : 0;

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
        otrosNoComunesOferta:    0,
        otrosComunesSinIeActual: extraSinIE,
        otrosComunesSinIeOferta: extraSinIE,
        otrosComunesConIeActual: costesComunesConIEActual,
        otrosComunesConIeOferta: costesComunesConIEActual,
      },
      lineas,
    };

    return payload;
  }

  /**
   * Persiste la comparación: crea (o actualiza) la Oportunidad por CUPS y
   * añade la fila de ComparisonHistory con todos los datos del formulario,
   * el cálculo y el snapshot completo del PDF.
   */
  saveComparison(
    form: ComparadorFormValue,
    result: ComparadorResult,
    ocr: OcrResult,
    fileId: string,
    targetUserId?: string,
  ): Observable<SaveComparisonResponse> {
    const snapshot = this.buildReportPayload(form, result, ocr, fileId);
    const cliente = ocr.cliente;
    const direccionParts = [
      cliente?.direccion?.tipo_via,
      cliente?.direccion?.nombre_via,
      cliente?.direccion?.numero,
      cliente?.direccion?.detalles,
    ].filter(Boolean);

    const body: SaveComparisonRequest = {
      fileId,
      cups:              cliente?.cups ?? '',
      ...(targetUserId ? { targetUserId } : {}),
      annualConsumption: snapshot.datos.consumoAnual,
      tariff:            form.tariff,
      product:           form.producto,
      omieAveragePrice:  form.precioMedio,
      energyFee:         form.feeEnergia,
      powerFee:          form.feePotencia,
      energyCommission:  form.comisionEnergia,
      willCloseContract: form.willCloseContract,
      commissionAmount:  result.comision,
      monthlySavings:    result.ahorroEstudio,
      annualSavings:     result.ahorroXAnio,
      savingsPercent:    result.ahorro_porcent,
      clientName:        cliente?.titular ?? undefined,
      clientNif:         cliente?.nif ?? undefined,
      clientAddress:     direccionParts.length ? direccionParts.join(' ') : undefined,
      clientPostalCode:  cliente?.direccion?.cp ?? undefined,
      clientProvince:    cliente?.direccion?.provincia ?? undefined,
      pdfSnapshot:       snapshot,
    };

    return this.http.post<SaveComparisonResponse>(
      `${environment.apiUrl}/comparison-history/create`, body);
  }
  downloadPdfFromHistory(comparisonHistoryId: string): Observable<Blob> {
    return this.http.get(
      `${environment.apiUrl}/comparison-history/${comparisonHistoryId}/pdf`,
      { responseType: 'blob' }
    );
  }

  saveAndDownloadPdf(
    form: ComparadorFormValue,
    result: ComparadorResult | null,
    ocr: OcrResult | null,
    fileId: string,
    targetUserId?: string,
  ): Observable<SaveComparisonResponse> | undefined {
    if (!result || !ocr) return undefined;

    return this.saveComparison(form, result, ocr, fileId, targetUserId).pipe(
      tap(saved => {
        this.downloadPdfFromHistory(saved.id).subscribe(blob => {
          this.triggerBlobDownload(blob, `Comparacion_${saved.id}.pdf`);
        });
      })
    );
  }

  downloadExcel(
    form: ComparadorFormValue,
    result: ComparadorResult | null,
    ocr: OcrResult | null,
    fileId: string,
  ) {
    if (!result || !ocr) return;
    const payload = this.buildReportPayload(form, result, ocr, fileId);

    return this.http.post(
      `${environment.apiUrl}/provider/excel`, payload, { responseType: 'blob' }
    ).subscribe(blob => this.triggerBlobDownload(blob, 'comparador.xlsx'));
  }

  /** Compatibilidad con el flujo público (sin persistencia). */
  downloadPublicPdf(form: ComparadorFormValue, result: ComparadorResult | null, ocr: OcrResult | null, fileId: string) {
    if (!result || !ocr) return;
    const payload = this.buildReportPayload(form, result, ocr, fileId);
    return this.publicService.downloadPdf(payload).subscribe(blob => {
      this.triggerBlobDownload(blob as Blob, 'comparador.pdf');
    });
  }

  /**
   * @deprecated Use saveAndDownloadPdf for PDFs and downloadExcel for Excel.
   * Mantenido temporalmente para que callers existentes no se rompan.
   */
  download(type: 'pdf' | 'excel', form: ComparadorFormValue, result: ComparadorResult | null, ocr: OcrResult | null, fileId: string, targetUserId?: string) {
    if (type === 'excel') return this.downloadExcel(form, result, ocr, fileId);
    return this.saveAndDownloadPdf(form, result, ocr, fileId, targetUserId)?.subscribe();
  }

  private triggerBlobDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
