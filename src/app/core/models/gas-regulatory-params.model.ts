export interface GasRegulatoryParams {
  id: number;
  fnee: number;
  storage: number;
  lossesPercentage: number;
  financialCostPercentage: number;
  deviation: number;
  marketTaxPercentage: number;
  managementCost: number;
  mibgasOverrideEurPerMwh: number | null;
  validFrom: string;
  validTo: string | null;
}

export interface CreateGasRegulatoryParamsPayload {
  fnee: number;
  storage: number;
  lossesPercentage: number;
  financialCostPercentage: number;
  deviation: number;
  marketTaxPercentage: number;
  managementCost: number;
  mibgasOverrideEurPerMwh: number | null;
  validFrom: string;
  validTo: string | null;
}

export interface CloseGasRegulatoryParamsPayload {
  validTo: string;
}

export interface UpdateGasRegulatoryParamsPayload {
  fnee: number;
  storage: number;
  lossesPercentage: number;
  financialCostPercentage: number;
  deviation: number;
  marketTaxPercentage: number;
  managementCost: number;
  mibgasOverrideEurPerMwh: number | null;
}
