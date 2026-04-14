import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface StatisticsRow {
  id:            string;
  nombre:        string;
  comparaciones: number;
  ahorro:        number;
  fecha:         string;
}

export interface StatisticsFilters {
  name?:     string;
  page?:     number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private http = inject(HttpClient);

  getByFilters(filters: StatisticsFilters = {}) {
    let params = new HttpParams()
      .set('page',     String(filters.page     ?? 1))
      .set('pageSize', String(filters.pageSize ?? 10));

    if (filters.name) params = params.set('nombre', filters.name);

    return this.http.get<{ result: StatisticsRow[]; total: number }>(
      `${environment.apiUrl}/analytics/statistics`,
      { params }
    );
  }
}
