// Rounding utilities shared by the invoice calculation engine
// (calculator.helpers.ts, calculator-commission.helpers.ts, calculator-tariff.helpers.ts).
export const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;
export const round3 = (n: number): number => Math.round(n * 1000) / 1000;
