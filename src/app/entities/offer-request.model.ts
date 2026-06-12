export type OfferPersonType = 'Individual' | 'Company';

export interface OfferRequestClientData {
  clientNif:  string;
  clientName: string;
  email:      string;
  phone:      string;
}

export interface OfferRequestSupplyData {
  cups:          string;
  supplyAddress: string;
  cnae:          string;
  province:      string;
  city:          string;
  postalCode:    string;
}

export type OfferRequestDocumentKey =
  | 'dniFront'
  | 'dniBack'
  | 'bankStatement'
  | 'incorporationDeed'
  | 'cifCertificate'
  | 'administratorDni';

export type OfferRequestDocuments = Partial<Record<OfferRequestDocumentKey, File>>;

export interface CreateOfferRequestPayload {
  personType:    OfferPersonType;
  client:        OfferRequestClientData;
  supply:        OfferRequestSupplyData;
  documents:     OfferRequestDocuments;
  opportunityId?: string;
  tariff?:        string;
  product?:       string;
  landingSlug?:   string;
}

export enum OfferRequestStatus {
  Pending    = 0,
  Processing = 1,
  Completed  = 2,
  Cancelled  = 3,
}

export interface CreateOfferRequestResponse {
  id:                string;
  status:            OfferRequestStatus;
  createdAt:         string;
  documentsUploaded: number;
}
