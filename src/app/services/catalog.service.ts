import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CatalogProvider {
  id: string;
  name: string;
}

export interface CatalogCommission {
  id: string;
  name: string;
}

export interface Catalog {
  providers: CatalogProvider[];
  commissions: CatalogCommission[];
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private catalog$?: Observable<Catalog>;

  get(): Observable<Catalog> {
    if (!this.catalog$) {
      this.catalog$ = this.http
        .get<Catalog>(`${environment.apiUrl}/catalog`)
        .pipe(shareReplay(1));
    }
    return this.catalog$;
  }
}
