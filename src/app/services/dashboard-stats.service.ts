import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { DailySummaryApiItem, MonthlySummaryApiItem, SummaryApiResult } from '../features/dashboard/pages/statistics/models/dashboard-api.models';
import { DateRange } from '../features/dashboard/pages/statistics/models/dashboard-ui.models';

const BASE_PATH = 'comparison-history';

@Injectable({ providedIn: 'root' })
export class DashboardStatsService {
  private http = inject(HttpClient);

  getSummary(range?: DateRange): Observable<SummaryApiResult> {
    return this.http.get<SummaryApiResult>(
      `${environment.apiUrl}/${BASE_PATH}/summary`,
      { params: this.buildDateParams(range) },
    );
  }

  getDailySummary(range?: DateRange): Observable<DailySummaryApiItem[]> {
    return this.http.get<DailySummaryApiItem[]>(
      `${environment.apiUrl}/${BASE_PATH}/daily-summary`,
      { params: this.buildDateParams(range) },
    );
  }

  getMonthlySummary(range?: DateRange): Observable<MonthlySummaryApiItem[]> {
    return this.http.get<MonthlySummaryApiItem[]>(
      `${environment.apiUrl}/${BASE_PATH}/monthly-summary`,
      { params: this.buildDateParams(range) },
    );
  }

  private buildDateParams(range?: DateRange): HttpParams {
    let params = new HttpParams();
    if (range?.from) params = params.set('startDate', range.from.toISOString());
    if (range?.to)   params = params.set('endDate', range.to.toISOString());
    return params;
  }
}
