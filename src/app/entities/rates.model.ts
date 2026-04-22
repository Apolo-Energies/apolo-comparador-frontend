/**
 * Types and utilities for Rates Management
 */

export type TabType = 'provider' | 'tariffs' | 'omie' | 'boe';

export interface TariffSummary {
  code: string;
  productsCount: number;
  omieDistributionsCount: number;
  boePowers: number;
}

export interface PeriodValue {
  period: number;
  value: number;
  label?: string;
}

/**
 * Format a numeric value to display with currency or percentage
 */
export function formatValue(value: number, decimals: number = 6): string {
  return value.toFixed(decimals);
}

/**
 * Format a period number to display label (P1, P2, etc.)
 */
export function formatPeriodLabel(period: number): string {
  return `P${period}`;
}

/**
 * Get a color for a period (useful for charts or visual distinction)
 */
export function getPeriodColor(period: number): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
  ];
  return colors[(period - 1) % colors.length];
}

/**
 * Sort periods in ascending order
 */
export function sortPeriods<T extends { period: number }>(periods: T[]): T[] {
  return [...periods].sort((a, b) => a.period - b.period);
}
