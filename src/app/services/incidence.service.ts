import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type IncidenceType =
  | 'Facturacion'
  | 'CorteSuministro'
  | 'AltaBaja'
  | 'CambioTitular'
  | 'Reclamacion'
  | 'Otra';

export type IncidenceStatus = 'Abierta' | 'EnTramite' | 'Resuelta';

export const INCIDENCE_TYPES: IncidenceType[] = [
  'Facturacion', 'CorteSuministro', 'AltaBaja', 'CambioTitular', 'Reclamacion', 'Otra',
];

export const INCIDENCE_TYPE_LABELS: Record<IncidenceType, string> = {
  Facturacion:     'Facturación',
  CorteSuministro: 'Corte de suministro',
  AltaBaja:        'Alta/Baja',
  CambioTitular:   'Cambio de titular',
  Reclamacion:     'Reclamación',
  Otra:            'Otra',
};

export const INCIDENCE_STATUS_LABELS: Record<IncidenceStatus, string> = {
  Abierta:   'Abierta',
  EnTramite: 'En trámite',
  Resuelta:  'Resuelta',
};

export interface Incidence {
  id:               string;
  contratoExtId:    number;
  type:             IncidenceType;
  title:            string;
  description:      string;
  status:           IncidenceStatus;
  createdByUserId:  string;
  createdByName:    string | null;
  createdAt:        string;
  closedByUserId:   string | null;
  closedByName:     string | null;
  closedAt:         string | null;
  resolutionNote:   string | null;
}

export interface CreateIncidenceRequest {
  contratoExtId: number;
  type:          IncidenceType;
  title:         string;
  description:   string;
}

export interface CloseIncidenceRequest {
  resolutionNote?: string;
}

@Injectable({ providedIn: 'root' })
export class IncidenceService {
  private http = inject(HttpClient);

  listByContrato(contratoExtId: number): Observable<Incidence[]> {
    return this.http.get<Incidence[]>(
      `${environment.apiUrl}/incidences`,
      { params: { contratoExtId: String(contratoExtId) } },
    );
  }

  create(req: CreateIncidenceRequest): Observable<Incidence> {
    return this.http.post<Incidence>(`${environment.apiUrl}/incidences`, req);
  }

  close(id: string, req: CloseIncidenceRequest = {}): Observable<Incidence> {
    return this.http.patch<Incidence>(`${environment.apiUrl}/incidences/${id}/close`, req);
  }
}
