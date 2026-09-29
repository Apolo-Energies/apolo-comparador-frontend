// Tipos 100% UI del comparador (view-models derivados, no viajan al backend).
// Los contratos de API/OCR y el resultado de cálculo viven en core/models/comparator.model.ts.

export interface ComparadorUser {
  id:            string;
  name:          string;
  commissionPct: number | null;
}

export type ComparatorProductsByTariff = Record<string, string[]>;
