import {
  ChangeDetectionStrategy, Component, inject, input, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { UserService } from '../../../../../core/services/user.service';

@Component({
  selector: 'app-delete-user-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './delete-user-modal.component.html',
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
