import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CloseGasAccessTariffPayload,
  CreateGasAccessTariffPayload,
  GasAccessTariff,
  UpdateGasAccessTariffMarginPayload,
  UpdateGasAccessTariffPricesPayload,
} from '../entities/gas-access-tariff.model';

@Injectable({ providedIn: 'root' })
export class GasAccessTariffService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/gas-access-tariffs`;

  list(activeOnly = false, at?: string): Observable<GasAccessTariff[]> {
    let params = new HttpParams();
    if (activeOnly) params = params.set('activeOnly', 'true');
    if (at)         params = params.set('at', at);
    return this.http.get<GasAccessTariff[]>(this.base, { params });
  }

  getById(id: number): Observable<GasAccessTariff> {
    return this.http.get<GasAccessTariff>(`${this.base}/${id}`);
  }

  create(payload: CreateGasAccessTariffPayload): Observable<GasAccessTariff> {
    return this.http.post<GasAccessTariff>(this.base, payload);
  }

  updatePrices(id: number, payload: UpdateGasAccessTariffPricesPayload): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/prices`, payload);
  }

  updateMargin(id: number, payload: UpdateGasAccessTariffMarginPayload): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/margin`, payload);
  }

  close(id: number, payload: CloseGasAccessTariffPayload): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/close`, payload);
  }
}
