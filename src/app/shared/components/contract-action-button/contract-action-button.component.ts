import {
  ChangeDetectionStrategy, Component, computed, inject, input, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent } from '@apolo-energies/ui';
import { ContractService } from '../../../core/services/contract.service';

@Component({
  selector: 'app-contract-action-button',
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contract-action-button.component.html',
})
export class ContractActionButtonComponent {
  readonly customerId          = input<string | null | undefined>(null);
  readonly contractId          = input<string | null | undefined>(null);
  readonly signatureStatus     = input<string | null>(null);
  readonly actions             = input<string[]>([]);
  readonly daysUntilExpiration = input<number | null>(null);
  readonly previewMode         = input<boolean>(false);

  readonly openPreview = output<void>();
  readonly sent        = output<void>();

  private readonly contractSvc = inject(ContractService);
  private readonly alert       = inject(AlertService);

  readonly acting = signal(false);

  readonly canRequestSignature = computed(() => this.actions().includes('RequestSignature'));
  // Renovar solo cuando faltan 15 días o menos para expirar
  readonly canRenew            = computed(() => {
    const days = this.daysUntilExpiration();
    return this.actions().includes('Renew') && days !== null && days <= 15;
  });
  readonly canResend           = computed(() => this.actions().includes('Resend'));
  readonly isInProgress        = computed(() => this.signatureStatus() === 'InProgress');
  // Enviar firma: contrato existe, no está en progreso, y no aplica renovar/solicitar/reenviar
  readonly canSend             = computed(() =>
    !!this.contractId() &&
    !this.signatureStatus() &&
    !this.canRequestSignature() &&
    !this.canRenew() &&
    !this.canResend()
  );

  onSendContract(): void {
    const cid = this.contractId();
    if (!cid) return;
    this.acting.set(true);
    this.contractSvc.sendContract(cid).subscribe({
      next:  () => { this.acting.set(false); this.sent.emit(); this.alert.show('Contrato enviado correctamente', 'success'); },
      error: () => { this.acting.set(false); this.alert.show('Error al enviar el contrato', 'error'); },
    });
  }

  onRequestSignature(): void {
    const cid = this.customerId();
    if (!cid) return;
    this.acting.set(true);
    this.contractSvc.send(cid).subscribe({
      next:  () => { this.acting.set(false); this.sent.emit(); this.alert.show('Contrato enviado para firma', 'success'); },
      error: () => { this.acting.set(false); this.alert.show('Error al solicitar la firma', 'error'); },
    });
  }

  onRenew(): void {
    const cid = this.customerId();
    if (!cid) return;
    this.acting.set(true);
    this.contractSvc.send(cid).subscribe({
      next:  () => { this.acting.set(false); this.sent.emit(); this.alert.show('Contrato renovado correctamente', 'success'); },
      error: () => { this.acting.set(false); this.alert.show('Error al renovar el contrato', 'error'); },
    });
  }

  onResend(): void {
    const cid = this.customerId();
    if (!cid) return;
    this.acting.set(true);
    this.contractSvc.send(cid).subscribe({
      next:  () => { this.acting.set(false); this.sent.emit(); this.alert.show('Contrato reenviado correctamente', 'success'); },
      error: () => { this.acting.set(false); this.alert.show('Error al reenviar el contrato', 'error'); },
    });
  }
}
