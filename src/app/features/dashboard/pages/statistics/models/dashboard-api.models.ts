/** Usuario dentro de un registro de comparación */
export interface ComparisonUser {
  id:              string;
  fullName:        string;
  email:           string;
  phone:           string | null;
  isEnergyExpert:  boolean;
  isActive:        boolean;
  role:            string;
  providerId:      number;
  provider:        unknown | null;
  commissions:     unknown[];
}

/** Registro individual de comparación (history.items y by-id endpoint) */
export interface ComparisonDetailItem {
  id:                string;
  userId:            string;
  user:              ComparisonUser;
  fileId:            string;
  file:              unknown | null;
  cups:              string;
  annualConsumption: number;
  createdAt:         string;
  commissionAmount:  number | null;
  commissionPercent: number | null;
  monthlySavings:    number | null;
  annualSavings:     number | null;
  savingsPercent:    number | null;
}

/** Fila agregada por usuario (summary.data) */
export interface HistoryItem {
  userId:                 string;
  fullName:               string;
  email:                  string;
  totalCups:              number;
  totalAnnualConsumption: number;
}

export interface PaginatedHistory {
  items:           HistoryItem[];
  currentPage:     number;
  pageSize:        number;
  totalCount:      number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
}

/** Respuesta paginada del endpoint /comparison-history/by-id */
export interface PaginatedComparisonDetail {
  items:           ComparisonDetailItem[];
  currentPage:     number;
  pageSize:        number;
  totalCount:      number;
  totalPages:      number;
  hasPreviousPage: boolean;
  hasNextPage:     boolean;
}

export interface SummaryApiResult {
  data:                     HistoryItem[];
  totalCups:                number;
  totalAnnualConsumption:   number;
  totalUsersActive:         number;
  percentCups:              number;
  percentAnnualConsumption: number;
  percentUsersActive:       number;
}

export interface DailySummaryApiItem {
  date:             string;
  totalCups:        number;
  totalConsumption: number;
}

export interface MonthlySummaryApiItem {
  year:             number;
  month:            number;
  totalCups:        number;
  totalConsumption: number;
}

export interface FilterProduct {
  id:   number;
  name: string;
}

export interface FilterTariff {
  id:       number;
  code:     string;
  products: FilterProduct[];
}

export interface FilterProvider {
  id:      number;
  name:    string;
  tariffs: FilterTariff[];
}

export interface FiltersData {
  providers: FilterProvider[];
}

/** Respuesta consolidada del endpoint /comparison-history/data */
export interface ConsolidatedComparisonData {
  history:         PaginatedHistory | null;
  summary:         SummaryApiResult | null;
  dailySummary:    DailySummaryApiItem[] | null;
  monthlySummary:  MonthlySummaryApiItem[] | null;
  filters:         FiltersData;
}

/** Parámetros para el endpoint consolidado */
export interface ConsolidatedDataParams {
  startDate?:               string;
  endDate?:                 string;
  includeHistory?:          boolean;
  includeSummary?:          boolean;
  includeDailySummary?:     boolean;
  includeMonthlySummary?:   boolean;
  historyFullNameFilter?:   string;
  historyEmailFilter?:      string;
  historyTariffIds?:        string;
  historyProductIds?:       string;
  historySortBy?:           'FullName' | 'Email' | 'TotalCups' | 'TotalAnnualConsumption';
  historySortDirection?:    'Asc' | 'Desc';
  historyPage?:             number;
  historyPageSize?:         number;
}
