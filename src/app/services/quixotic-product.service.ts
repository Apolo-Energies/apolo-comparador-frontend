import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { QuixoticProduct } from '../entities/quixotic-product.model';

@Injectable({ providedIn: 'root' })
export class QuixoticProductService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/quixotic/products`;

  getProducts(serviceType?: string): Observable<QuixoticProduct[]> {
    let params = new HttpParams();
    if (serviceType) params = params.set('serviceType', serviceType);
    return this.http.get<QuixoticProduct[]>(this.base, { params });
  }
}
