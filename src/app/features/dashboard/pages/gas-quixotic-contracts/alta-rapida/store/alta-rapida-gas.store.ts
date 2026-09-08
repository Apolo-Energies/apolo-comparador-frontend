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

  bankAccountNumber: string;

  cups:            string;
  supplyPointName: string;
  contractCode:    string;

  productId:               string;
  contractAtrRate:         string;
  contractQa:              string;
  contractQd:              string;
  activationType:          string;
  /** JSON crudo opcional; debe parsear a un array [{code, name, value}]. Se valida en producto-activacion. */
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

  billingAddressStreetType:  'Calle',
  billingAddressStreet:      '',
  billingAddressNumber:      '',
  billingAddressPostalCode:  '',
  billingAddressCityName:    '',
  billingAddressStateCode:   '',

  bankAccountNumber: '',

  cups:            '',
  supplyPointName: '',
  contractCode:    '',

  productId:              '',
  contractAtrRate:        'R1',
  contractQa:             '',
  contractQd:             '',
  activationType:         'A',
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
