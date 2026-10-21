import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

// Tipo del registro local (EstadoRechazo del backend): 'activo' = documentación pendiente.
export type TramitacionTipo = 'rechazado' | 'incidencia' | 'activo';
export type TramitacionCierre = 'resuelta' | 'ko' | 'gestionado';

export const TRAMITACION_TIPO_LABELS: Record<TramitacionTipo, string> = {
  activo:     'Falta documentación',
  incidencia: 'Incidencia',
  rechazado:  'Rechazo',
};

/** Estados de EE que cuentan como "en tramitación", en el orden en que se muestran. */
export const ESTADOS_TRAMITACION = [
  'incidencia', 'para_tramitar', 'para_estudio', 'para_firma', 'previo', 'valido', 'ko',
] as const;

export interface TramitacionDocumento {
  id:            string;
  nombreArchivo: string;
  tamanio:       number;
  subidoEn:      string;
}

/** Lo que Operaciones registró en el portal y los documentos que subió el colaborador. */
export interface TramitacionRegistro {
  id:                     string;
  tipo:                   TramitacionTipo;
  /** null = pendiente del colaborador; 'tramitado_de_nuevo' = respondido, pendiente de revisar. */
  resultado:              string | null;
  desde:                  string;
  motivo:                 string | null;
  documentacionNecesaria: string | null;
  documentos:             TramitacionDocumento[];
}

/** Un contrato en tramitación (GET /energy-expert/tramitacion). El estado viene de Energy Expert. */
export interface TramitacionItem {
  idServicio:       number | null;
  clienteNombre:    string | null;
  clienteNif:       string | null;
  cups:             string | null;
  estadoContrato:   string | null;
  fechaEstado:      string | null;
  idDelegacion:     number | null;
  nombreDelegacion: string | null;
  registro:         TramitacionRegistro | null;
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

  getEnTramitacion(): Observable<TramitacionItem[]> {
    return this.http.get<TramitacionItem[]>(this.base);
  }

  crear(request: CrearTramitacionRequest): Observable<string> {
    return this.http.post<{ id: string }>(this.base, request).pipe(map(r => r.id));
  }

  /** Sube el documento que falta en el contrato; queda "tramitado de nuevo". */
  subirDocumento(idServicio: number, file: File): Observable<void> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<void>(`${this.base}/servicios/${idServicio}/documentos`, form);
  }

  /** URL firmada y temporal para abrir el documento. */
  getDocumentoUrl(registroId: string, documentoId: string): Observable<string> {
    return this.http.get<{ url: string }>(`${this.base}/${registroId}/documentos/${documentoId}`).pipe(map(r => r.url));
  }

  cerrar(registroId: string, resultado: TramitacionCierre): Observable<void> {
    return this.http.patch<void>(`${this.base}/${registroId}/cerrar`, { resultado });
  }
}
