import { Tariff, ProductType } from '../../../../../../core/models/provider.model';

export interface PeriodValue { period: string; value: number }

export interface ProductRow {
  id:                   number;
  name:                 string;
  tariffId:             number;
  tariffCode:           string;
  type:                 ProductType;
  isAvailable:          boolean;
  commissionPercentage: number | null;
  energyPeriods:        PeriodValue[];
  powerPeriods:         PeriodValue[];
}

export const TYPE_OPTIONS = [
  { value: 'Fixed',   label: 'Fixed (precio configurado tal cual)' },
  { value: 'Indexed', label: 'Indexed (precio + OMIE × factor)'    },
];

export const EMPTY_SLOTS = (): string[] => ['', '', '', '', '', ''];

/** Convierte un número a string decimal sin notación científica (evita "6e-8"). */
export function toDecimalString(num: number): string {
  if (!isFinite(num)) return '';
  if (num === 0) return '0';
  const str = String(num);
  if (!/e/i.test(str)) return str;
  return num.toFixed(20).replace(/\.?0+$/, '');
}

export function tariffById(tariffs: Tariff[], id: number | null | undefined): Tariff | undefined {
  if (!id) return undefined;
  return tariffs.find(t => t.id === Number(id));
}

export function expectedCount(tariff?: Tariff): number {
  if (!tariff) return 6;
  return tariff.code.startsWith('2.') ? 3 : 6;
}

export function slotsFromPeriods(periods: PeriodValue[]): string[] {
  const slots = EMPTY_SLOTS();
  periods.forEach(p => {
    const idx = parseInt(p.period.substring(1), 10) - 1;
    if (idx >= 0 && idx < 6) slots[idx] = toDecimalString(p.value);
  });
  return slots;
}

export function parsedSection(slots: string[], count: number): { ok: true; periods: PeriodValue[] } | { ok: false; reason: 'partial' | 'invalid' } {
  const trimmed = slots.slice(0, count).map(v => v.trim());
  const allEmpty = trimmed.every(v => v === '');
  if (allEmpty) return { ok: true, periods: [] };

  const anyEmpty = trimmed.some(v => v === '');
  if (anyEmpty) return { ok: false, reason: 'partial' };

  const periods: PeriodValue[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    const num = parseFloat(trimmed[i]);
    if (isNaN(num) || num < 0) return { ok: false, reason: 'invalid' };
    periods.push({ period: `P${i + 1}`, value: num });
  }
  return { ok: true, periods };
}

/** Para potencia: acepta rellenos parciales, solo valida y devuelve los slots con valor. */
export function parsedPowerSection(slots: string[], count: number): { ok: true; periods: PeriodValue[] } | { ok: false } {
  const trimmed = slots.slice(0, count).map(v => v.trim());
  const periods: PeriodValue[] = [];
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '') continue;
    const num = parseFloat(trimmed[i]);
    if (isNaN(num) || num < 0) return { ok: false };
    periods.push({ period: `P${i + 1}`, value: num });
  }
  return { ok: true, periods };
}
