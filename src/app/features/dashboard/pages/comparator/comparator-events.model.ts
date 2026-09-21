// Tipos 100% UI del comparador (payloads de eventos de componentes).
// No viajan al backend — los contratos de API/OCR y el resultado de cálculo
// viven en core/models/comparator.model.ts.

import { ComparadorFormValue } from '../../../../core/models/comparator.model';

export interface ComparadorCompareEvent {
  file:   File;
  userId: string;
}

export interface ComparadorDownloadEvent {
  type:      'pdf' | 'excel';
  formValue: ComparadorFormValue;
}
