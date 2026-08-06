import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AssignedClientFilters, AssignedClientsPageResponse } from '../entities/assigned-client.model';

/**
 * Listado de "Mis clientes". El backend resuelve el alcance (delegación propia
 * del usuario, o todas si es Master) a partir del JWT — el frontend no envía
 * ningún id de comercial/delegación.
 */
@Injectable({ providedIn: 'root' })
export class AssignedClientsService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/energy-expert/clientes`;

  list(filters: AssignedClientFilters = {}): Observable<AssignedClientsPageResponse> {
    const params = new HttpParams()
      .set('page',     String(filters.page     ?? 1))
      .set('pageSize', String(filters.pageSize ?? 20));

    return this.http.get<AssignedClientsPageResponse>(this.base, { params });
  }
}
