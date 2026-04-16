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
  descuentos?: Array<{ importe?: number; descripcion?: string }>;
  totales_electricidad?: {
    energia?:  { activa?: number; reactiva?: number };
    potencia?: { contratada?: number; exceso?: number };
  };
  ie?:  { importe?: number };
  iva?: { importe?: number };
}

// ── Form value emitted on each change ─────────────────────────────────────────

export interface ComparadorFormValue {
  tariff:            string;
  producto:          string;
  precioMedio:       number;
  feeEnergia:        number;
  feePotencia:       number;
  comisionEnergia:   number;
  willCloseContract?: boolean;
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
}

// ── Component-level types ──────────────────────────────────────────────────────

export interface ComparadorUser {
  id:   string;
  name: string;
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
