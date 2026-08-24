import { Injectable, signal } from '@angular/core';
import { AltaRapidaGasResponse, AltaRapidaPersonType } from '../../../../../../entities/alta-rapida-gas.model';

/** Borrador del wizard: todo en string para que los inputs mapeen 1:1; se tipa/convierte al enviar. */
export interface AltaRapidaGasDraft {
  fullName:       string;
  personType:     AltaRapidaPersonType;
  documentNumber: string;
  documentType:   string;
  email:          string;
  phoneNumber:    string;
  cnae:           string;

  billingAddressStreetType:  string;
  billingAddressStreet:      string;
  billingAddressNumber:      string;
  billingAddressPostalCode:  string;
  billingAddressCityName:    string;
  billingAddressStateCode:   string;

  paymentMethodType: string;
  bankAccountNumber: string;
  bankName:          string;

  cups:            string;
  supplyPointName: string;

  contractName:      string;
  contractCode:      string;
  contractStartDate: string;
  contractDuration:  string;
  invoiceDueDays:    string;

  productId:               string;
  contractAtrRate:         string;
  contractQa:              string;
  contractQd:              string;
  contractQh:              string;
  activationType:          string;
  expectedActivationDate:  string;
  /** JSON crudo opcional; se valida/parsea en la revisión. */
  contractParamsJson: string;
}

export const EMPTY_ALTA_RAPIDA_GAS_DRAFT: AltaRapidaGasDraft = {
  fullName:       '',
  personType:     'natural_person',
  documentNumber: '',
  documentType:   'NIF',
  email:          '',
  phoneNumber:    '',
  cnae:           '',

  billingAddressStreetType:  'CL',
  billingAddressStreet:      '',
  billingAddressNumber:      '',
  billingAddressPostalCode:  '',
  billingAddressCityName:    '',
  billingAddressStateCode:   '',

  paymentMethodType: '',
  bankAccountNumber: '',
  bankName:          '',

  cups:            '',
  supplyPointName: '',

  contractName:      '',
  contractCode:      '',
  contractStartDate: '',
  contractDuration:  '',
  invoiceDueDays:    '3',

  productId:              '',
  contractAtrRate:        'R1',
  contractQa:             '',
  contractQd:             '',
  contractQh:             '',
  activationType:         'A',
  expectedActivationDate: '',
  contractParamsJson:     '',
};

@Injectable({ providedIn: 'root' })
export class AltaRapidaGasStore {
  readonly draft  = signal<AltaRapidaGasDraft>({ ...EMPTY_ALTA_RAPIDA_GAS_DRAFT });
  readonly result = signal<AltaRapidaGasResponse | null>(null);

  update(patch: Partial<AltaRapidaGasDraft>): void {
    this.draft.update(d => ({ ...d, ...patch }));
  }

  setResult(result: AltaRapidaGasResponse | null): void {
    this.result.set(result);
  }

  reset(): void {
    this.draft.set({ ...EMPTY_ALTA_RAPIDA_GAS_DRAFT });
    this.result.set(null);
  }
}
