import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { UserFilters, UserPaged } from '../entities/user.model';
import { environment } from '../../environments/environment';

export interface CreateUserRequest {
  fullName:  string;
  email:     string;
  password:  string;
  role:      string;
  phone?:    string;
  providerId?: number;
}

export interface UpdateUserRequest {
  role?:           number;
  isActive?:       boolean;
  isEnergyExpert?: boolean;
  commissionId?:   string;
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
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/users`, data);
  }

  patch(id: string, data: UpdateUserRequest) {
    return this.http.patch(`${environment.apiUrl}/users/${id}`, data);
  }

  getByFilters(filters: UserFilters = {}) {
    let params = new HttpParams()
      .set('page',     String(filters.page     ?? 1))
      .set('pageSize', String(filters.pageSize ?? 10));

    if (filters.fullName) params = params.set('fullName', filters.fullName);
    if (filters.email)    params = params.set('email',    filters.email);
    if (filters.role)     params = params.set('role',     filters.role);

    return this.http.get<UserPaged>(`${environment.apiUrl}/users`, { params });
  }
}
