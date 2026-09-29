import { MonthlyRowDatum } from '../../../../../../shared/utils/chart.utils';
import { Period } from '../../../../../../shared/constants/period';

export interface Segment {
  y: number;
  h: number;
  color: string;
  period: string;
}

export interface StackBar {
  x: number;
  w: number;
  month: string;
  segments: Segment[];
  total: number;
  topY: number;
}

export interface GridLine {
  y: number;
  label: string;
}

export const CHART_H = 350;
export const PAD_L = 55;
export const PAD_R = 20;
export const PAD_T = 10;
export const PAD_B = 40;
export const TICK_CNT = 5;
export const DRAW_H = CHART_H - PAD_T - PAD_B;

export const COLORS: Record<string, string> = {
  P1: '#7C67F2',
  P2: '#8FDBFF',
  P3: '#FFB86B',
  P4: '#F691A6',
  P5: '#C4C4C4',
  P6: '#999DF8',
};

export const MAX_BAR_W = 30;
export const MIN_BAR_W = 8;
export const BAR_WIDTH_RATIO = 0.6;

export function niceMax(v: number): number {
  if (!v) return 100;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / exp) * exp;
}

export function fmt(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000) return (v / 1_000).toFixed(0) + 'k';
  return String(Math.round(v));
}

export function roundedTopPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
}

/** Highest stacked total across all rows, rounded up to a "nice" axis max. */
export function computeMaxTotal(rows: MonthlyRowDatum[], periods: readonly Period[]): number {
  const max = Math.max(
    ...rows.map((row) => periods.reduce((sum, period) => sum + (row[period] ?? 0), 0)),
    0
  );

  return niceMax(max);
}

/** Horizontal grid lines with their axis labels, evenly spaced across `maxTotal`. */
export function computeGridLines(maxTotal: number): GridLine[] {
  return Array.from({ length: TICK_CNT + 1 }, (_, i) => {
    const v = Math.round((maxTotal / TICK_CNT) * i);
    const y = PAD_T + DRAW_H - (v / maxTotal) * DRAW_H;
    return { y, label: fmt(v) };
  });
}

/** Stacked bar geometry (position, per-period segments, tooltip anchor) for each row. */
export function computeBars(
  rows: MonthlyRowDatum[],
  periods: readonly Period[],
  maxTotal: number,
  drawW: number
): StackBar[] {
  const n = rows.length;

  if (!n || !maxTotal) return [];

  const slotW = drawW / n;
  const w = Math.max(MIN_BAR_W, Math.min(MAX_BAR_W, slotW * BAR_WIDTH_RATIO));
  const gap = Math.max(0, (drawW - w * n) / (n + 1));

  return rows.map((row, i) => {
    const x = PAD_L + gap + i * (w + gap);
    const total = periods.reduce((sum, period) => sum + (row[period] ?? 0), 0);

    let cumulativeH = 0;
    const segments: Segment[] = periods
      .filter((period) => (row[period] ?? 0) > 0)
      .map((period) => {
        const value = row[period] ?? 0;
        const h = (value / maxTotal) * DRAW_H;
        const y = PAD_T + DRAW_H - cumulativeH - h;
        cumulativeH += h;

        return {
          y,
          h,
          color: COLORS[period],
          period,
        };
      });

    const topY = segments.at(-1)?.y ?? PAD_T + DRAW_H;

    return {
      x,
      w,
      month: row.month,
      segments,
      total,
      topY,
    };
  });
}
