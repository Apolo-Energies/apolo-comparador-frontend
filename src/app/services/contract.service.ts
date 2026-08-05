import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ContractDetail } from '../entities/user-detail.model';
import { ContratosPageResponse } from '../entities/contrato.model';
import { ServicioListItem } from '../entities/servicio.model';

interface ServiciosPageResponse {
  page:     number;
  pageSize: number;
  total:    number;
  data:     ServicioListItem[];
}

export interface EeTown {
  IdProvincia: number;
  Nombre:      string;
}

export interface EeMunicipio {
  IdPoblacion: number;
  Nombre:      string;
  IdProvincia: number;
}

export interface AltaRapidaRequest {
  nifCliente:            string;
  nombreCliente:         string;
  apellido1Cliente:      string;
  apellido2Cliente?:     string;
  email:                 string;
  telefono:              string;
  iban?:                 string;
  swift?:                string;
  direccionCliente:      string;
  cpCliente:             string;
  idProvinciaCliente:    number;
  idPoblacionCliente:    number;
  cups:                  string;
  tarifa:                string;
  cnae?:                 string;
  nifTitular?:           string;
  nombreTitular?:        string;
  direccionSuministro?:  string;
  cpSuministro?:         string;
  idProvinciaSuministro?: number;
  idPoblacionSuministro?: number;
  potenciaP1?: string; potenciaP2?: string; potenciaP3?: string;
  potenciaP4?: string; potenciaP5?: string; potenciaP6?: string;
  consumoAnualP1?: string; consumoAnualP2?: string; consumoAnualP3?: string;
  consumoAnualP4?: string; consumoAnualP5?: string; consumoAnualP6?: string;
}

export interface AltaRapidaResponse {
  success:             boolean;
  message:             string;
  statusCode:          number;
  idContratoServicio?: number;
}

export interface QuickRegistrationFields {
  // Cliente
  NombrePilaCliente:    string;
  Apellido1Cliente:     string;
  Apellido2Cliente:     string;
  NIFCliente:           string;
  DireccionCliente:     string;
  CPCliente:            string;
  IdProvinciaCliente:   string;
  IdPoblacionCliente:   string;
  Email:                string;
  Telefono:             string;
  // Suministro
  CUPS:                    string;
  DireccionSuministro:     string;
  CPSuministro:            string;
  IdProvinciaSuministro:   string;
  IdPoblacionSuministro:   string;
  IdTarifaSuministro:      string;
  // Potencias
  PotenciaP1: string; PotenciaP2: string; PotenciaP3: string;
  PotenciaP4: string; PotenciaP5: string; PotenciaP6: string;
  // Consumos anuales
  ConsumoAnualP1: string; ConsumoAnualP2: string; ConsumoAnualP3: string;
  ConsumoAnualP4: string; ConsumoAnualP5: string; ConsumoAnualP6: string;
  // Titular
  NombreTitular: string;
  NIFTitular:    string;
  // Domiciliación
  CodigoCuentaDomiciliacion: string;
  CodigoSWIFTDomiciliacion:  string;
  // Firmante
  ChkOtroFirmante:    string;
  swFirmante:         string;
  NombrePilaFirmante: string;
  Apellido1Firmante:  string;
  Apellido2Firmante:  string;
  NIFFirmante:        string;
  EmailFirmante:      string;
  TelefonoFirmante:   string;
  // Otros
  CNAE:      string;
  IdCli:     string;
  Callback:  string;
  secondary: string;
}

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

  quickRegistration(fields: QuickRegistrationFields): Observable<unknown> {
    return this.http.post(
      `${environment.apiUrl}/energy-expert/quick-registration`,
      { fields },
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
    filter?:  string;
    orderBy?: string;
    offset?:  number;
    limit?:   number;
  }): Observable<ContratosPageResponse> {
    const httpParams = new HttpParams()
      .set('filter',  params.filter  ?? '')
      .set('orderBy', params.orderBy ?? 'NombreCliente')
      .set('offset',  String(params.offset  ?? 0))
      .set('limit',   String(params.limit   ?? 10));

    return this.http.get<ContratosPageResponse>(
      `${environment.apiUrl}/energy-expert/contratos`,
      { params: httpParams },
    );
  }
}
