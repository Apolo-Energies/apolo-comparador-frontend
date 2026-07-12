// ── OCR result from backend ────────────────────────────────────────────────────

export interface OcrEnergiaPeriodo {
  p?:      number | string;
  activa?: {
    kwh?:    number;
    tarifa?: number;
    importe?: number;
  };
}

export interface OcrPotenciaPeriodo {
  contratada?: {
    kw?:      number;
    tarifa?:  number;
    importe?: number;
  };
}

export interface OcrResult {
  total?:   number;
  energia?:  OcrEnergiaPeriodo[];
  potencia?: OcrPotenciaPeriodo[];
  periodo_facturacion?: {
    numero_dias?:  number;
    fecha_inicio?: string;
    fecha_fin?:    string;
  };
  cliente?: {
    cups?:    string;
    titular?: string;
    nif?:     string;
    direccion?: {
      tipo_via?:   string;
      nombre_via?: string;
      numero?:     string;
      detalles?:   string;
      cp?:         string;
      provincia?:  string;
    };
  };
  contrato?: {
    tarifa?:                        string;
    nombre_comercializadora?:       string;
    numero_orden_comercializadora?: string;
    fecha_fin?:                     string;
  };
  descuentos?: Array<{
    importe?:       number;
    concepto?:      string;
    descripcion?:   string;
    base?:          number;
    porcentaje?:    number;
    afecta_a?:      string;
    en_base_ie?:    boolean;
    porcentaje_iva?: number;
  }>;
  totales_electricidad?: {
    energia?:  { activa?: number; reactiva?: number };
    potencia?: { contratada?: number; exceso?: number };
  };
  bono_social?:    { importe?: number; en_base_ie?: boolean };
  equipos?:        { importe?: number; en_base_ie?: boolean };
  otros_servicios?: Array<{ concepto?: string; importe?: number; en_base_ie?: boolean }>;
  ie?:  { base?: number; porcentaje?: number; importe?: number };
  iva?: { base?: number; porcentaje?: number; importe?: number };
}

// ── Form value emitted on each change ─────────────────────────────────────────

export enum FeeMode {
  Global  = 0,
  Periods = 1,
}

export interface ComparadorFormValue {
  tariff:            string;
  producto:          string;
  precioMedio:       number;
  feeEnergia:        number;
  feePotencia:       number;
  comisionEnergia:   number;
  willCloseContract?: boolean;

  // Modo del ajuste de fees. Si es 'periods', se usan los arrays por período
  // (longitud 6, uno por P1..P6). Si es 'global' o los arrays no existen, se
  // usa el valor global de feeEnergia / feePotencia.
  feeMode?:             FeeMode;
  feeEnergiaByPeriod?:  number[];
  feePotenciaByPeriod?: number[];
}

// ── Calculation result ─────────────────────────────────────────────────────────

export interface ComparadorPeriodo {
  periodo:              number | string;
  precioEnergiaOferta:  number;
  precioPotenciaOferta: number;
  costeEnergia:         number;
  costePotencia:        number;
}

export interface ComparadorResult {
  comision:       number;
  ahorroEstudio:  number;
  ahorroXAnio:    number;
  ahorro_porcent: number;
  periodos:       ComparadorPeriodo[];
  dias?:          number;

  // Calculated totals — used by buildReportPayload to keep PDF in sync with displayed numbers
  totalActual:              number;
  baseIEActual:             number;
  ieActual:                 number;
  extraSinIE:               number;
  costesComunesConIEActual: number;
  otrosNoComunesActual:     number;
  subTotalActual:           number;
  ivaActual:                number;

  totalOferta:              number;
  baseIEOferta:             number;
  ieOferta:                 number;
  subTotalOferta:           number;
  ivaOferta:                number;
}

// ── Component-level types ──────────────────────────────────────────────────────

export interface ComparadorUser {
  id:            string;
  name:          string;
  commissionPct: number | null;
}

export type ComparatorProductsByTariff = Record<string, string[]>;

export interface ComparadorCompareEvent {
  file:   File;
  userId: string;
}

export interface ComparadorDownloadEvent {
  type:      'pdf' | 'excel';
  formValue: ComparadorFormValue;
}
