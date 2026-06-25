export interface GasAccessTariff {
  id: number;
  code: string;
  minAnnualKwh: number;
  maxAnnualKwh: number | null;
  fixedTermPerYear: number;
  atrVariable: number;
  /** FEE margen comercial sobre el Fijo anual (decimal: 1.00 = 100%, 0.40 = 40%, ...) */
  commercialMarginPercentage: number;
  validFrom: string;
  validTo: string | null;
}

export interface CreateGasAccessTariffPayload {
  code: string;
  minAnnualKwh: number;
  maxAnnualKwh: number | null;
  fixedTermPerYear: number;
  atrVariable: number;
  commercialMarginPercentage: number;
  validFrom: string;
  validTo: string | null;
}

export interface UpdateGasAccessTariffPricesPayload {
  fixedTermPerYear: number;
  atrVariable: number;
}

export interface UpdateGasAccessTariffMarginPayload {
  commercialMarginPercentage: number;
}

export interface CloseGasAccessTariffPayload {
  validTo: string;
}
