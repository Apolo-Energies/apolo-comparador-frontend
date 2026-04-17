import { DailySummaryApiItem, MonthlySummaryApiItem, SummaryApiResult } from '../models/dashboard-api.models';
import { ChartBar, KpiCardViewModel, TREND, TrendDirection } from '../models/dashboard-ui.models';

const MONTH_ABBR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const NUMBER_LOCALE = 'en-US' as const;

const CONSUMPTION_TOOLTIP_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
};

const CONSUMPTION_SUMMARY_FORMAT: Intl.NumberFormatOptions = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

function toTrend(percent: number): TrendDirection {
  if (percent > 0) return TREND.UP;
  if (percent < 0) return TREND.DOWN;
  return TREND.NEUTRAL;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const month = MONTH_ABBR[d.getUTCMonth()].toLowerCase();
  return `${d.getUTCDate()} ${month}`;
}

function formatConsumptionTooltip(value: number): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, CONSUMPTION_TOOLTIP_FORMAT).format(value);
}

export function mapSummaryToKpis(result: SummaryApiResult): KpiCardViewModel[] {
  const rawConsumption = new Intl.NumberFormat(NUMBER_LOCALE, CONSUMPTION_SUMMARY_FORMAT).format(
    result.totalAnnualConsumption,
  );

  return [
    {
      id:          'consumption',
      label:       'Consumo total presupuestado',
      value:       rawConsumption,
      percent:     result.percentAnnualConsumption,
      trend:       toTrend(result.percentAnnualConsumption),
      description: 'kWh energía gestionada',
    },
    {
      id:          'cups',
      label:       'Numero de CUPS presupuestado',
      value:       result.totalCups.toLocaleString(NUMBER_LOCALE),
      percent:     result.percentCups,
      trend:       toTrend(result.percentCups),
      description: 'puntos de suministro',
    },
    {
      id:          'users',
      label:       'Usuarios Activos',
      value:       result.totalUsersActive.toLocaleString(NUMBER_LOCALE),
      percent:     result.percentUsersActive,
      trend:       toTrend(result.percentUsersActive),
      description: 'colaboradores activos',
    },
  ];
}

export function mapDailyToChart(items: DailySummaryApiItem[]): ChartBar[] {
  return items.map(item => ({
    label:      formatDayLabel(item.date),
    value:      item.totalConsumption,
    tooltip:    `Consumo Anual : ${formatConsumptionTooltip(item.totalConsumption)}`,
    tooltipSub: `CUPS : ${item.totalCups}`,
  }));
}

export function mapMonthlyToChart(items: MonthlySummaryApiItem[]): ChartBar[] {
  return items.map(item => ({
    label:      `${MONTH_ABBR[item.month - 1].toLowerCase()} ${String(item.year).slice(2)}`,
    value:      item.totalConsumption,
    tooltip:    `Consumo Anual : ${formatConsumptionTooltip(item.totalConsumption)}`,
    tooltipSub: `CUPS : ${item.totalCups}`,
  }));
}
