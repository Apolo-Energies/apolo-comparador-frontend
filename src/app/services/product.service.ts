import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ProductCatalogEntry {
  id:           number;
  name:         string;
  tariffId:     number;
  tariffCode:   string;
  providerId:   number;
  providerName: string;
  isAvailable:  boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private http = inject(HttpClient);

  getCatalog(): Observable<ProductCatalogEntry[]> {
    return this.http.get<ProductCatalogEntry[]>(`${environment.apiUrl}/products/catalog`);
  }
}
