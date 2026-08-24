import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AltaRapidaGasRequest, AltaRapidaGasResponse } from '../entities/alta-rapida-gas.model';

@Injectable({ providedIn: 'root' })
export class AltaRapidaGasService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/quixotic/alta-rapida`;

  submit(payload: AltaRapidaGasRequest): Observable<AltaRapidaGasResponse> {
    return this.http.post<AltaRapidaGasResponse>(this.base, payload);
  }
}
