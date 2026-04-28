export const PERIODS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'] as const;

export type Period = typeof PERIODS[number];

export const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6] as const;

export type PeriodNumber = typeof PERIOD_NUMBERS[number];

export const periodToNumber = (p: Period): PeriodNumber =>
  Number(p.slice(1)) as PeriodNumber;

export const numberToPeriod = (n: PeriodNumber): Period =>
  `P${n}` as Period;
