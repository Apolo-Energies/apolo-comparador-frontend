import { ComparadorFormValue, ComparadorResult, OcrResult } from '../../../../core/models/comparator.model';

/** Item de una factura dentro del flujo de comparación múltiple. */
export interface MultiItem {
  id:        string;
  file:      File;
  fileName:  string;
  status:    'ready' | 'error';
  ocrResult: OcrResult | null;
  result:    ComparadorResult | null;
  form:      ComparadorFormValue;
  fileId:    string;
  error:     string | null;
}

export function formatFileSize(file: File): string {
  const kb = file.size / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function getCups(ocr: OcrResult | null): string {
  return ocr?.cliente?.cups ?? '';
}

export function truncateValue(v: number): number {
  return Math.trunc(v);
}

export function getPrecioEnergia(
  periodos: { periodo: number | string; precioEnergiaOferta?: number }[],
  p: number,
): string {
  const found = periodos.find(x => Number(x.periodo) === p);
  return found ? (found.precioEnergiaOferta?.toFixed(6) ?? '0,000000') : '0,000000';
}

export function getPrecioPotencia(
  periodos: { periodo: number | string; precioPotenciaOferta?: number }[],
  p: number,
): string {
  const found = periodos.find(x => Number(x.periodo) === p);
  return found ? (found.precioPotenciaOferta?.toFixed(6) ?? '0,000000') : '0,000000';
}

export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyComparadorForm(): ComparadorFormValue {
  return { tariff: '', producto: '', precioMedio: 0, feeEnergia: 0, feePotencia: 0, comisionEnergia: 0 };
}

export function detectTariff(ocr: OcrResult, availableTariffs: string[]): string {
  const ocrTariff = ocr.contrato?.tarifa ?? '';
  return availableTariffs.includes(ocrTariff) ? ocrTariff : (availableTariffs[0] ?? '');
}
