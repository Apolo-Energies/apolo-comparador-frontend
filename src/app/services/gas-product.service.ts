import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateGasProductPayload,
  GasProduct,
  UpdateGasProductPayload,
} from '../entities/gas-product.model';

@Injectable({ providedIn: 'root' })
export class GasProductService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/gas-products`;

  list(tariffCode?: string, onlyAvailable = false): Observable<GasProduct[]> {
    let params = new HttpParams();
    if (tariffCode)    params = params.set('tariffCode', tariffCode);
    if (onlyAvailable) params = params.set('onlyAvailable', 'true');
    return this.http.get<GasProduct[]>(this.base, { params });
  }

  create(payload: CreateGasProductPayload): Observable<GasProduct> {
    return this.http.post<GasProduct>(this.base, payload);
  }

  update(id: number, payload: UpdateGasProductPayload): Observable<GasProduct> {
    return this.http.put<GasProduct>(`${this.base}/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
