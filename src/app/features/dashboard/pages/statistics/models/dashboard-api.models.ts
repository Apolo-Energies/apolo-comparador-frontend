export interface SummaryApiResult {
  data: unknown[];
  totalCUPS: number;
  totalAnnualConsumption: number;
  totalUsersActive: number;
  percentCUPS: number;
  percentAnnualConsumption: number;
  percentUsersActive: number;
}

export interface DailySummaryApiItem {
  date: string;
  totalCUPS: number;
  totalConsumption: number;
}

export interface MonthlySummaryApiItem {
  year: number;
  month: number;
  totalCUPS: number;
  totalConsumption: number;
}
