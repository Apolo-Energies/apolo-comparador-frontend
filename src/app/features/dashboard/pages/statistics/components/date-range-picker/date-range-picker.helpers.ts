import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  getDay,
  getMonth,
  getYear,
  isToday,
  isWithinInterval,
  startOfDay,
  subDays,
} from 'date-fns';

export const CALENDAR_TAB = {
  DATES: 'fechas',
  MONTHS: 'meses',
} as const;

export type CalendarTabType = (typeof CALENDAR_TAB)[keyof typeof CALENDAR_TAB];

export const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const DAY_ABBR = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

export const DATE_PRESETS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '12 meses', days: 365 },
] as const;

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

/** Builds the 6x7 calendar grid (weeks x days) for the month containing `monthStart`. */
export function buildCalendarGrid(monthStart: Date): CalendarDay[][] {
  const lastOfMonth = endOfMonth(monthStart);
  const startOffset = (getDay(monthStart) + 6) % 7; // Make Monday=0, Sunday=6

  const dates: CalendarDay[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    dates.push({ date: subDays(monthStart, i + 1), isCurrentMonth: false, isToday: false });
  }

  // Current-month days
  eachDayOfInterval({ start: monthStart, end: lastOfMonth }).forEach((date) => {
    dates.push({ date, isCurrentMonth: true, isToday: isToday(date) });
  });

  // Trailing days from the next month (pad to 42 = 6 weeks × 7 days)
  let trailing = 1;
  while (dates.length < 42) {
    dates.push({ date: addDays(lastOfMonth, trailing++), isCurrentMonth: false, isToday: false });
  }

  return Array.from({ length: 6 }, (_, i) => dates.slice(i * 7, (i + 1) * 7));
}

/** Formats a calendar header title, e.g. "enero 2026". */
export function formatMonthTitle(date: Date): string {
  return `${MONTH_NAMES[getMonth(date)]} ${getYear(date)}`;
}

/** Formats the trigger button label for the currently selected range. */
export function formatDateRangeLabel(from: Date | null, to: Date | null): string {
  if (!from && !to) return 'Filtrar por fecha';
  const fmt = (d: Date) =>
    `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `Desde ${fmt(from)}`;
  return 'Filtrar por fecha';
}

/** Whether `date` falls strictly between `from` and `end` (exclusive of the edges). */
export function isDateBetween(date: Date, from: Date | null, end: Date | null): boolean {
  if (!from || !end) return false;
  const [a, b] = from <= end ? [from, end] : [end, from];
  return isWithinInterval(startOfDay(date), {
    start: addDays(startOfDay(a), 1),
    end: subDays(startOfDay(b), 1),
  });
}
