import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ComparisonsPaged,
  OpportunityDetail,
  OpportunityFilters,
  OpportunityPaged,
  OpportunityStatus,
  OpportunitySummary,
  parseOpportunityStatus,
} from '../entities/opportunity.model';

function normalizeSummary<T extends { status: unknown }>(s: T): T & { status: OpportunityStatus } {
  return { ...s, status: parseOpportunityStatus(s.status as string | number) };
}

@Injectable({ providedIn: 'root' })
export class OpportunityService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/opportunities`;

  list(filters: OpportunityFilters = {}): Observable<OpportunityPaged> {
    let params = new HttpParams()
      .set('page',     String(filters.page     ?? 1))
      .set('pageSize', String(filters.pageSize ?? 20));

    if (filters.cups)                  params = params.set('cups',              filters.cups);
    if (filters.status !== undefined)  params = params.set('status',            String(filters.status));
    if (filters.startDate)             params = params.set('startDate',         filters.startDate);
    if (filters.endDate)               params = params.set('endDate',           filters.endDate);
    if (filters.clientName)            params = params.set('clientName',        filters.clientName);
    if (filters.clientNif)             params = params.set('clientNif',         filters.clientNif);
    if (filters.createdByFullName)     params = params.set('createdByFullName', filters.createdByFullName);
    if (filters.createdByEmail)        params = params.set('createdByEmail',    filters.createdByEmail);
    if (filters.searchTerm)            params = params.set('searchTerm',        filters.searchTerm);

    return this.http.get<OpportunityPaged>(this.base, { params }).pipe(
      map(res => ({
        ...res,
        items: res.items.map(normalizeSummary),
      })),
    );
  }

  getById(id: string, page = 1, pageSize = 20): Observable<OpportunityDetail> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    return this.http.get<OpportunityDetail>(`${this.base}/${id}`, { params }).pipe(
      map(res => ({
        ...res,
        summary: normalizeSummary(res.summary),
      })),
    );
  }

  getComparisons(id: string, page = 1, pageSize = 20): Observable<ComparisonsPaged> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('pageSize', String(pageSize));
    return this.http.get<ComparisonsPaged>(`${this.base}/${id}/comparisons`, { params });
  }

  updateStatus(id: string, status: OpportunityStatus): Observable<OpportunitySummary> {
    return this.http.patch<OpportunitySummary>(`${this.base}/${id}/status`, { status }).pipe(
      map(normalizeSummary),
    );
  }

  downloadComparisonPdf(comparisonId: string): Observable<Blob> {
    return this.http.get(
      `${environment.apiUrl}/comparison-history/${comparisonId}/pdf`,
      { responseType: 'blob' }
    );
  }
}
