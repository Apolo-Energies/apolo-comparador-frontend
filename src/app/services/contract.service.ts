import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ContractDetail } from '../entities/user-detail.model';

@Injectable({ providedIn: 'root' })
export class ContractService {
  private http = inject(HttpClient);

  createManual(data: { customerId: string; origin: number }) {
    return this.http.post<ContractDetail>(`${environment.apiUrl}/contracts`, data);
  }

  send(customerId: string) {
    return this.http.post(`${environment.apiUrl}/contracts/renew`, { customerId });
  }

  getMyPreview(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/contracts/my-preview`, { responseType: 'blob' });
  }

  requestSignature(userId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contracts/request-signature`, { userId });
  }

  validateContract(contractId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contracts/${contractId}/validate`, {});
  }

  rejectContract(contractId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contracts/${contractId}/reject`, { reason });
  }
}
