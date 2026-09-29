import { DonutDatum, TrendData } from './components/donut-chart/donut-chart.component';
import { PowerBarDatum } from './components/power-chart/power-chart.component';
import { SipsConsumo, SipsPs } from '../../../../core/models/sips.model';
import { PERIODS } from '../../../../shared/constants/period';

// Format español: ES + 16 dígitos + 2 alfanuméricos (con sufijo opcional de control).
// Lo dejamos amplio para no rechazar CUPS válidos atípicos; el backend valida realmente.
const CUPS_PATTERN = /^ES[0-9]{16}[A-Z0-9]{2}[A-Z0-9]{0,2}$/i;

export interface ParsedCups {
  valid:   string[];
  invalid: number;
}

/** Parses free-text CUPS input (one or many, separated by newline/comma/semicolon) into valid + invalid counts. */
export function parseCupsInput(raw: string): ParsedCups {
  if (!raw.trim()) return { valid: [], invalid: 0 };
  const tokens = raw
    .split(/[\n,;]+/)
    .map(t => t.trim().toUpperCase())
    .filter(t => t.length > 0);
  const seen = new Set<string>();
  const valid: string[] = [];
  let invalid = 0;
  for (const t of tokens) {
    if (!CUPS_PATTERN.test(t)) { invalid++; continue; }
    if (seen.has(t)) continue;
    seen.add(t);
    valid.push(t);
  }
  return { valid, invalid };
}

function wToKwh(wh: number): number {
  return wh / 1000;
}

export function buildPeriodSummary(consumos: SipsConsumo[]): { periods: DonutDatum[]; totalFormatted: number } {
  const last12 = [...consumos]
    .sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio))
    .slice(-12);

  const periods: DonutDatum[] = PERIODS.map(p => ({
    label: p,
    value: Math.round(last12.reduce((s, c) => s + wToKwh((c[`energia${p}`] as number) || 0), 0)),
  })).filter(d => d.value > 0);

  return {
    periods,
    totalFormatted: periods.reduce((s, d) => s + d.value, 0),
  };
}

export function buildTrend(consumos: SipsConsumo[]): TrendData | null {
  const sorted = [...consumos].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  const last12 = sorted.slice(-12);
  if (last12.length < 12) return null;

  const total = (slice: SipsConsumo[]) =>
    slice.reduce(
      (s, c) => s + PERIODS.reduce((ps, p) => ps + wToKwh((c[`energia${p}`] as number) || 0), 0),
      0
    );

  const prev = total(last12.slice(0, 6));
  const curr = total(last12.slice(6));
  if (prev === 0) return null;

  const percent = Math.abs(Math.round(((curr - prev) / prev) * 100));
  return {
    percent,
    trend: curr > prev ? 'up' : curr < prev ? 'down' : 'equal',
  };
}

export function buildPowerData(ps: SipsPs): PowerBarDatum[] {
  return PERIODS.map(p => ({
    label: p,
    value: (ps[`potenciaContratada${p}`] as number) || 0,
  })).filter(d => d.value > 0);
}
