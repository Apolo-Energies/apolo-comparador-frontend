import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SubUser {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  commissionPercentage: number | null;
}

export interface CreateSubUserRequest {
  email: string;
  name: string;
  surnames: string;
  role: 'Colaborador';
  personType: 'Individual' | 'Company';
  companyName?: string | null;
  phone?: string | null;
  dni?: string | null;
  cif?: string | null;
  legalAddress?: string | null;
  notificationAddress?: string | null;
  bankAccount?: string | null;
}

export interface AssignCommissionRequest {
  parentUserId: string;
  subUserId: string;
  percentage: number;
}

@Injectable({ providedIn: 'root' })
export class SubUsersService {
  private http = inject(HttpClient);

  getMySubUsers(): Observable<SubUser[]> {
    return this.http.get<SubUser[]>(`${environment.apiUrl}/sub-users`);
  }

  getSubUsersByParent(parentUserId: string): Observable<SubUser[]> {
    return this.http.get<SubUser[]>(`${environment.apiUrl}/sub-users/${parentUserId}`);
  }

  create(data: CreateSubUserRequest): Observable<{ id: string; email: string; fullName: string; role: string }> {
    return this.http.post<{ id: string; email: string; fullName: string; role: string }>(
      `${environment.apiUrl}/user`,
      data,
    );
  }

  assignCommission(data: AssignCommissionRequest): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/sub-users`, data);
  }

  deleteCommission(subUserId: string, parentUserId?: string): Observable<void> {
    const params: Record<string, string> = {};
    if (parentUserId) params['parentUserId'] = parentUserId;
    return this.http.delete<void>(`${environment.apiUrl}/sub-users/${subUserId}/commission`, { params });
  }
}
