import {
  ChangeDetectionStrategy, Component, inject, input, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { PasswordService } from '../../../../../services/password.service';

@Component({
  selector: 'app-restore-password-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <ui-dialog
    [open]="open()"
    [closeable]="true"
    maxWidth="max-w-md"
    (openChange)="onOpenChange($event)"
  >
    <div class="px-4 pt-4 pb-4 space-y-4">
      <h2 class="text-lg text-foreground font-semibold">Restablecer contraseña</h2>

      <p class="text-sm text-muted-foreground">
        ¿Quieres enviar un correo de recuperación a:
        <br />
        <strong>{{ userEmail() }}</strong>?
      </p>

      <div class="flex justify-end gap-2 pt-4 border-t border-border">

        <ui-button
          label="Cancelar"
          variant="outline"
          class="text-foreground"
          (click)="closed.emit()"
        >
          Cancelar
        </ui-button>

        <ui-button
          label="Enviar correo"
          variant="default"
          (click)="onConfirm()"
          [disabled]="loading()"
        >
          {{ loading() ? 'Enviando...' : 'Enviar correo' }}
        </ui-button>

      </div>
    </div>
  </ui-dialog>
`})



export class RestorePasswordModalComponent {
  readonly open = input(false);
  readonly userEmail = input('');
  readonly userName = input('');
  readonly closed = output<void>();

  private readonly passwordService = inject(PasswordService);
  private readonly alertService = inject(AlertService);

  readonly loading = signal(false);

  onOpenChange(isOpen: boolean): void {
    if (!isOpen) this.closed.emit();
  }

  onConfirm(): void {
    const email = this.userEmail();
    if (!email) return;

    this.loading.set(true);
    this.passwordService.forgotPassword({ email }).subscribe({
      next: () => {
        this.alertService.show('Correo enviado correctamente', 'success');
        this.loading.set(false);
        this.closed.emit();
      },
      error: () => {
        this.alertService.show('Error al enviar el correo', 'error');
        this.loading.set(false);
      },
    });
  }
}
