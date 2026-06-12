import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component,
  effect, inject, input, OnInit, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { ContractTemplateService } from '../../../../../services/contract-template.service';
import { ContractTemplate } from '../../../../../entities/contract-template.model';

@Component({
  selector: 'app-contract-template-history',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog [open]="open()" [closeable]="true" maxWidth="max-w-2xl" (openChange)="$event ? null : closed.emit()">

      <div class="px-6 pt-5 pb-2">
        <h3 class="text-base font-semibold text-foreground">Historial de versiones</h3>
        @if (code()) {
          <p class="text-xs font-mono text-muted-foreground mt-0.5">{{ code() }}</p>
        }
      </div>

      <div class="px-6 pb-6 space-y-3 max-h-[60vh] overflow-y-auto">

        @if (loading()) {
          <div class="space-y-2 animate-pulse">
            @for (n of skeletonRows; track n) {
              <div class="h-20 rounded-lg bg-muted/40"></div>
            }
          </div>
        } @else if (history().length === 0) {
          <div class="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <p class="text-sm">Sin historial disponible</p>
          </div>
        } @else {
          @for (item of history(); track item.id) {
            <div class="flex items-start gap-4 p-4 rounded-lg border border-border bg-card/50">

              <!-- Version + status -->
              <div class="shrink-0 text-center">
                <span class="text-sm font-bold text-foreground">v{{ item.version }}</span>
                <div class="mt-1">
                  <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    [class.bg-green-500/15]="item.isActive"
                    [class.text-green-400]="item.isActive"
                    [class.bg-muted]="!item.isActive"
                    [class.text-muted-foreground]="!item.isActive">
                    {{ item.isActive ? 'Activa' : 'Inactiva' }}
                  </span>
                </div>
              </div>

              <!-- Notes + date -->
              <div class="flex-1 min-w-0">
                @if (item.changeNotes) {
                  <p class="text-sm text-foreground">{{ item.changeNotes }}</p>
                } @else {
                  <p class="text-sm text-muted-foreground italic">Sin notas</p>
                }
                <p class="text-xs text-muted-foreground mt-1">{{ formatDate(item.createdAt) }}</p>
              </div>

              <!-- Activate button -->
              @if (!item.isActive) {
                <div class="shrink-0">
                  @if (activatingId() === item.id) {
                    <button disabled class="inline-flex items-center gap-1.5 text-xs text-muted-foreground cursor-not-allowed">
                      <svg class="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.3"/>
                        <path d="M4 12a8 8 0 018-8" stroke="currentColor" stroke-width="3"/>
                      </svg>
                      Activando...
                    </button>
                  } @else {
                    <button
                      class="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                      (click)="onActivate(item)">
                      Activar
                    </button>
                  }
                </div>
              }

            </div>
          }
        }

      </div>

      <div class="px-6 pb-5 border-t border-border pt-4 flex justify-end">
        <ui-button label="Cerrar" variant="outline" size="md" (click)="closed.emit()" />
      </div>

    </ui-dialog>
  `,
})
export class ContractTemplateHistoryComponent {
  readonly open = input<boolean>(false);
  readonly code = input<string>('');

  readonly closed = output<void>();

  private templateService = inject(ContractTemplateService);
  private alertService    = inject(AlertService);
  private cdr             = inject(ChangeDetectorRef);

  readonly loading     = signal(false);
  readonly history     = signal<ContractTemplate[]>([]);
  readonly activatingId = signal<string | null>(null);
  readonly skeletonRows = [1, 2, 3];

  constructor() {
    effect(() => {
      const code = this.code();
      const open = this.open();
      if (open && code) this.loadHistory(code);
    });
  }

  private loadHistory(code: string): void {
    this.loading.set(true);
    this.history.set([]);
    this.templateService.getHistory(code).subscribe({
      next: res => {
        this.history.set(res.sort((a, b) => b.version.localeCompare(a.version)));
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: () => {
        this.alertService.show('Error al cargar el historial', 'error');
        this.loading.set(false);
      },
    });
  }

  onActivate(item: ContractTemplate): void {
    if (this.activatingId()) return;
    this.activatingId.set(item.id);
    this.templateService.activate(item.id).subscribe({
      next: () => {
        this.alertService.show('Versión activada correctamente', 'success');
        this.activatingId.set(null);
        this.loadHistory(this.code());
      },
      error: () => {
        this.alertService.show('Error al activar la versión', 'error');
        this.activatingId.set(null);
      },
    });
  }

  formatDate(dateStr: string): string {
    try {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  }
}
