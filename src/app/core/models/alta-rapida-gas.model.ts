export type AltaRapidaPersonType = 'natural_person' | 'legal_entity';

export interface AltaRapidaContractParam {
  code:  string;
  name:  string;
  value: string;
}

/** Body de POST /quixotic/alta-rapida — crea cuenta + punto de suministro + contrato en una sola llamada. */
export interface AltaRapidaGasRequest {
  fullName:       string;
  personType:     AltaRapidaPersonType;
  documentNumber: string;
  documentType?:  string | null;
  email?:         string | null;
  phoneNumber?:   string | null;
  cnae?:          string | null;

  billingAddressStreetType?:   string | null;
  billingAddressStreet?:       string | null;
  billingAddressNumber?:       string | null;
  billingAddressPostalCode?:   string | null;
  billingAddressCityName?:     string | null;
  billingAddressStateCode?:    string | null;
  billingAddressCountryCode?:  string | null;

  bankAccountNumber?:  string | null;

  cups:             string;
  supplyPointName:  string;
  contractCode?:    string | null;

  productId?:              string | null;
  /** Grupo tarifario de acceso de gas: "R1" (residencial) a "R8" (industrial alto). */
  contractAtrRate?:        string | null;
  /** Caudal anual, kWh/año. */
  contractQa?:             number | null;
  /** Caudal diario — opcional, casi nunca se envía. */
  contractQd?:             number | null;
  /** "A" (cuanto antes) es el único valor usado en la práctica; "F"/"L" existen pero no se usan. */
  activationType?:         string | null;

  contractParams?: AltaRapidaContractParam[] | null;
}

export interface AltaRapidaGasResponse {
  accountId:              string;
  accountWasExisting:     boolean;
  paymentMethodId:        string | null;
  supplyPointId:          string;
  supplyPointWasExisting: boolean;
  contractId:             string;
  contractedProductId:    string | null;
  warnings:               string[];
}

/** Cuerpo del 502 cuando Quixotic falla a mitad del alta. */
export interface AltaRapidaGasErrorBody {
  error:   string;
  step?:   string;
  partial?: Record<string, unknown>;
}
