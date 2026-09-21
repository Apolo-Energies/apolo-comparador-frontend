// Tipos 100% UI del comparador de gas (payloads de eventos de componentes).
// No viajan al backend — los contratos de API/OCR viven en core/models/comparator-gas.model.ts.

export interface GasDownloadEvent {
  type: 'pdf' | 'excel';
}
