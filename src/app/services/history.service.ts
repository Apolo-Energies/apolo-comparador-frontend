import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface HistoryUser {
  id:             string;
  fullName:       string;
  email:          string;
  isEnergyExpert: boolean;
  isActive:       boolean;
  role:           number;
  providerId:     number;
}

export interface HistoryItem {
  id:                string;
  userId:            string;
  user:              HistoryUser;
  fileId:            string;
  file:              null;
  cups:              string;
  annualConsumption: number;
  createdAt:         string;
}

export interface HistoryPaged {
  items:           HistoryItem[];
  currentPage:     number;
  pageSize:        number;
  totalCount:      number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
}

export interface HistoryFilters {
  fullName?: string;
  email?:    string;
  date?:     string;
  cups?:     string;
  page?:     number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private http = inject(HttpClient);

  getByFilters(filters: HistoryFilters = {}) {
    let params = new HttpParams()
      .set('page',     String(filters.page     ?? 1))
      .set('pageSize', String(filters.pageSize ?? 10));

    if (filters.fullName) params = params.set('fullName', filters.fullName);
    if (filters.email)    params = params.set('email',    filters.email);
    if (filters.date)     params = params.set('fecha',    filters.date);
    if (filters.cups)     params = params.set('cups',     filters.cups);

    return this.http.get<HistoryPaged>(
      `${environment.apiUrl}/comparison-history`,
      { params }
    );
  }

  downloadExcel(): Observable<Blob> {
    return this.http.post(`${environment.apiUrl}/reports/excel-report`, {}, { responseType: 'blob' });
  }
}
