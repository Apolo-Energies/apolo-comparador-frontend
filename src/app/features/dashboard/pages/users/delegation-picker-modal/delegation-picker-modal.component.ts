import {
  ChangeDetectionStrategy, Component, effect, inject, input, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent, InputFieldComponent } from '@apolo-energies/ui';
import { DelegationsService } from '../../../../../core/services/delegations.service';
import { Delegation } from '../../../../../core/models/delegation.model';

@Component({
  selector: 'app-delegation-picker-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delegation-picker-modal.component.html',
})
export class DelegationPickerModalComponent {
  readonly open = input(false);

  readonly closed   = output<void>();
  readonly selected = output<Delegation>();

  private readonly delegationsService = inject(DelegationsService);
  private readonly alertService       = inject(AlertService);

  readonly search        = signal('');
  readonly loading       = signal(false);
  readonly saving        = signal(false);
  readonly delegations   = signal<Delegation[]>([]);
  readonly selectedId    = signal<number | null>(null);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      if (this.open()) {
        this.selectedId.set(null);
        this.search.set('');
        this.load('');
      }
    });
  }

  onOpenChange(isOpen: boolean): void {
    if (!isOpen) this.closed.emit();
  }

  onSearch(term: string): void {
    this.search.set(term);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(term.trim()), 300);
  }

  private load(filter: string): void {
    this.loading.set(true);
    this.delegationsService.list({ filter, limit: 50 }).subscribe({
      next: list => {
        this.delegations.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.delegations.set([]);
        this.loading.set(false);
        this.alertService.show('Error al cargar delegaciones', 'error');
      },
    });
  }

  onConfirm(): void {
    const id = this.selectedId();
    if (id === null) return;
    const delegation = this.delegations().find(d => d.id === id);
    if (!delegation) return;
    this.saving.set(true);
    this.selected.emit(delegation);
  }
}
