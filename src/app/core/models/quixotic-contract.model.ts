export type QuixoticServiceType = 'gas' | 'electricity' | 'others';

export const QUIXOTIC_CONTRACT_STATUSES = [
  'new',
  'active',
  'cancelled',
  'activation_process',
  'completed',
] as const;

export type QuixoticContractStatus = typeof QUIXOTIC_CONTRACT_STATUSES[number];

/** Contrato tal cual lo devuelve GET /quixotic/contracts — en camelCase. */
export interface QuixoticContract {
  id:                string;
  contractCode:      string | null;
  contractName:      string;
  contractStatus:    string;
  contractStartDate: string | null;
  supplyPointId:     string | null;
}

export interface QuixoticContractFilters {
  contractCode?:   string;
  contractStatus?: string;
  limit?:          number;
}

/** Body de POST /quixotic/contracts — este sí va en camelCase. */
export interface CreateQuixoticContractRequest {
  contractName:       string;
  customerId:         string;
  contractCode?:      string | null;
  serviceType?:       QuixoticServiceType | null;
  contractStartDate?: string | null;
  contractDuration?:  number | null;
  paymentMethodId?:   string | null;
  billingCompanyId?:  string | null;
  invoiceDueDays?:    number | null;
  supplyPointId?:     string | null;
}

export interface CreateQuixoticContractResponse {
  id:  string;
  raw: unknown;
}

/** Respuesta de GET /quixotic/contracts/{id}/document */
export interface QuixoticContractDocument {
  fileName:    string;
  contentType: string | null;
  publicUrl:   string;
}
