import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ContractDetail } from '../entities/user-detail.model';
import { ContratoListItem } from '../entities/contrato.model';
import { ServicioListItem } from '../entities/servicio.model';

export interface EeTown {
  id:     string;
  nombre: string;
  cp?:    string;
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

  getServicios(params: {
    filter?:  string;
    orderBy?: string;
    offset?:  number;
    limit?:   number;
  }): Observable<ServicioListItem[]> {
    const httpParams = new HttpParams()
      .set('filter',  params.filter  ?? '')
      .set('orderBy', params.orderBy ?? 'Id')
      .set('offset',  String(params.offset  ?? 0))
      .set('limit',   String(params.limit   ?? 10));

    return this.http.post<ServicioListItem[]>(
      `${environment.apiUrl}/energy-expert/services`,
      {},
      { params: httpParams },
    );
  }

  quickRegistration(fields: QuickRegistrationFields): Observable<unknown> {
    return this.http.post(
      `${environment.apiUrl}/energy-expert/quick-registration`,
      { fields },
    );
  }

  getTowns(idProvincia: string): Observable<EeTown[]> {
    return this.http.post<EeTown[]>(
      `${environment.apiUrl}/energy-expert/towns`,
      {},
      { params: new HttpParams().set('idProvincia', idProvincia).set('limit', '500') },
    );
  }

  getContratos(params: {
    filter?:  string;
    orderBy?: string;
    offset?:  number;
    limit?:   number;
  }): Observable<ContratoListItem[]> {
    const httpParams = new HttpParams()
      .set('filter',  params.filter  ?? '')
      .set('orderBy', params.orderBy ?? 'NombreCliente')
      .set('offset',  String(params.offset  ?? 0))
      .set('limit',   String(params.limit   ?? 10));

    return this.http.post<ContratoListItem[]>(
      `${environment.apiUrl}/energy-expert/contracts`,
      {},
      { params: httpParams },
    );
  }
}
