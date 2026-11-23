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

/** Respuesta de GET /quixotic/contracts/{id}/document y de /quixotic/invoices/{id}/document */
export interface QuixoticContractDocument {
  fileName:    string;
  contentType: string | null;
  publicUrl:   string;
}

/** Detalle completo del contrato — GET /quixotic/contracts/{id}. Cliente y forma de pago inlineados. */
export interface QuixoticContractDetail {
  id:                         string;
  contractCode:              string | null;
  contractName:              string | null;
  contractStatus:            string | null;
  contractStatusReason:      string | null;
  contractType:              string | null;
  serviceType:               string | null;
  contractStartDate:         string | null;
  contractEndDate:           string | null;
  contractSignatureDate:     string | null;
  expectedContractStartDate: string | null;
  expectedContractEndDate:   string | null;
  createdDate:               string | null;
  lastModifiedDate:          string | null;
  contractDuration:          number | null;
  invoiceDueDays:            number | null;
  billingEmail:              string | null;
  billingCompanyId:          string | null;
  paymentTerms:              string | null;
  observations:              string | null;
  customerId:                string | null;
  supplyPointId:             string | null;
  customerFullName:          string | null;
  customerDocumentNumber:    string | null;
  customerDocumentType:      string | null;
  customerPersonType:        string | null;
  customerEmail:             string | null;
  customerPhoneNumber:       string | null;
  customerMobileNumber:      string | null;
  customerCnae:              string | null;
  paymentMethodId:           string | null;
  paymentMethodBankAccountNumber: string | null;
  paymentMethodBankName:     string | null;
  paymentMethodMandateCode:  string | null;
}

/** Factura de un contrato — GET /quixotic/contracts/{id}/invoices. */
export interface QuixoticInvoice {
  id:                      string;
  legalDocumentNumber:     string | null;
  invoiceStatus:           string | null;
  serviceType:             string | null;
  issuedDate:              string | null;
  dueDate:                 string | null;
  billingPeriodFrom:       string | null;
  billingPeriodTo:         string | null;
  totalAmount:             number | null;
  taxableBaseAmount:       number | null;
  taxAmount:               number | null;
  amountToPay:             number | null;
  pendingAmount:           number | null;
  billedTotalEnergyActive: number | null;
  pdfDocumentId:           string | null;
}
