import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { Delegacion } from '../../../../../../core/services/energy-expert.service';

@Component({
  selector: 'app-delegations-dialog',
  standalone: true,
  imports: [],
  templateUrl: './delegations-dialog.html',
  styleUrl: './delegations-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DelegationsDialogComponent {
  readonly open         = input<boolean>(false);
  readonly delegaciones = input<Delegacion[]>([]);
  readonly loading      = input<boolean>(false);
  /** null → "Todos" está seleccionado. */
  readonly selectedId   = input<number | null>(null);

  readonly select = output<Delegacion | null>();
  readonly close  = output<void>();

  readonly query = signal('');

  @ViewChild('searchInput')
  set searchRef(ref: ElementRef<HTMLInputElement> | undefined) {
    // Autofocus al montar el input (cuando se abre el modal).
    if (ref && this.open()) queueMicrotask(() => ref.nativeElement.focus());
  }

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.delegaciones();
    if (!q) return all;
    return all.filter(d => d.nombre.toLowerCase().includes(q));
  });

  readonly isTodosSelected = computed(() => this.selectedId() === null);

  constructor() {
    // Al cerrar, limpiamos la búsqueda para el próximo abrir.
    effect(() => {
      if (!this.open()) this.query.set('');
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close.emit();
  }

  onQueryInput(ev: Event): void {
    this.query.set((ev.target as HTMLInputElement).value);
  }

  onSelectTodos(): void { this.select.emit(null); }

  onSelect(d: Delegacion): void { this.select.emit(d); }

  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.close.emit();
  }

  isSelected(id: number): boolean { return this.selectedId() === id; }
}
