import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ConsolidatedComparisonData, HistoryItem } from '../features/dashboard/pages/statistics/models/dashboard-api.models';

export interface StatisticsRow {
  userId:                 string;
  fullName:               string;
  email:                  string;
  totalCups:              number;
  totalAnnualConsumption: number;
}

export interface StatisticsFilters {
  name?:          string;
  email?:         string;
  sortBy?:        'FullName' | 'Email' | 'TotalCups' | 'TotalAnnualConsumption';
  sortDirection?: 'Asc' | 'Desc';
  page?:          number;
  pageSize?:      number;
}

const BASE_PATH = 'comparison-history';

@Injectable({ providedIn: 'root' })
export class StatisticsService {
  private http = inject(HttpClient);

  getByFilters(filters: StatisticsFilters = {}) {
    let params = new HttpParams()
      .set('includeHistory', 'true')
      .set('includeSummary', 'false');

    if (filters.name)          params = params.set('historyFullNameFilter', filters.name);
    if (filters.email)         params = params.set('historyEmailFilter', filters.email);
    if (filters.sortBy)        params = params.set('historySortBy', filters.sortBy);
    if (filters.sortDirection) params = params.set('historySortDirection', filters.sortDirection);
    if (filters.page)          params = params.set('historyPage', String(filters.page));
    if (filters.pageSize)      params = params.set('historyPageSize', String(filters.pageSize));

    return this.http.get<ConsolidatedComparisonData>(
      `${environment.apiUrl}/${BASE_PATH}/data`,
      { params }
    ).pipe(
      map(res => ({ 
        result: (res.history?.items ?? []) as StatisticsRow[], 
        total: res.history?.totalCount ?? 0,
        totalPages: res.history?.totalPages ?? 1,
        currentPage: res.history?.currentPage ?? 1
      }))
    );
  }
}
