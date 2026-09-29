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
import { CollaboratorOption } from '../../../core/services/collaborator-scope.service';

@Component({
  selector: 'app-collaborator-dialog',
  standalone: true,
  imports: [],
  templateUrl: './collaborator-dialog.html',
  styleUrl: './collaborator-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollaboratorDialogComponent {
  readonly open          = input<boolean>(false);
  readonly collaborators = input<CollaboratorOption[]>([]);
  readonly loading       = input<boolean>(false);
  /** null → "Todos" está seleccionado. */
  readonly selectedId    = input<string | null>(null);

  readonly select = output<CollaboratorOption | null>();
  readonly close  = output<void>();

  readonly query = signal('');

  @ViewChild('searchInput')
  set searchRef(ref: ElementRef<HTMLInputElement> | undefined) {
    // Autofocus al montar el input (cuando se abre el modal).
    if (ref && this.open()) queueMicrotask(() => ref.nativeElement.focus());
  }

  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.collaborators();
    if (!q) return all;
    return all.filter(c => c.name.toLowerCase().includes(q));
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

  onSelect(c: CollaboratorOption): void { this.select.emit(c); }

  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.close.emit();
  }

  isSelected(id: string): boolean { return this.selectedId() === id; }
}
