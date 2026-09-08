import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateQuixoticContractRequest,
  CreateQuixoticContractResponse,
  QuixoticContract,
  QuixoticContractDocument,
  QuixoticContractFilters,
} from '../entities/quixotic-contract.model';

@Injectable({ providedIn: 'root' })
export class QuixoticContractService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/quixotic/contracts`;

  getContracts(filters: QuixoticContractFilters = {}): Observable<QuixoticContract[]> {
    let params = new HttpParams().set('limit', String(filters.limit ?? 50));
    if (filters.contractCode)   params = params.set('contractCode', filters.contractCode);
    if (filters.contractStatus) params = params.set('contractStatus', filters.contractStatus);

    return this.http.get<QuixoticContract[]>(this.base, { params });
  }

  createContract(payload: CreateQuixoticContractRequest): Observable<CreateQuixoticContractResponse> {
    return this.http.post<CreateQuixoticContractResponse>(this.base, payload);
  }

  getDocument(id: string): Observable<QuixoticContractDocument> {
    return this.http.get<QuixoticContractDocument>(`${this.base}/${id}/document`);
  }
}
