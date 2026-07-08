export interface GasRegulatoryParams {
  id: number;
  fnee: number;
  storage: number;
  lossesPercentage: number;
  financialCostPercentage: number;
  validFrom: string;
  validTo: string | null;
}

export interface CreateGasRegulatoryParamsPayload {
  fnee: number;
  storage: number;
  lossesPercentage: number;
  financialCostPercentage: number;
  validFrom: string;
  validTo: string | null;
}

export interface CloseGasRegulatoryParamsPayload {
  validTo: string;
}
