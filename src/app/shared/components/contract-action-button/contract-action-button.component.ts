import {
  ChangeDetectionStrategy, Component, computed, inject, input, signal,
} from '@angular/core';
import { AlertService, ButtonComponent } from '@apolo-energies/ui';
import { ContractService } from '../../../services/contract.service';

@Component({
  selector: 'app-contract-action-button',
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canSend() || canRequestSignature()) {
      <ui-button label="Enviar contrato" variant="default" size="sm"
        [disabled]="acting()" (click)="onSendContract()" />
    } @else if (canRenew()) {
      <ui-button label="Renovar contrato" variant="default" size="sm"
        [disabled]="acting()" (click)="onRenew()" />
    } @else if (canResend()) {
      <ui-button label="Reenviar contrato" variant="outline" size="sm"
        [disabled]="acting()" (click)="onResend()" />
    } @else if (isInProgress()) {
      <ui-button label="Esperando firma" variant="outline" size="sm" [disabled]="true" />
    } @else if (actions().length > 0) {
      <ui-button label="Docs incompletos" variant="outline" size="sm" [disabled]="true" />
    }
  `,
})
export class ContractActionButtonComponent {
  readonly customerId          = input<string | null | undefined>(null);
  readonly contractId          = input<string | null | undefined>(null);
  readonly signatureStatus     = input<string | null>(null);
  readonly actions             = input<string[]>([]);
  readonly daysUntilExpiration = input<number | null>(null);

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
      next:  () => { this.alert.show('Contrato enviado correctamente', 'success'); this.acting.set(false); },
      error: () => { this.alert.show('Error al enviar el contrato', 'error');      this.acting.set(false); },
    });
  }

  onRequestSignature(): void {
    const cid = this.customerId();
    if (!cid) return;
    this.acting.set(true);
    this.contractSvc.send(cid).subscribe({
      next:  () => { this.alert.show('Contrato enviado para firma', 'success'); this.acting.set(false); },
      error: () => { this.alert.show('Error al solicitar la firma', 'error');   this.acting.set(false); },
    });
  }

  onRenew(): void {
    const cid = this.customerId();
    if (!cid) return;
    this.acting.set(true);
    this.contractSvc.send(cid).subscribe({
      next:  () => { this.alert.show('Contrato renovado correctamente', 'success'); this.acting.set(false); },
      error: () => { this.alert.show('Error al renovar el contrato', 'error');      this.acting.set(false); },
    });
  }

  onResend(): void {
    const cid = this.customerId();
    if (!cid) return;
    this.acting.set(true);
    this.contractSvc.send(cid).subscribe({
      next:  () => { this.alert.show('Contrato reenviado correctamente', 'success'); this.acting.set(false); },
      error: () => { this.alert.show('Error al reenviar el contrato', 'error');      this.acting.set(false); },
    });
  }
}
