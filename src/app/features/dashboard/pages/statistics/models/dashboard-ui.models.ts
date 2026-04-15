export const DASHBOARD_STATUS = {
  LOADING: 0,
  SUCCESS: 1,
  ERROR:   2,
  EMPTY:   3,
} as const;

export type DashboardStatus = typeof DASHBOARD_STATUS[keyof typeof DASHBOARD_STATUS];

export const TREND = {
  UP:      0,
  DOWN:    1,
  NEUTRAL: 2,
} as const;

export type TrendDirection = typeof TREND[keyof typeof TREND];

export interface KpiCardViewModel {
  id:          string;
  label:       string;
  value:       string;
  percent:     number;
  trend:       TrendDirection;
  description: string;
}

export interface ChartBar {
  label:       string;
  value:       number;
  tooltip:     string;
  tooltipSub?: string;
}

export interface DateRange {
  from: Date | null;
  to:   Date | null;
}
