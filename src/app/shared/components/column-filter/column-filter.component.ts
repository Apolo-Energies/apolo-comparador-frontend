import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, input, output, signal,
} from '@angular/core';
import { ApoloIcons, filterIcon, UiIconSource } from '@apolo-energies/icons';

export type ColumnFilterKind = 'text' | 'options' | 'date-range';
export interface ColumnFilterOption { value: string; label: string; }
export interface ColumnFilterRange  { from: string; to: string; }

/** Solo un popover abierto a la vez en toda la página. */
const openId = signal<number | null>(null);
let nextId = 0;

const POPOVER_WIDTH: Record<ColumnFilterKind, number> = { 'text': 240, 'options': 220, 'date-range': 300 };

/**
 * Embudo para el encabezado de una columna de lib-data-table (headerIconTemplate):
 * icono + chip con el valor aplicado + popover para editarlo.
 * El popover va en posición fija para que el overflow-x de la tabla no lo recorte.
 */
@Component({
  selector: 'app-column-filter',
  standalone: true,
  imports: [ApoloIcons],
  templateUrl: './column-filter.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnFilterComponent {
  readonly label       = input.required<string>();
  readonly kind        = input<ColumnFilterKind>('text');
  readonly placeholder = input('');
  readonly options     = input<ColumnFilterOption[]>([]);
  /** Valor aplicado (text / options). */
  readonly value       = input('');
  /** Rango aplicado (date-range), yyyy-MM-dd. */
  readonly range       = input<ColumnFilterRange>({ from: '', to: '' });

  readonly valueChange = output<string>();
  readonly rangeChange = output<ColumnFilterRange>();

  readonly icon: UiIconSource = { type: 'apolo', icon: filterIcon, size: 12 };

  private readonly id   = ++nextId;
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly open  = computed(() => openId() === this.id);
  readonly pos   = signal({ top: 0, left: 0, width: 240 });
  readonly draft     = signal('');
  readonly draftFrom = signal('');
  readonly draftTo   = signal('');

  readonly active = computed(() =>
    this.kind() === 'date-range' ? !!(this.range().from || this.range().to) : !!this.value());

  readonly chip = computed(() => {
    if (this.kind() === 'date-range') {
      const { from, to } = this.range();
      if (from && to) return from === to ? shortDate(from) : `${shortDate(from)} – ${shortDate(to)}`;
      if (from) return `desde ${shortDate(from)}`;
      return to ? `hasta ${shortDate(to)}` : '';
    }
    if (this.kind() === 'options') return this.options().find(o => o.value === this.value())?.label ?? this.value();
    return this.value();
  });

  readonly invalidRange = computed(() => !!this.draftFrom() && !!this.draftTo() && this.draftFrom() > this.draftTo());

  readonly presets: { label: string; range: () => ColumnFilterRange }[] = [
    { label: 'Últimos 30 días', range: () => ({ from: iso(addDays(new Date(), -29)), to: iso(new Date()) }) },
    { label: 'Este mes',        range: () => { const d = new Date(); return { from: iso(new Date(d.getFullYear(), d.getMonth(), 1)), to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }; } },
    { label: 'Mes pasado',      range: () => { const d = new Date(); return { from: iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), to: iso(new Date(d.getFullYear(), d.getMonth(), 0)) }; } },
    { label: 'Este año',        range: () => { const y = new Date().getFullYear(); return { from: `${y}-01-01`, to: `${y}-12-31` }; } },
  ];

  constructor() {
    // La tabla hace scroll horizontal dentro de su contenedor: si se mueve, el popover fijo quedaría suelto.
    const close = () => this.close();
    effect(onCleanup => {
      if (!this.open()) return;
      window.addEventListener('scroll', close, true);
      window.addEventListener('resize', close);
      onCleanup(() => {
        window.removeEventListener('scroll', close, true);
        window.removeEventListener('resize', close);
      });
    });
    inject(DestroyRef).onDestroy(() => { if (this.open()) openId.set(null); });
  }

  @HostListener('document:click')
  onDocumentClick(): void { this.close(); }

  toggle(ev: MouseEvent): void {
    ev.stopPropagation();
    if (this.open()) { this.close(); return; }

    const btn   = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    const width = POPOVER_WIDTH[this.kind()];
    const left  = Math.max(12, Math.min(btn.left - 8, window.innerWidth - width - 12));
    this.pos.set({ top: btn.bottom + 8, left, width });

    this.draft.set(this.value());
    this.draftFrom.set(this.range().from);
    this.draftTo.set(this.range().to);
    openId.set(this.id);
    setTimeout(() => (this.host.nativeElement.querySelector('[data-autofocus]') as HTMLElement | null)?.focus(), 0);
  }

  close(): void {
    if (this.open()) openId.set(null);
  }

  applyText(): void {
    const v = this.draft().trim();
    this.close();
    if (v !== this.value()) this.valueChange.emit(v);
  }

  pickOption(v: string): void {
    this.close();
    if (v !== this.value()) this.valueChange.emit(v);
  }

  applyRange(range: ColumnFilterRange = { from: this.draftFrom(), to: this.draftTo() }): void {
    if (range.from && range.to && range.from > range.to) return;
    this.close();
    const cur = this.range();
    if (range.from !== cur.from || range.to !== cur.to) this.rangeChange.emit(range);
  }

  clear(ev?: MouseEvent): void {
    ev?.stopPropagation();
    this.close();
    if (this.kind() === 'date-range') this.rangeChange.emit({ from: '', to: '' });
    else this.valueChange.emit('');
  }

  isPreset(p: { range: () => ColumnFilterRange }): boolean {
    const r = p.range();
    return r.from === this.draftFrom() && r.to === this.draftTo();
  }
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** yyyy-MM-dd → dd/MM/yy */
function shortDate(v: string): string {
  const [y, m, d] = v.split('-');
  return d && m && y ? `${d}/${m}/${y.slice(2)}` : v;
}
