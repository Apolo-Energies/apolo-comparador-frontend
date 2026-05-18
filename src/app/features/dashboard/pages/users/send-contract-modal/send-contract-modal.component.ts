import {
  ChangeDetectionStrategy, Component, inject, input, output, signal,
} from '@angular/core';
import { DialogComponent, ButtonComponent, AlertService } from '@apolo-energies/ui';
import { ContractService } from '../../../../../services/contract.service';

@Component({
  selector: 'app-send-contract-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog [open]="open()" [closeable]="true" maxWidth="max-w-md"
      (openChange)="$event ? null : closed.emit()">
      <div class="px-6 py-5 space-y-4">

        <div>
          <p class="text-lg font-semibold text-foreground">Enviar contrato</p>
        </div>

        <p class="text-sm text-muted-foreground">
          Se enviará el contrato a:<br />
          <strong class="text-foreground">{{ userName() ?? 'Usuario' }}</strong>
          @if (userEmail()) {
            <br /><strong class="text-foreground">{{ userEmail() }}</strong>
          }
        </p>

        <div class="flex justify-end gap-2 pt-2 border-t border-border">
          <ui-button label="Cancelar" variant="outline" size="md" (click)="closed.emit()" />
          @if (sending()) {
            <button disabled class="inline-flex items-center justify-center min-w-32 rounded-md px-4 py-2 bg-primary-button text-white text-sm font-semibold cursor-not-allowed opacity-80">
              <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="white"/>
              </svg>
            </button>
          } @else {
            <ui-button label="Enviar" variant="default" size="md" (click)="onSend()" />
          }
        </div>
      </div>
    </ui-dialog>
  `,
})
export class SendContractModalComponent {
  readonly open       = input<boolean>(false);
  readonly customerId = input<string | null | undefined>(null);
  readonly userName   = input<string | null | undefined>(null);
  readonly userEmail  = input<string | null | undefined>(null);
  readonly closed     = output<void>();

  private readonly contractSvc  = inject(ContractService);
  private readonly alertService = inject(AlertService);

  readonly sending = signal(false);

  onSend(): void {
    const cid = this.customerId();
    if (!cid) {
      this.alertService.show('No se pudo enviar: falta el cliente del usuario.', 'error');
      return;
    }

    this.sending.set(true);
    this.contractSvc.send(cid).subscribe({
      next: () => {
        this.alertService.show('Contrato enviado correctamente', 'success');
        this.sending.set(false);
        this.closed.emit();
      },
      error: () => {
        this.alertService.show('Error al enviar el contrato', 'error');
        this.sending.set(false);
      },
    });
  }
}
