import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { UserFilters, UserPaged } from '../entities/user.model';
import { UserDetail } from '../entities/user-detail.model';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface CreateUserRequest {
  personType:           number;   // 0 = Individual, 1 = Company
  email:               string;
  role:                number;    // UserRole enum value: Master=1, Collaborator=2, Referrer=4, Tester=8
  name:                string;
  surnames:            string;
  dni?:                string;
  phone?:              string;
  legalAddress?:       string;
  notificationAddress?: string;
  bankAccount?:        string;
  cif?:                string;
  companyName?:        string;
}

export interface UpdateUserRequest {
  role?:           number;
  isActive?:       boolean;
  isEnergyExpert?: boolean;
  providerId?:     number;
}

export interface CreateUserResponse {
  id:             string;
  fullName:       string;
  email:          string;
  role:           string;
  isActive:       boolean;
  isEnergyExpert: boolean;
  providerId:     number;
  providerName:   string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private http = inject(HttpClient);

  create(data: CreateUserRequest) {
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/user`, data);
  }

  patch(id: string, data: UpdateUserRequest) {
    return this.http.patch(`${environment.apiUrl}/user/${id}`, data);
  }

  assignCommission(userID: string, commissionId: string) {
    return this.http.post(`${environment.apiUrl}/usercommission/assign`, { userID, commissionId });
  }

  getByFilters(filters: UserFilters = {}) {
    let params = new HttpParams()
      .set('page',     String(filters.page     ?? 1))
      .set('pageSize', String(filters.pageSize ?? 10));

    if (filters.fullName) params = params.set('fullName', filters.fullName);
    if (filters.email)    params = params.set('email',    filters.email);
    if (filters.role)     params = params.set('role',     filters.role);

    return this.http.get<UserPaged>(`${environment.apiUrl}/user/user-filter`, { params });
  }

  getById(id: string): Observable<UserDetail> {
    return this.http.get<UserDetail>(`${environment.apiUrl}/user/${id}`);
  }

  updateProfile(id: string, data: { fullName: string; email: string; phone?: string }) {
    return this.http.put(`${environment.apiUrl}/user/${id}`, data);
  }

  downloadExcel(): Observable<Blob> {
    return this.http.post(
      `${environment.apiUrl}/reports/excel-users-report`,
      {},
      { responseType: 'blob' }
    );
  }
}
