import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CustomerDetail } from '../entities/user-detail.model';

export interface CreateCustomerRequest {
  userId: string;
  kind: number;
  personType: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  legalAddress: string;
  notificationAddress: string;
  bankAccount: string;
  dni?: string;
  cif?: string;
  companyName?: string;
}

export interface UpdateCustomerRequest {
  id: string;
  userId: string;
  kind: number;
  personType: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  legalAddress: string;
  notificationAddress: string;
  bankAccount: string;
  dni?: string;
  cif?: string;
  companyName?: string;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private http = inject(HttpClient);

  create(data: CreateCustomerRequest) {
    return this.http.post<CustomerDetail>(`${environment.apiUrl}/customer`, data);
  }

  update(id: string, data: UpdateCustomerRequest) {
    return this.http.put<CustomerDetail>(`${environment.apiUrl}/customer/${id}`, data);
  }
}
