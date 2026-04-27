import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

// Request types
export interface UpdateProductPeriodRequest {
  period: string;  // "P1", "P2", etc.
  value: number;
  productId: number;
}

export interface UpdateOmieDistributionPeriodRequest {
  period: string;  // "P1", "P2", etc.
  factor: number;
  omieDistributionId: number;
}

export interface UpdateBoePowerPeriodRequest {
  period: string;  // "P1", "P2", etc.
  value: number;
  boePowerId: number;
}

@Injectable({ providedIn: 'root' })
export class RatesService {
  private http = inject(HttpClient);

  /**
   * Actualizar un período individual de producto
   */
  updateProductPeriod(periodId: number, data: UpdateProductPeriodRequest): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/product-period/${periodId}`, data);
  }

  /**
   * Actualizar un período individual de distribución OMIE
   */
  updateOmieDistributionPeriod(periodId: number, data: UpdateOmieDistributionPeriodRequest): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/omie-distribution-period/${periodId}`, data);
  }

  /**
   * Actualizar un período individual de potencia BOE
   */
  updateBoePowerPeriod(periodId: number, data: UpdateBoePowerPeriodRequest): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/boe-power-period/${periodId}`, data);
  }

  /**
   * Eliminar un período de producto
   */
  deleteProductPeriod(periodId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/product-period/${periodId}`);
  }

  /**
   * Eliminar un período de distribución OMIE
   */
  deleteOmieDistributionPeriod(periodId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/omie-distribution-period/${periodId}`);
  }

  /**
   * Eliminar un período de potencia BOE
   */
  deleteBoePowerPeriod(periodId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/boe-power-period/${periodId}`);
  }
}
