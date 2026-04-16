export interface SummaryDataItem {
  fullName:               string;
  email:                  string;
  totalCups:              number;
  totalAnnualConsumption: number;
}

export interface SummaryApiResult {
  data:                   SummaryDataItem[];
  totalCups:              number;
  totalAnnualConsumption: number;
  totalUsersActive:       number;
  percentCups:            number;
  percentAnnualConsumption: number;
  percentUsersActive:     number;
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
