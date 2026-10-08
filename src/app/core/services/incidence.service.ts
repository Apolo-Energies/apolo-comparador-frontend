import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Debe coincidir con TipoCambio de Control; el .NET mapea PascalCase ↔ snake_case.
export type IncidenceType =
  | 'CambioPotencia'
  | 'CambioTitularidad'
  | 'CambioCuentaBancaria'
  | 'CambioOferta'
  | 'BajaPorCese'
  | 'ErrorFacturacion'
  | 'Otra';

export type IncidenceStatus = 'Abierta' | 'EnTramite' | 'Resuelta';

export const INCIDENCE_TYPES: IncidenceType[] = [
  'CambioPotencia',
  'CambioTitularidad',
  'CambioCuentaBancaria',
  'CambioOferta',
  'BajaPorCese',
  'ErrorFacturacion',
  'Otra',
];

export const INCIDENCE_TYPE_LABELS: Record<IncidenceType, string> = {
  CambioPotencia:       'Cambio de potencia',
  CambioTitularidad:    'Cambio de titularidad',
  CambioCuentaBancaria: 'Cambio de cuenta bancaria',
  CambioOferta:         'Cambio de oferta',
  BajaPorCese:          'Baja por cese',
  ErrorFacturacion:     'Error de facturación',
  Otra:                 'Otra',
};

export const INCIDENCE_STATUS_LABELS: Record<IncidenceStatus, string> = {
  Abierta:   'Abierta',
  EnTramite: 'En trámite',
  Resuelta:  'Gestionada',
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
  cups:            string;
  clienteNombre:   string;
  clienteNif?:     string | null;
  type:            IncidenceType;
  description:     string;
}

export interface CloseIncidenceRequest {
  resolutionNote?: string;
}

@Injectable({ providedIn: 'root' })
export class IncidenceService {
  private http = inject(HttpClient);

  listByCups(cups: string): Observable<Incidence[]> {
    return this.http.get<Incidence[]>(
      `${environment.apiUrl}/incidences`,
      { params: new HttpParams().set('cups', cups) },
    );
  }

  create(req: CreateIncidenceRequest): Observable<Incidence> {
    return this.http.post<Incidence>(`${environment.apiUrl}/incidences`, req);
  }

  close(id: string, req: CloseIncidenceRequest = {}): Observable<Incidence> {
    return this.http.patch<Incidence>(`${environment.apiUrl}/incidences/${id}/close`, req);
  }
}
