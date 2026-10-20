import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

// Debe coincidir con EstadoRechazo del backend: 'activo' = documentación pendiente.
export type TramitacionTipo = 'rechazado' | 'incidencia' | 'activo';
export type TramitacionCierre = 'resuelta' | 'ko' | 'gestionado';

export const TRAMITACION_TIPO_LABELS: Record<TramitacionTipo, string> = {
  activo:     'Falta documentación',
  incidencia: 'Incidencia',
  rechazado:  'Rechazo',
};

export interface TramitacionDocumento {
  id:            string;
  nombreArchivo: string;
  tamanio:       number;
  subidoEn:      string;
}

/** Lo que le falta a un contrato en tramitación (GET /energy-expert/tramitacion). */
export interface TramitacionItem {
  id:                     string;
  idServicio:             number | null;
  clienteNombre:          string | null;
  clienteNif:             string | null;
  cups:                   string | null;
  tipo:                   TramitacionTipo;
  /** null = pendiente del colaborador; 'tramitado_de_nuevo' = respondido, pendiente de revisar. */
  resultado:              string | null;
  desde:                  string;
  fechaEstado:            string | null;
  motivo:                 string | null;
  documentacionNecesaria: string | null;
  idDelegacion:           number | null;
  nombreDelegacion:       string | null;
  documentos:             TramitacionDocumento[];
}

export interface CrearTramitacionRequest {
  idServicio:             number;
  tipo:                   TramitacionTipo;
  motivo?:                string;
  documentacionNecesaria?: string;
}

@Injectable({ providedIn: 'root' })
export class TramitacionService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/energy-expert/tramitacion`;

  getAbiertos(): Observable<TramitacionItem[]> {
    return this.http.get<TramitacionItem[]>(this.base);
  }

  crear(request: CrearTramitacionRequest): Observable<string> {
    return this.http.post<{ id: string }>(this.base, request).pipe(map(r => r.id));
  }

  subirDocumento(id: string, file: File): Observable<void> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<void>(`${this.base}/${id}/documentos`, form);
  }

  /** URL firmada y temporal para abrir el documento. */
  getDocumentoUrl(id: string, documentoId: string): Observable<string> {
    return this.http.get<{ url: string }>(`${this.base}/${id}/documentos/${documentoId}`).pipe(map(r => r.url));
  }

  cerrar(id: string, resultado: TramitacionCierre): Observable<void> {
    return this.http.patch<void>(`${this.base}/${id}/cerrar`, { resultado });
  }
}
