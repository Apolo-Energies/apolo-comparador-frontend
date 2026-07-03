import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Delegation } from '../entities/delegation.model';

export interface DelegationsQuery {
  filter?:  string;
  orderBy?: string;
  offset?:  number;
  limit?:   number;
}

interface RawDelegation {
  Id:          number;
  Nombre?:      string;
  RazonSocial?: string;
  CIF?:         string;
  Direccion?:   string;
  Email?:       string;
  CP?:          string;
  IdProvincia?: number;
  Provincia?:   string;
}

@Injectable({ providedIn: 'root' })
export class DelegationsService {
  private readonly http = inject(HttpClient);

  list(query: DelegationsQuery = {}): Observable<Delegation[]> {
    let params = new HttpParams()
      .set('filter',  query.filter  ?? '')
      .set('orderBy', query.orderBy ?? 'Nombre')
      .set('offset',  String(query.offset ?? 0))
      .set('limit',   String(query.limit  ?? 20));

    return this.http
      .post<RawDelegation[] | { Result?: RawDelegation[] }>(
        `${environment.apiUrl}/energy-expert/delegations`,
        {},
        { params },
      )
      .pipe(map(res => normalize(res).map(toDelegation)));
  }
}

function normalize(res: RawDelegation[] | { Result?: RawDelegation[] } | unknown): RawDelegation[] {
  if (Array.isArray(res)) return res;
  const bag = res as { Result?: RawDelegation[]; Data?: RawDelegation[]; Items?: RawDelegation[] };
  return bag?.Result ?? bag?.Data ?? bag?.Items ?? [];
}

function toDelegation(raw: RawDelegation): Delegation {
  return {
    id:           raw.Id,
    name:         raw.Nombre        ?? '',
    businessName: raw.RazonSocial   ?? null,
    taxId:        raw.CIF           ?? null,
    address:      raw.Direccion     ?? null,
    email:        raw.Email         ?? null,
    postalCode:   raw.CP            ?? null,
    provinceId:   raw.IdProvincia   ?? null,
    province:     raw.Provincia     ?? null,
  };
}
