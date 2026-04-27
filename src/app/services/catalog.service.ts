import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  get() {
    return this.http.get<Catalog>(`${environment.apiUrl}/catalog`);
  }
}
