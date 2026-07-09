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

/**
 * Parsea un nombre en formato español típico a (nombre, apellido1, apellido2).
 *
 * Soporta dos convenciones frecuentes en facturas y bases de datos:
 *   - "APELLIDO1 APELLIDO2, NOMBRE"  → formato oficial (con coma)
 *   - "NOMBRE APELLIDO1 APELLIDO2"   → formato conversacional (sin coma)
 *
 * Ejemplos:
 *   "MIRALLES ESPI, FRANCISCO JAVIER" → { firstName: "FRANCISCO JAVIER", lastName: "MIRALLES", secondLastName: "ESPI" }
 *   "JUAN GARCIA LOPEZ"               → { firstName: "JUAN", lastName: "GARCIA", secondLastName: "LOPEZ" }
 *   "MARIA PEREZ"                     → { firstName: "MARIA", lastName: "PEREZ", secondLastName: "" }
 */
function parseSpanishName(fullName: string): {
  firstName: string;
  lastName: string;
  secondLastName: string;
} {
  const clean = (fullName ?? '').trim();
  if (!clean) return { firstName: '', lastName: '', secondLastName: '' };

  if (clean.includes(',')) {
    const [surnamesRaw, nameRaw] = clean.split(',', 2).map(s => s.trim());
    const surnameTokens = surnamesRaw.split(/\s+/).filter(Boolean);
    return {
      firstName:      nameRaw ?? '',
      lastName:       surnameTokens[0] ?? '',
      secondLastName: surnameTokens.slice(1).join(' '),
    };
  }

  const tokens = clean.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return { firstName: tokens[0], lastName: '', secondLastName: '' };
  if (tokens.length === 2) return { firstName: tokens[0], lastName: tokens[1], secondLastName: '' };
  return {
    firstName:      tokens[0],
    lastName:       tokens[1],
    secondLastName: tokens.slice(2).join(' '),
  };
}

@Injectable({ providedIn: 'root' })
export class OfferRequestService {
  private http = inject(HttpClient);
  private base       = `${environment.apiUrl}/offer-requests`;
  private publicBase = `${environment.apiUrl}/public/offer-requests`;

  create(payload: CreateOfferRequestPayload, isPublic = false): Observable<CreateOfferRequestResponse> {
    const form = new FormData();

    form.append('PersonType', payload.personType);
    form.append('ClientNif',  payload.client.clientNif);

    // El backend espera CompanyName para empresa y FirstName+LastName+SecondLastName
    // para persona física. El formulario usa un único campo "Nombre / Razón Social",
    // así que aquí lo mapeamos al campo correcto según el PersonType.
    if (payload.personType === 'Company') {
      form.append('CompanyName', payload.client.clientName);
    } else {
      const parsed = parseSpanishName(payload.client.clientName);
      form.append('FirstName',      parsed.firstName);
      form.append('LastName',       parsed.lastName);
      form.append('SecondLastName', parsed.secondLastName);
    }

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
