import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CloseGasRegulatoryParamsPayload,
  CreateGasRegulatoryParamsPayload,
  GasRegulatoryParams,
} from '../entities/gas-regulatory-params.model';

@Injectable({ providedIn: 'root' })
export class GasRegulatoryParamsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/gas-regulatory-params`;

  list(): Observable<GasRegulatoryParams[]> {
    return this.http.get<GasRegulatoryParams[]>(this.base);
  }

  getActive(at?: string): Observable<GasRegulatoryParams> {
    let params = new HttpParams();
    if (at) params = params.set('at', at);
    return this.http.get<GasRegulatoryParams>(`${this.base}/active`, { params });
  }

  getById(id: number): Observable<GasRegulatoryParams> {
    return this.http.get<GasRegulatoryParams>(`${this.base}/${id}`);
  }

  create(payload: CreateGasRegulatoryParamsPayload): Observable<GasRegulatoryParams> {
    return this.http.post<GasRegulatoryParams>(this.base, payload);
  }

  close(id: number, payload: CloseGasRegulatoryParamsPayload): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/close`, payload);
  }
}
