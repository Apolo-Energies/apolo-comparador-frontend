import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GasSipsApiResponse } from '../entities/gas-sips.model';

/**
 * Service espejo del SipsService de electricidad, pero para gas.
 * La data viene de la BD local poblada semanalmente desde los volcados nacionales de CNMC.
 */
@Injectable({ providedIn: 'root' })
export class GasSipsService {
  private readonly http = inject(HttpClient);

  getByCups(cups: string): Observable<GasSipsApiResponse> {
    return this.http.post<GasSipsApiResponse>(`${environment.apiUrl}/sips-gas`, { cups });
  }
}
