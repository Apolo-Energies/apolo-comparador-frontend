import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateOfferRequestPayload,
  CreateOfferRequestResponse,
  OfferRequestDocumentKey,
} from '../entities/offer-request.model';

const DOCUMENT_KEYS: OfferRequestDocumentKey[] = [
  'dniFront',
  'dniBack',
  'bankStatement',
  'incorporationDeed',
  'cifCertificate',
  'administratorDni',
];

const DOCUMENT_FIELD_NAMES: Record<OfferRequestDocumentKey, string> = {
  dniFront:          'DniFront',
  dniBack:           'DniBack',
  bankStatement:     'BankStatement',
  incorporationDeed: 'IncorporationDeed',
  cifCertificate:    'CifCertificate',
  administratorDni:  'AdministratorDni',
};

@Injectable({ providedIn: 'root' })
export class OfferRequestService {
  private http = inject(HttpClient);
  private base       = `${environment.apiUrl}/offer-requests`;
  private publicBase = `${environment.apiUrl}/public/offer-requests`;

  create(payload: CreateOfferRequestPayload, isPublic = false): Observable<CreateOfferRequestResponse> {
    const form = new FormData();

    form.append('PersonType', payload.personType);

    form.append('ClientNif',  payload.client.clientNif);
    form.append('ClientName', payload.client.clientName);
    form.append('Email',      payload.client.email);
    form.append('Phone',      payload.client.phone);

    form.append('Cups',          payload.supply.cups);
    form.append('SupplyAddress', payload.supply.supplyAddress);
    form.append('Cnae',          payload.supply.cnae);
    form.append('Province',      payload.supply.province);
    form.append('City',          payload.supply.city);
    form.append('PostalCode',    payload.supply.postalCode);

    if (payload.opportunityId) form.append('OpportunityId', payload.opportunityId);
    if (payload.tariff)        form.append('Tariff',        payload.tariff);
    if (payload.product)       form.append('Product',       payload.product);
    if (payload.landingSlug)   form.append('LandingSlug',   payload.landingSlug);

    for (const key of DOCUMENT_KEYS) {
      const file = payload.documents[key];
      if (file) form.append(DOCUMENT_FIELD_NAMES[key], file, file.name);
    }

    const url = isPublic ? this.publicBase : this.base;
    return this.http.post<CreateOfferRequestResponse>(url, form);
  }
}
