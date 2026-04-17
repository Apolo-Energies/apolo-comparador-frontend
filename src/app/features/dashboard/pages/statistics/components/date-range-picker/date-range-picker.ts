import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  output,
  signal,
} from '@angular/core';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  getDay,
  getMonth,
  getYear,
  isSameDay,
  isToday,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

import { DateRange } from '../../models/dashboard-ui.models';


export const CALENDAR_TAB = {
  DATES: 'fechas',
  MONTHS: 'meses',
} as const;

export type CalendarTabType = (typeof CALENDAR_TAB)[keyof typeof CALENDAR_TAB];

const MONTH_NAMES = [
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

const DAY_ABBR = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];

const DATE_PRESETS = [
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '12 meses', days: 365 },
] as const;


export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}


@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [],
  templateUrl: './date-range-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
})
export class DateRangePickerComponent {
  private elRef = inject(ElementRef);

  readonly rangeSelected = output<DateRange>();

  readonly CalendarTab = CALENDAR_TAB;
  readonly datePresets = DATE_PRESETS;
  readonly DAY_ABBR = DAY_ABBR;

  readonly isOpen = signal(false);
  readonly activeTab = signal<CalendarTabType>(CALENDAR_TAB.DATES);

  readonly _from = signal<Date | null>(null);
  readonly _to = signal<Date | null>(null);
  readonly _hover = signal<Date | null>(null);

  readonly leftDate = signal(startOfMonth(new Date()));
  readonly rightDate = computed(() => addMonths(this.leftDate(), 1));

  readonly leftCalendar = computed(() => this.buildGrid(this.leftDate()));
  readonly rightCalendar = computed(() => this.buildGrid(this.rightDate()));

  readonly leftTitle = computed(
    () => `${MONTH_NAMES[getMonth(this.leftDate())]} ${getYear(this.leftDate())}`,
  );
  readonly rightTitle = computed(
    () => `${MONTH_NAMES[getMonth(this.rightDate())]} ${getYear(this.rightDate())}`,
  );

  readonly buttonLabel = computed(() => {
    const from = this._from();
    const to = this._to();
    if (!from && !to) return 'Filtrar por fecha';
    const fmt = (d: Date) =>
      `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
    if (from && to) return `${fmt(from)} – ${fmt(to)}`;
    if (from) return `Desde ${fmt(from)}`;
    return 'Filtrar por fecha';
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.isOpen() && !this.elRef.nativeElement.contains(e.target)) {
      this.isOpen.set(false);
    }
  }

  toggleOpen(): void {
    this.isOpen.update((v) => !v);
  }

  prevMonth(): void {
    this.leftDate.update((d) => subMonths(d, 1));
  }

  nextMonth(): void {
    this.leftDate.update((d) => addMonths(d, 1));
  }

  onDayClick(date: Date): void {
    const from = this._from();
    if (!from || this._to()) {
      this._from.set(date);
      this._to.set(null);
    } else {
      if (date < from) {
        this._from.set(date);
        this._to.set(from);
      } else {
        this._to.set(date);
      }
    }
  }

  onDayHover(date: Date): void {
    if (this._from() && !this._to()) {
      this._hover.set(date);
    }
  }

  onDayLeave(): void {
    this._hover.set(null);
  }

  isFrom(date: Date): boolean {
    const from = this._from();
    return from ? isSameDay(date, from) : false;
  }

  isTo(date: Date): boolean {
    const to = this._to();
    return to ? isSameDay(date, to) : false;
  }

  isInRange(date: Date): boolean {
    const from = this._from();
    if (!from) return false;
    const end = this._to() ?? this._hover();
    if (!end) return false;
    const [a, b] = from <= end ? [from, end] : [end, from];
    return isWithinInterval(startOfDay(date), {
      start: addDays(startOfDay(a), 1),
      end: subDays(startOfDay(b), 1),
    });
  }

  isRangeEdge(date: Date): boolean {
    return this.isFrom(date) || this.isTo(date);
  }

  applyPreset(days: number): void {
    const to = new Date();
    const from = subDays(to, days);
    this._from.set(from);
    this._to.set(to);
    this.leftDate.set(startOfMonth(from));
  }

  onApply(): void {
    this.rangeSelected.emit({ from: this._from(), to: this._to() });
    this.isOpen.set(false);
  }

  onClear(): void {
    this._from.set(null);
    this._to.set(null);
    this._hover.set(null);
  }

  private buildGrid(monthStart: Date): CalendarDay[][] {
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
}
