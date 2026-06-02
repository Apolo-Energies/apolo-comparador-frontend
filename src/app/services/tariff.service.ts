import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TariffRow {
  id:         number;
  code:       string;
  name:       string;
  providerId: number;
}

@Injectable({ providedIn: 'root' })
export class TariffService {
  private http = inject(HttpClient);

  getByProvider(providerId: number): Observable<TariffRow[]> {
    return this.http.get<TariffRow[]>(`${environment.apiUrl}/tariffs/provider/${providerId}`);
  }
}
