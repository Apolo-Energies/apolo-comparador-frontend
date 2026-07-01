// Modelo TS espejo del DTO C# GasOcrResultDto en el backend.
// Algunos sub-objetos (Cliente, Direccion, PeriodoFacturacion, Descuento, OtroServicio, IvaDetalle)
// son compatibles 1:1 con OcrResult de luz pero se redefinen aquí para evitar acoplar gas a luz.

export interface GasOcrCliente {
  tipo?:    string;
  titular?: string;
  iban?:    string;
  nif?:     string;
  cups?:    string;
  direccion?: GasOcrDireccion;
}

export interface GasOcrDireccion {
  tipo_via?:   string;
  nombre_via?: string;
  numero?:     string;
  detalles?:   string;
  cp?:         string;
  ciudad?:     string;
  provincia?:  string;
  ccaa?:       string;
}

export interface GasOcrContrato {
  tarifa?:                        string;  // R1..R6 o RL1..RL6
  modalidad?:                     string;
  nombre_comercializadora?:       string;
  numero_orden_comercializadora?: string;
  id_cuenta?:                     string;
  nombre_distribuidora?:          string;
  caudal_max?:                    number;
  tipo_cliente?:                  string;
  fecha_fin?:                     string;
  contrato_servicios?:            string;
}

export interface GasOcrPeriodoFacturacion {
  fecha_inicio?:         string;
  fecha_fin?:            string;
  numero_dias?:          number;
  cambio_precios?:       boolean;
  fecha_cambio_precios?: string;
}

export interface GasOcrConsumoLinea {
  fecha_inicio?: string;
  fecha_fin?:    string;
  kwh?:          number;
  precio_kwh?:   number;
  importe?:      number;
}

export interface GasOcrConsumo {
  equipo_medida_numero?:      string;
  lectura_anterior_m3?:       number;
  lectura_actual_m3?:         number;
  lectura_tipo?:              'real' | 'estimada' | string;
  consumo_m3?:                number;
  factor_correccion_volumen?: number;
  pcs?:                       number;
  factor_conversion?:         number;
  kwh_total?:                 number;
  importe_total?:             number;
  porcentaje_iva?:            number;
  lineas?:                    GasOcrConsumoLinea[];
}

export interface GasOcrDisponibilidadLinea {
  fecha_inicio?: string;
  fecha_fin?:    string;
  dias?:         number;
  precio_dia?:   number;
  importe?:      number;
}

export interface GasOcrDisponibilidad {
  dias_total?:     number;
  importe_total?:  number;
  porcentaje_iva?: number;
  lineas?:         GasOcrDisponibilidadLinea[];
}

export interface GasOcrTotales {
  consumo?:         number;
  disponibilidad?:  number;
  alquiler_equipo?: number;
  base_imponible?:  number;
}

export interface GasOcrServicioLinea {
  concepto?:     string;
  fecha_inicio?: string;
  fecha_fin?:    string;
  importe?:      number;
}

export interface GasOcrServicios {
  base_imponible?: number;
  iva_porcentaje?: number;
  iva_importe?:    number;
  total?:          number;
  lineas?:         GasOcrServicioLinea[];
}

export interface GasOcrDescuento {
  base?:           number;
  porcentaje?:     number;
  importe?:        number;
  concepto?:       string;
  afecta_a?:       string;
  en_base_ie?:     boolean;
  porcentaje_iva?: number;
}

export interface GasOcrOtroServicio {
  concepto?:       string;
  importe?:        number;
  en_base_ie?:     boolean;
  porcentaje_iva?: number;
}

export interface GasOcrConceptoFiscal {
  importe?:        number;
  en_base_ie?:     boolean;
  porcentaje_iva?: number;
}

export interface GasOcrIh {
  base_kwh?:       number;
  tasa?:           number;  // €/kWh
  porcentaje?:     number;  // alternativo si llega como %
  importe?:        number;
  porcentaje_iva?: number;
}

export interface GasOcrIvaLinea {
  tipo?:       string;
  base?:       number;
  porcentaje?: number;
  importe?:    number;
}

export interface GasOcrIva {
  detalle?:    GasOcrIvaLinea[];
  base?:       number;
  porcentaje?: number;
  importe?:    number;
}

export interface GasOcrRegulatorio {
  peajes_canones?: number;
  cargos?:         number;
  tasa_cnmc?:      number;
  cuota_gts?:      number;
}

export interface GasOcrResult {
  tipo_documento?:       string;
  cliente?:              GasOcrCliente;
  contrato?:             GasOcrContrato;
  fecha_emision?:        string;
  fecha_pago?:           string;
  periodo_facturacion?:  GasOcrPeriodoFacturacion;
  consumo?:              GasOcrConsumo;
  disponibilidad?:       GasOcrDisponibilidad;
  totales_gas?:          GasOcrTotales;
  servicios?:            GasOcrServicios;
  descuentos?:           GasOcrDescuento[];
  equipos?:              GasOcrConceptoFiscal;
  bono_social_termico?:  GasOcrConceptoFiscal;
  otros_servicios?:      GasOcrOtroServicio[];
  ih?:                   GasOcrIh;
  iva?:                  GasOcrIva;
  regulatorio?:          GasOcrRegulatorio;
  total?:                number;
}

// Respuesta del endpoint POST /files/upload-and-process-gas — envuelve el OCR
// con metadatos de archivo y la Opportunity creada.
export interface GasUploadResponse {
  fileId:        string;
  name:          string;
  url:           string;
  createdAt:     string;
  targetUserId?: string;
  opportunityId?: string;
  ocrData:       GasOcrResult;
}

// ── Formulario, productos y resultado del comparador ─────────────────────────

export interface GasFormValue {
  tariff:          string;  // R1..R6 o RL1..RL6
  producto:        string;
  feeEnergia:      number;  // €/MWh (similar a luz)
  feeFijo:         number;  // €/día sobre el término fijo
  comisionEnergia: number;  // comisión comercial (fija para snap o pct)
}

export interface GasProduct {
  name:          string;
  type:          'Fixed' | 'Indexed';
  precioEnergia: number;    // €/kWh base
  precioFijoDia: number;    // €/día base (término fijo)
  feeLocked:     boolean;   // si true, el comparador bloquea el fee
}

export type GasProductsByTariff = Record<string, GasProduct[]>;

export interface GasResult {
  comision:            number;
  ahorroEstudio:       number;   // ahorro mensual
  ahorroXAnio:         number;   // ahorro anualizado
  ahorro_porcent:      number;
  precioEnergiaOferta: number;   // €/kWh aplicado
  precioFijoOferta:    number;   // €/día aplicado
  totalActual:         number;
  totalOferta:         number;
  baseIvaOferta:       number;
  ivaImporteOferta:    number;
  dias:                number;
  kwhTotal:            number;
}

export interface GasCompareEvent {
  file:   File;
  userId: string;
}

export interface GasDownloadEvent {
  type:      'pdf' | 'excel';
  formValue: GasFormValue;
}
