import { SipsConsumo } from "../../entities/sips.model";

export interface MonthlyRowDatum {
  month: string;
  P1: number | null;
  P2: number | null;
  P3: number | null;
  P4: number | null;
  P5: number | null;
  P6: number | null;
}

function wToKwh(wh: number): number {
  return wh / 1000;
}

export function getMonthlyStackedChartData(rows: SipsConsumo[]): MonthlyRowDatum[] {
  if (!rows || rows.length === 0) return [];

  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const grouped = new Map<number, MonthlyRowDatum>();

  rows.forEach((item) => {
    const date = new Date(item.fechaFin);
    const key = date.getFullYear() * 100 + date.getMonth();

    if (!grouped.has(key)) {
      grouped.set(key, {
        month: `${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`,
        P1: 0,
        P2: 0,
        P3: 0,
        P4: 0,
        P5: 0,
        P6: 0,
      });
    }

    const acc = grouped.get(key)!;

    acc.P1 = (acc.P1 ?? 0) + Math.round(wToKwh(item.energiaP1 ?? 0));
    acc.P2 = (acc.P2 ?? 0) + Math.round(wToKwh(item.energiaP2 ?? 0));
    acc.P3 = (acc.P3 ?? 0) + Math.round(wToKwh(item.energiaP3 ?? 0));
    acc.P4 = (acc.P4 ?? 0) + Math.round(wToKwh(item.energiaP4 ?? 0));
    acc.P5 = (acc.P5 ?? 0) + Math.round(wToKwh(item.energiaP5 ?? 0));
    acc.P6 = (acc.P6 ?? 0) + Math.round(wToKwh(item.energiaP6 ?? 0));
  });

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value)
    .slice(-12);
}
