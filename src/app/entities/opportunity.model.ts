/** Estados posibles de una oportunidad. Deben coincidir con el enum del backend. */
export enum OpportunityStatus {
  Pending     = 0, // Pendiente — recién creada, sin trabajar
  Negotiation = 1, // En negociación activa con el cliente
  Won         = 2, // Ganada — contrato cerrado (estado terminal, libera el CUPS)
  Lost        = 3, // Perdida — cliente rechazó, pero puede reactivarse
}

/** Datos del cliente extraídos del OCR de la factura. */
export interface OpportunityClient {
  name?:       string | null;
  nif?:        string | null;
  address?:    string | null;
  postalCode?: string | null;
  province?:   string | null;
}

/** Colaborador que creó la oportunidad. */
export interface OpportunityCreator {
  id:       string;
  fullName: string;
  email:    string;
}

/**
 * Resumen de una oportunidad para el listado y el tablero Kanban.
 * lastAnnualConsumption se muestra como chip (kWh) en la tarjeta.
 */
export interface OpportunitySummary {
  id:                    string;
  cups:                  string;
  tariff:                string | null;
  status:                OpportunityStatus;
  client:                OpportunityClient;
  comparisonsCount:      number;
  createdBy:             OpportunityCreator | null;
  createdAt:             string;
  updatedAt:             string;
  lastAnnualConsumption: number | null; // kWh del último historial con consumo
}

/**
 * Fila del historial de comparaciones dentro del detalle de una oportunidad.
 * hasPdfSnapshot indica si se puede descargar el PDF de esa comparación.
 */
export interface ComparisonHistoryRow {
  id:                string;
  fileId:            string;
  createdAt:         string;
  userId:            string;
  userFullName:      string | null;
  userEmail:         string | null;
  product:           string | null;
  omieAveragePrice:  number | null; // Precio medio OMIE (€/kWh)
  energyFee:         number | null; // Término de energía ofertado
  powerFee:          number | null; // Término de potencia ofertado
  energyCommission:  number | null; // Comisión sobre energía
  commissionAmount:  number | null; // Importe total de comisión (€)
  monthlySavings:    number | null; // Ahorro mensual estimado (€)
  annualSavings:     number | null; // Ahorro anual estimado (€)
  savingsPercent:    number | null; // Porcentaje de ahorro
  annualConsumption: number | null; // Consumo anual del punto de suministro (kWh)
  hasPdfSnapshot:    boolean;       // true si hay PDF disponible para descargar
}

/** Detalle completo de una oportunidad: resumen + comparaciones paginadas. */
export interface OpportunityDetail {
  summary:          OpportunitySummary;
  page:             number;
  pageSize:         number;
  totalComparisons: number;
  totalPages:       number;
  comparisons:      ComparisonHistoryRow[];
}

/** Respuesta paginada del listado de oportunidades. */
export interface OpportunityPaged {
  items:       OpportunitySummary[];
  currentPage: number;
  pageSize:    number;
  totalCount:  number;
  totalPages:  number;
}

/** Respuesta paginada del historial de comparaciones de una oportunidad. */
export interface ComparisonsPaged {
  items:       ComparisonHistoryRow[];
  currentPage: number;
  pageSize:    number;
  totalCount:  number;
  totalPages:  number;
}

/** Filtros para buscar oportunidades. Todos los campos son opcionales. */
export interface OpportunityFilters {
  cups?:              string;
  status?:            OpportunityStatus;
  startDate?:         string;
  endDate?:           string;
  clientName?:        string;
  clientNif?:         string;
  createdByFullName?: string;
  createdByEmail?:    string;
  searchTerm?:        string; // Búsqueda libre: CUPS, nombre o NIF del cliente
  page?:              number;
  pageSize?:          number;
}

/** Etiquetas en español para mostrar en la UI según el estado. */
export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatus, string> = {
  [OpportunityStatus.Pending]:     'Pendiente',
  [OpportunityStatus.Negotiation]: 'Negociación',
  [OpportunityStatus.Won]:         'Ganada',
  [OpportunityStatus.Lost]:        'Perdida',
};

/**
 * Define a qué estados puede pasar una oportunidad desde cada estado.
 * Se usa para mostrar solo los botones de transición válidos en el drawer.
 */
export const OPPORTUNITY_ALLOWED_TRANSITIONS: Record<OpportunityStatus, OpportunityStatus[]> = {
  [OpportunityStatus.Pending]:     [OpportunityStatus.Negotiation, OpportunityStatus.Lost],
  [OpportunityStatus.Negotiation]: [OpportunityStatus.Won, OpportunityStatus.Lost, OpportunityStatus.Pending],
  [OpportunityStatus.Won]:         [], // Terminal: no hay transiciones posibles
  [OpportunityStatus.Lost]:        [OpportunityStatus.Pending, OpportunityStatus.Negotiation],
};

/** Orden de las columnas en el tablero Kanban. */
export const OPPORTUNITY_STATUS_ORDER: readonly OpportunityStatus[] = [
  OpportunityStatus.Pending,
  OpportunityStatus.Negotiation,
  OpportunityStatus.Won,
  OpportunityStatus.Lost,
];

/**
 * Normaliza el estado de una oportunidad que puede llegar como número o string desde la API.
 * Necesario porque algunos endpoints devuelven el enum como string ("Pending") en lugar de número (0).
 */
export function parseOpportunityStatus(value: string | number | null | undefined): OpportunityStatus {
  if (typeof value === 'number') return value as OpportunityStatus;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const asNumber = Number(trimmed);
    if (!Number.isNaN(asNumber) && trimmed !== '') return asNumber as OpportunityStatus;
    const fromName = (OpportunityStatus as unknown as Record<string, number>)[trimmed];
    if (typeof fromName === 'number') return fromName as OpportunityStatus;
  }
  return OpportunityStatus.Pending;
}
