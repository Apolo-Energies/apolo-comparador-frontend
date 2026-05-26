import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ContractDetail } from '../entities/user-detail.model';
import { ContratoListItem } from '../entities/contrato.model';
import { ServicioListItem } from '../entities/servicio.model';

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

  sendContract(contractId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contracts/${contractId}/send`, {});
  }

  getServicios(params: {
    filter?:  string;
    orderBy?: string;
    offset?:  number;
    limit?:   number;
  }): Observable<ServicioListItem[]> {
    const httpParams = new HttpParams()
      .set('filter',  params.filter  ?? '')
      .set('orderBy', params.orderBy ?? 'Id')
      .set('offset',  String(params.offset  ?? 0))
      .set('limit',   String(params.limit   ?? 10));

    return this.http.post<ServicioListItem[]>(
      `${environment.apiUrl}/energy-expert/services`,
      {},
      { params: httpParams },
    );
  }

  getContratos(params: {
    filter?:  string;
    orderBy?: string;
    offset?:  number;
    limit?:   number;
  }): Observable<ContratoListItem[]> {
    const httpParams = new HttpParams()
      .set('filter',  params.filter  ?? '')
      .set('orderBy', params.orderBy ?? 'NombreCliente')
      .set('offset',  String(params.offset  ?? 0))
      .set('limit',   String(params.limit   ?? 10));

    return this.http.post<ContratoListItem[]>(
      `${environment.apiUrl}/energy-expert/contracts`,
      {},
      { params: httpParams },
    );
  }
}
