import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { ComparadorFormValue, ComparadorResult, OcrResult } from '../models/comparator.model';
import { environment } from '../../../environments/environment';
import { Tariff } from '../models/provider.model';
import {
  ReportPayload, SaveComparisonRequest, SaveComparisonResponse,
} from '../models/comparison-history.model';
import { ProviderService } from './provider.service';
import { CommissionService } from './commission.service';
import { PublicComparatorService } from './public-comparator.service';
import { calcularFactura } from './calculator.helpers';
import { buildComparatorReportPayload } from './comparator-report.helpers';
import { FLAT_COMMISSION_PRODUCTS, FLAT_COMMISSION_PRODUCT_NAMES } from '../../shared/constants/flat-commission-products';

export interface BatchFileResult {
  fileName: string;
  success:  boolean;
  data: {
    fileId:   string;
    ocrData:  OcrResult;
  } | null;
  error: string | null;
}

export type { ReportPayload, SaveComparisonRequest, SaveComparisonResponse };

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

    if (FLAT_COMMISSION_PRODUCT_NAMES.includes(producto)) {
      return FLAT_COMMISSION_PRODUCTS[producto] ?? 0;
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

  calculate(form: ComparadorFormValue, ocr: OcrResult, annualKwhOverride?: number): ComparadorResult {
    return calcularFactura(form, ocr, this.tariffs(), annualKwhOverride);
  }

  /**
   * Construye el payload del PDF (mismo shape que consume el backend en
   * POST /comparison-history/pdf y que se persiste en el snapshot para
   * regenerar el PDF idéntico desde la sección de Oportunidades).
   * Mapeo puro extraído a comparator-report.helpers.ts (sin HttpClient).
   */
  buildReportPayload(
    form: ComparadorFormValue,
    result: ComparadorResult,
    ocr: OcrResult,
    fileId: string,
    annualKwhOverride?: number,
  ): ReportPayload {
    return buildComparatorReportPayload(form, result, ocr, fileId, annualKwhOverride);
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
    annualKwhOverride?: number,
  ): Observable<SaveComparisonResponse> {
    const snapshot = this.buildReportPayload(form, result, ocr, fileId, annualKwhOverride);
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
    annualKwhOverride?: number,
  ): Observable<SaveComparisonResponse> | undefined {
    if (!result || !ocr) return undefined;

    return this.saveComparison(form, result, ocr, fileId, targetUserId, annualKwhOverride).pipe(
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
    annualKwhOverride?: number,
  ) {
    if (!result || !ocr) return;
    const payload = this.buildReportPayload(form, result, ocr, fileId, annualKwhOverride);

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
  download(type: 'pdf' | 'excel', form: ComparadorFormValue, result: ComparadorResult | null, ocr: OcrResult | null, fileId: string, targetUserId?: string, annualKwhOverride?: number) {
    if (type === 'excel') return this.downloadExcel(form, result, ocr, fileId, annualKwhOverride);
    return this.saveAndDownloadPdf(form, result, ocr, fileId, targetUserId, annualKwhOverride)?.subscribe();
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
