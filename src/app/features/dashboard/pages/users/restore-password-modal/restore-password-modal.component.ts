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

      <div class="flex justify-between gap-2 pt-4 border-t border-border">

        <ui-button
          label="Cancelar"
          variant="outline"
          class="text-foreground"
          (click)="closed.emit()"
        >
          Cancelar
        </ui-button>

        @if (loading()) {
          <button disabled class="inline-flex items-center justify-center min-w-32 rounded-md px-4 py-2 bg-primary-button text-white text-sm font-semibold cursor-not-allowed opacity-80">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="white"/>
            </svg>
          </button>
        } @else {
          <ui-button label="Enviar correo" variant="default" (click)="onConfirm()" />
        }

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
