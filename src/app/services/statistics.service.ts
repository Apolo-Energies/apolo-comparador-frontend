import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface StatisticsRow {
  fullName:               string;
  email:                  string;
  totalCups:              number;
  totalAnnualConsumption: number;
}

export interface StatisticsFilters {
  name?:     string;
  page?:     number;
  pageSize?: number;
}

interface SummaryResponse {
  data:             StatisticsRow[];
  totalUsersActive: number;
}

const BASE_PATH = 'comparison-history';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private http = inject(HttpClient);

  getByFilters(filters: StatisticsFilters = {}) {
    let params = new HttpParams()
      .set('page',     String(filters.page     ?? 1))
      .set('pageSize', String(filters.pageSize ?? 10));

    if (filters.name) params = params.set('nombre', filters.name);

    return this.http.get<SummaryResponse>(
      `${environment.apiUrl}/${BASE_PATH}/summary`,
      { params }
    ).pipe(
      map(res => ({ result: res.data ?? [], total: res.totalUsersActive ?? res.data?.length ?? 0 }))
    );
  }
}
