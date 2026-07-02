import {
  ChangeDetectionStrategy, Component, effect, inject, input, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent, InputFieldComponent } from '@apolo-energies/ui';
import { DelegationsService } from '../../../../../services/delegations.service';
import { Delegation } from '../../../../../entities/delegation.model';

@Component({
  selector: 'app-delegation-picker-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog
      [open]="open()"
      [closeable]="true"
      maxWidth="max-w-3xl"
      (openChange)="onOpenChange($event)"
    >
      <div class="px-4 pt-4 pb-4 space-y-4">
        <div>
          <h2 class="text-lg text-foreground font-semibold">Seleccionar delegación</h2>
          <p class="text-sm text-muted-foreground mt-1">
            Elige la delegación de Energy Expert que se asignará al usuario.
          </p>
        </div>

        <ui-input
          placeholder="Buscar por nombre, CIF, provincia…"
          [value]="search()"
          (valueChange)="onSearch($event)"
        />

        <div class="max-h-96 overflow-y-auto rounded-md border border-border">
          @if (loading()) {
            <div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Cargando delegaciones…
            </div>
          } @else if (delegations().length === 0) {
            <div class="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No se encontraron delegaciones.
            </div>
          } @else {
            <ul class="divide-y divide-border">
              @for (d of delegations(); track d.id) {
                <li>
                  <button
                    type="button"
                    class="w-full text-left px-4 py-3 hover:bg-muted transition-colors"
                    [class.bg-muted]="selectedId() === d.id"
                    (click)="selectedId.set(d.id)"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium text-foreground truncate">{{ d.name }}</div>
                        @if (d.businessName) {
                          <div class="text-xs text-muted-foreground truncate">{{ d.businessName }}</div>
                        }
                        <div class="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          @if (d.taxId)    { <span>CIF: {{ d.taxId }}</span> }
                          @if (d.province) { <span>{{ d.province }}</span> }
                          @if (d.postalCode) { <span>{{ d.postalCode }}</span> }
                        </div>
                      </div>
                      @if (selectedId() === d.id) {
                        <span class="text-xs text-primary font-semibold">Seleccionada</span>
                      }
                    </div>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        <div class="flex justify-between gap-2 pt-4 border-t border-border">
          <ui-button
            label="Cancelar"
            variant="outline"
            class="text-foreground"
            [disabled]="saving()"
            (click)="closed.emit()"
          />
          <ui-button
            label="Asignar delegación"
            variant="default"
            [disabled]="selectedId() === null || saving()"
            (click)="onConfirm()"
          />
        </div>
      </div>
    </ui-dialog>
  `,
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
