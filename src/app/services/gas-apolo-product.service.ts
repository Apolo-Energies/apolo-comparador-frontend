import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { GasApoloProduct } from '../entities/gas-apolo-product.model';

@Injectable({ providedIn: 'root' })
export class GasApoloProductService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/gas-apolo-products`;

  list(): Observable<GasApoloProduct[]> {
    return this.http.get<GasApoloProduct[]>(this.base);
  }

  updateMargin(id: number, marginEurPerMwh: number): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/margin`, { marginEurPerMwh });
  }

  updateName(id: number, name: string): Observable<void> {
    return this.http.put<void>(`${this.base}/${id}/name`, { name });
  }
}
