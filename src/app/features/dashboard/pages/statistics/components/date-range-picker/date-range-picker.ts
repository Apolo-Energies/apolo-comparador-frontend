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
import { addMonths, isSameDay, startOfMonth, subDays, subMonths } from 'date-fns';

import { DateRange } from '../../models/dashboard-ui.model';
import {
  buildCalendarGrid,
  CALENDAR_TAB,
  CalendarTabType,
  DATE_PRESETS,
  DAY_ABBR,
  formatDateRangeLabel,
  formatMonthTitle,
  isDateBetween,
} from './date-range-picker.helpers';

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

  readonly leftCalendar = computed(() => buildCalendarGrid(this.leftDate()));
  readonly rightCalendar = computed(() => buildCalendarGrid(this.rightDate()));

  readonly leftTitle = computed(() => formatMonthTitle(this.leftDate()));
  readonly rightTitle = computed(() => formatMonthTitle(this.rightDate()));

  readonly buttonLabel = computed(() => formatDateRangeLabel(this._from(), this._to()));

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
    const end = this._to() ?? this._hover();
    return isDateBetween(date, this._from(), end);
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
}
