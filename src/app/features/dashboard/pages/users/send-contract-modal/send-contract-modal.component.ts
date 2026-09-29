import {
  ChangeDetectionStrategy, Component, inject, input, output, signal,
} from '@angular/core';
import { DialogComponent, ButtonComponent, AlertService } from '@apolo-energies/ui';
import { ContractService } from '../../../../../core/services/contract.service';

@Component({
  selector: 'app-send-contract-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './send-contract-modal.component.html',
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
