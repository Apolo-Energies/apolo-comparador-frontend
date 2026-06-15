export interface GasAccessTariff {
  id: number;
  code: string;
  minAnnualKwh: number;
  maxAnnualKwh: number | null;
  fixedTermPerYear: number;
  atrVariable: number;
  validFrom: string;
  validTo: string | null;
}

export interface CreateGasAccessTariffPayload {
  code: string;
  minAnnualKwh: number;
  maxAnnualKwh: number | null;
  fixedTermPerYear: number;
  atrVariable: number;
  validFrom: string;
  validTo: string | null;
}

export interface UpdateGasAccessTariffPricesPayload {
  fixedTermPerYear: number;
  atrVariable: number;
}

export interface CloseGasAccessTariffPayload {
  validTo: string;
}
