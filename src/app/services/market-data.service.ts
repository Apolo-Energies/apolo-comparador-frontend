import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MarketKpis, MarketSeries } from '../entities/market-data.model';

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/market-data`;

  getKpis(): Observable<MarketKpis> {
    return this.http.get<MarketKpis>(`${this.baseUrl}/kpis`);
  }

  getElectricityFutures(days = 90): Observable<MarketSeries> {
    return this.http.get<MarketSeries>(`${this.baseUrl}/electricity-futures`, {
      params: { days },
    });
  }

  getGasFutures(days = 90): Observable<MarketSeries> {
    return this.http.get<MarketSeries>(`${this.baseUrl}/gas-futures`, {
      params: { days },
    });
  }
}
