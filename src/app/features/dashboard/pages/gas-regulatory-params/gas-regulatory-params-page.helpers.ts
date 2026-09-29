import { GasRegulatoryParams } from '../../../../core/models/gas-regulatory-params.model';

export type DialogMode = 'create' | 'close';

export interface FormState {
  fnee: number | null;
  storage: number | null;
  lossesPercentage: number | null;
  financialCostPercentage: number | null;
  deviation: number | null;
  marketTaxPercentage: number | null;
  managementCost: number | null;
  mibgasOverrideEurPerMwh: number | null;
  validFrom: string;
  validTo: string;
}

// Inline edit shows percentages as 0-100 (matches column headers) instead of
// the 0-1 fractions stored in the domain — we convert on save.
export interface InlineEditForm {
  fnee: number | null;
  storage: number | null;
  lossesPercent: number | null;
  financialCostPercent: number | null;
  deviation: number | null;
  marketTaxPercent: number | null;
  managementCost: number | null;
  mibgasOverrideEurPerMwh: number | null;
}

export function emptyForm(): FormState {
  return {
    fnee: null,
    storage: null,
    lossesPercentage: null,
    financialCostPercentage: null,
    deviation: null,
    marketTaxPercentage: null,
    managementCost: null,
    mibgasOverrideEurPerMwh: null,
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: '',
  };
}

export function emptyInlineForm(): InlineEditForm {
  return {
    fnee: null,
    storage: null,
    lossesPercent: null,
    financialCostPercent: null,
    deviation: null,
    marketTaxPercent: null,
    managementCost: null,
    mibgasOverrideEurPerMwh: null,
  };
}

export function toPercent(fraction: number): number {
  return Math.round(fraction * 100 * 10000) / 10000;
}

export function fromPercent(percent: number): number {
  return Math.round(percent / 100 * 1_000_000) / 1_000_000;
}

export function isActiveParams(row: GasRegulatoryParams): boolean {
  return row.validTo == null;
}

export function errorMessageOf(err: unknown): string {
  const anyErr = err as { error?: { error?: string }, message?: string };
  return anyErr?.error?.error ?? anyErr?.message ?? 'Error desconocido';
}
