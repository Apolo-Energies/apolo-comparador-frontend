import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ContractDetail } from '../models/user-detail.model';
import { ContratosCards, ContratosPageResponse } from '../models/contrato.model';
import { ContratoIncidencia } from '../models/contrato-incidencia.model';
import { ServicioListItem } from '../models/servicio.model';
import {
  AltaRapidaResponse,
  EeMunicipio,
  EeTown,
  ServiciosPageResponse,
} from '../models/energy-expert.model';

@Injectable({ providedIn: 'root' })
export class ContractService {
  private http = inject(HttpClient);

  createManual(data: { customerId: string; origin: number }) {
    return this.http.post<ContractDetail>(`${environment.apiUrl}/contracts`, data);
  }

  send(customerId: string) {
    return this.http.post(`${environment.apiUrl}/contracts/renew`, { customerId });
  }

  getMyPreview(): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/contracts/my-preview`, { responseType: 'blob' });
  }

  getPreviewById(contractId: string): Observable<Blob> {
    return this.http.get(`${environment.apiUrl}/contracts/${contractId}/preview`, { responseType: 'blob' });
  }

  requestSignature(userId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contracts/request-signature`, { userId });
  }

  validateContract(contractId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contracts/${contractId}/validate`, {});
  }

  rejectContract(contractId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contracts/${contractId}/reject`, { reason });
  }

  sendContract(contractId: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/contracts/${contractId}/send`, {});
  }

  /**
   * Todos los servicios asociados a un cliente (por IdCliente). Usa el endpoint
   * delegated-filtered `GET /servicios` con match exacto en memoria contra el
   * cache del backend. Evita el filtro tipado de EE, que responde 500 para
   * ciertos campos en Servicios.
   */
  getServiciosByCliente(idCliente: number, limit = 100): Observable<ServicioListItem[]> {
    const httpParams = new HttpParams()
      .set('idCliente', String(idCliente))
      .set('limit',     String(limit));

    return this.http.get<ServiciosPageResponse>(
      `${environment.apiUrl}/energy-expert/servicios`,
      { params: httpParams },
    ).pipe(map(res => res?.data ?? []));
  }

  enviarFirma(idContratoServicio: number): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/energy-expert/firma/enviar`,
      {},
      { params: { idContratoServicio: String(idContratoServicio) } },
    );
  }

  altaRapida(formData: FormData): Observable<AltaRapidaResponse> {
    return this.http.post<AltaRapidaResponse>(
      `${environment.apiUrl}/energy-expert/alta-rapida`,
      formData,
    );
  }

  getMunicipios(idProvincia: number): Observable<EeMunicipio[]> {
    return this.http.get<EeMunicipio[]>(
      `${environment.apiUrl}/energy-expert/towns`,
      { params: new HttpParams().set('idProvincia', idProvincia).set('limit', '500') },
    );
  }

  getProvinces(idProvincia: number): Observable<EeTown[]> {
    return this.http.get<EeTown[]>(
      `${environment.apiUrl}/energy-expert/provinces`,
      { params: new HttpParams().set('idProvincia', idProvincia).set('limit', '100') },
    );
  }

  getTowns(idProvincia: string): Observable<EeTown[]> {
    return this.http.post<EeTown[]>(
      `${environment.apiUrl}/energy-expert/towns`,
      {},
      { params: new HttpParams().set('idProvincia', idProvincia).set('limit', '500') },
    );
  }

  getContratoArchivo(idArchivo: number): Observable<Blob> {
    return this.http.get(
      `${environment.apiUrl}/energy-expert/archivo/${idArchivo}`,
      { responseType: 'blob' },
    );
  }

  getContratos(params: {
    filter?:   string;
    orderBy?:  string;
    offset?:   number;
    limit?:    number;
    estado?:   string;
    faltante?: string;
  }): Observable<ContratosPageResponse> {
    let httpParams = new HttpParams()
      .set('filter',  params.filter  ?? '')
      .set('orderBy', params.orderBy ?? 'NombreCliente')
      .set('offset',  String(params.offset  ?? 0))
      .set('limit',   String(params.limit   ?? 10));
    if (params.estado)   httpParams = httpParams.set('estado',   params.estado);
    if (params.faltante) httpParams = httpParams.set('faltante', params.faltante);

    return this.http.get<ContratosPageResponse>(
      `${environment.apiUrl}/energy-expert/contratos`,
      { params: httpParams },
    );
  }

  getIncidencias(): Observable<ContratoIncidencia[]> {
    return this.http.get<ContratoIncidencia[]>(`${environment.apiUrl}/energy-expert/incidencias`);
  }

  uploadAnexo(contratoId: string, file: File, descripcion?: string): Observable<unknown> {
    const form = new FormData();
    form.append('file', file, file.name);
    if (descripcion) form.append('descripcion', descripcion);
    return this.http.post(`${environment.apiUrl}/energy-expert/contratos/${contratoId}/anexos`, form);
  }

  toggleValidado(contratoId: string): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/energy-expert/contratos/${contratoId}/validado`, {});
  }

  patchCliente(clienteId: string, patch: Record<string, string | null>): Observable<unknown> {
    return this.http.patch(`${environment.apiUrl}/energy-expert/clientes/${clienteId}`, patch);
  }

  getContratosCards(idDelegacion: number | null): Observable<ContratosCards> {
    let params = new HttpParams();
    if (idDelegacion != null) params = params.set('idDelegacion', String(idDelegacion));

    return this.http.get<ContratosCards>(
      `${environment.apiUrl}/energy-expert/portal/contratos-cards`,
      { params },
    );
  }
}
