import {
  ChangeDetectionStrategy, Component, inject, input, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { UserService } from '../../../../../services/user.service';

@Component({
  selector: 'app-delete-user-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog
      [open]="open()"
      [closeable]="true"
      maxWidth="max-w-lg"
      (openChange)="onOpenChange($event)"
    >
      <div class="px-4 pt-4 pb-4 space-y-4 whitespace-normal">
        <h2 class="text-lg text-foreground font-semibold">Eliminar usuario</h2>

        <p class="text-sm text-muted-foreground">
          ¿Estás seguro de que deseas eliminar a
          <strong class="text-foreground">{{ userName() }}</strong>?
        </p>

        <p class="text-sm text-muted-foreground">
          Esta acción no se puede deshacer. Se eliminarán permanentemente todas
          las comparaciones, contratos y documentos asociados.
        </p>

        <div class="flex justify-between gap-2 pt-4 border-t border-border">
          <ui-button
            label="Cancelar"
            variant="outline"
            class="text-foreground"
            [disabled]="loading()"
            (click)="closed.emit()"
          />
          @if (loading()) {
            <button disabled class="inline-flex items-center justify-center min-w-32 rounded-md px-4 py-2 bg-destructive text-white text-sm font-semibold cursor-not-allowed opacity-80">
              <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="white"/>
              </svg>
            </button>
          } @else {
            <ui-button label="Eliminar" variant="destructive" (click)="onConfirm()" />
          }
        </div>
      </div>
    </ui-dialog>
  `,
})
export class DeleteUserModalComponent {
  readonly open     = input(false);
  readonly userId   = input('');
  readonly userName = input('');
  readonly closed   = output<void>();
  readonly deleted  = output<void>();

  private readonly userService  = inject(UserService);
  private readonly alertService = inject(AlertService);

  readonly loading = signal(false);

  onOpenChange(isOpen: boolean): void {
    if (!isOpen) this.closed.emit();
  }

  onConfirm(): void {
    const id = this.userId();
    if (!id) return;
    this.loading.set(true);
    this.userService.delete(id).subscribe({
      next: () => {
        this.alertService.show('Usuario eliminado correctamente', 'success');
        this.loading.set(false);
        this.deleted.emit();
        this.closed.emit();
      },
      error: () => {
        this.alertService.show('Error al eliminar el usuario', 'error');
        this.loading.set(false);
      },
    });
  }
}
