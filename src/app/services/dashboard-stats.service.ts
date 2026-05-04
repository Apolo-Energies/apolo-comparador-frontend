import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConsolidatedComparisonData, ConsolidatedDataParams, DailySummaryApiItem, MonthlySummaryApiItem, PaginatedComparisonDetail, SummaryApiResult } from '../features/dashboard/pages/statistics/models/dashboard-api.models';
import { DateRange } from '../features/dashboard/pages/statistics/models/dashboard-ui.models';

const BASE_PATH = 'comparison-history';

@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  private http = inject(HttpClient);

  /**
   * Obtiene todos los datos del dashboard y tabla en una sola llamada consolidada.
   */
  getConsolidatedData(
    range?: DateRange,
    historyFullNameFilter?: string,
    historyEmailFilter?: string,
    historySortBy?: 'FullName' | 'Email' | 'TotalCups' | 'TotalAnnualConsumption',
    historySortDirection?: 'Asc' | 'Desc',
    historyPage?: number,
    historyPageSize?: number,
    includeOnlyHistory = false,
    historyTariffIds?: number[],
    historyProductIds?: number[]
  ): Observable<ConsolidatedComparisonData> {
    const params: ConsolidatedDataParams = {
      includeSummary:        !includeOnlyHistory,
      includeDailySummary:   !includeOnlyHistory,
      includeMonthlySummary: !includeOnlyHistory,
      includeHistory:        true,
    };

    if (range?.from) params.startDate = this.formatDateParam(range.from);
    if (range?.to)   params.endDate   = this.formatDateParam(range.to);
    if (historyFullNameFilter) params.historyFullNameFilter = historyFullNameFilter;
    if (historyEmailFilter)    params.historyEmailFilter = historyEmailFilter;
    if (historySortBy)         params.historySortBy = historySortBy;
    if (historySortDirection)  params.historySortDirection = historySortDirection;
    if (historyPage)           params.historyPage = historyPage;
    if (historyPageSize)       params.historyPageSize = historyPageSize;
    
    // Agregar filtros de tarifa y producto como CSV
    if (historyTariffIds && historyTariffIds.length > 0) {
      params.historyTariffIds = historyTariffIds.join(',');
    }
    if (historyProductIds && historyProductIds.length > 0) {
      params.historyProductIds = historyProductIds.join(',');
    }

    return this.http.get<ConsolidatedComparisonData>(
      `${environment.apiUrl}/${BASE_PATH}/data`,
      { params: this.buildParams(params) },
    );
  }

  /**
   * Método legacy - DEPRECADO
   * @deprecated Use getConsolidatedData instead
   */
  getSummary(range?: DateRange): Observable<SummaryApiResult> {
    return this.http.get<SummaryApiResult>(
      `${environment.apiUrl}/${BASE_PATH}/summary`,
      { params: this.buildDateParams(range) },
    );
  }

  /**
   * Método legacy - DEPRECADO
   * @deprecated Use getConsolidatedData instead
   */
  getDailySummary(range?: DateRange): Observable<DailySummaryApiItem[]> {
    return this.http.get<DailySummaryApiItem[]>(
      `${environment.apiUrl}/${BASE_PATH}/daily-summary`,
      { params: this.buildDateParams(range) },
    );
  }

  /**
   * Método legacy - DEPRECADO
   * @deprecated Use getConsolidatedData instead
   */
  getMonthlySummary(range?: DateRange): Observable<MonthlySummaryApiItem[]> {
    return this.http.get<MonthlySummaryApiItem[]>(
      `${environment.apiUrl}/${BASE_PATH}/monthly-summary`,
      { params: this.buildDateParams(range) },
    );
  }

  /**
   * Obtiene el detalle de comparaciones para un usuario específico
   */
  getComparisonDetailByUserId(
    userId: string,
    range?: DateRange,
    page: number = 1,
    pageSize: number = 10
  ): Observable<PaginatedComparisonDetail> {
    let params = new HttpParams()
      .set('userId', userId)
      .set('page', String(page))
      .set('pageSize', String(pageSize));

    if (range?.from) params = params.set('startDate', this.formatDateParam(range.from));
    if (range?.to)   params = params.set('endDate', this.formatDateParam(range.to));

    return this.http.get<PaginatedComparisonDetail>(
      `${environment.apiUrl}/${BASE_PATH}/by-id`,
      { params }
    );
  }

  /**
   * Exporta el reporte de comparaciones a Excel
   */
  exportToExcel(range?: DateRange): void {
    let params = new HttpParams();
    
    if (range?.from) params = params.set('startDate', this.formatDateParam(range.from));
    if (range?.to)   params = params.set('endDate', this.formatDateParam(range.to));

    this.http.get(
      `${environment.apiUrl}/${BASE_PATH}/export-excel`,
      { 
        params,
        responseType: 'blob',
        observe: 'response'
      }
    ).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) return;

        // Crear URL temporal para el blob
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        // Obtener nombre del archivo del header o usar uno por defecto
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'reporte-comparaciones.xlsx';
        
        if (contentDisposition) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
          if (matches?.[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }
        
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        
        // Limpiar
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        console.error('Error al exportar:', error);
      }
    });
  }

  private buildParams(params: ConsolidatedDataParams): HttpParams {
    let httpParams = new HttpParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return httpParams;
  }

  private formatDateParam(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private buildDateParams(range?: DateRange): HttpParams {
    let params = new HttpParams();
    if (range?.from) params = params.set('startDate', this.formatDateParam(range.from));
    if (range?.to)   params = params.set('endDate', this.formatDateParam(range.to));
    return params;
  }
}
