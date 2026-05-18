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
          <ui-button
            label="Eliminar"
            variant="destructive"
            [disabled]="loading()"
            (click)="onConfirm()"
          />
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
