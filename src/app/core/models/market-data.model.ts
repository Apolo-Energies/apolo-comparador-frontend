export type MarketSourceKey = 'Omie' | 'Mibgas' | 'Brent' | 'Co2';

export interface MarketSpot {
  source: MarketSourceKey;
  product: string;
  unit: string;
  currentValue: number;
  currentDate: string;
  previousValue: number | null;
  previousDate: string | null;
  changePercent: number | null;
}

export interface MarketKpis {
  gas: MarketSpot;
  electricity: MarketSpot;
  co2: MarketSpot;
  brent: MarketSpot;
}

export interface MarketSeriesPoint {
  date: string;
  value: number;
}

export interface MarketSeries {
  source: MarketSourceKey;
  product: string;
  unit: string;
  points: MarketSeriesPoint[];
}
