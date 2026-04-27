import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { tap } from 'rxjs';
import { UserCommission } from '../entities/commission.model';
import { environment } from '../../environments/environment';

export interface CommissionRow {
  id:               string;
  name:             string;
  percentage:       number;
  userCommissions:  unknown[];
}

export interface CommissionPaged {
  items:           CommissionRow[];
  currentPage:     number;
  pageSize:        number;
  totalCount:      number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
}

export interface CommissionFilters {
  page?:     number;
  pageSize?: number;
}

export interface CreateCommissionRequest {
  name:       string;
  percentage: number;
}

@Injectable({ providedIn: 'root' })
export class CommissionService {
  private http   = inject(HttpClient);
  private loaded = false;

  readonly commission = signal<number>(0);

  getAll(filters: CommissionFilters = {}) {
    const params = new HttpParams()
      .set('page',     String(filters.page     ?? 1))
      .set('pageSize', String(filters.pageSize ?? 20));

    return this.http.get<CommissionPaged>(`${environment.apiUrl}/commission`, { params });
  }

  getAllCommissions() {
    return this.http.get<{ result: CommissionRow[] }>(`${environment.apiUrl}/commission/all`);
  }

  create(data: CreateCommissionRequest) {
    return this.http.post<{ result: CommissionRow }>(`${environment.apiUrl}/commission/create`, data);
  }

  update(id: string, data: CreateCommissionRequest) {
    return this.http.put<{ result: CommissionRow }>(`${environment.apiUrl}/commission/update/${id}`, data);
  }

  delete(id: string) {
    return this.http.delete(`${environment.apiUrl}/commission/remove/${id}`);
  }

  load(userId: string) {
    if (this.loaded) return;
    this.http.get<{ result: UserCommission }>(`${environment.apiUrl}/user-commission/${userId}`)
      .pipe(
        tap(res => {
          this.commission.set(res.result?.commissionType?.percentage ?? 0);
          this.loaded = true;
        })
      ).subscribe();
  }
}
