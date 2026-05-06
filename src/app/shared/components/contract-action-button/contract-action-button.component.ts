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
    @if (canRequestSignature()) {
      <ui-button label="Solicitar firma" variant="default" size="sm"
        [disabled]="acting()" (click)="onRequestSignature()" />
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
  readonly customerId       = input<string | null | undefined>(null);
  readonly contractId       = input<string | null | undefined>(null);
  readonly signatureStatus  = input<string | null>(null);
  readonly actions          = input<string[]>([]);

  private readonly contractSvc = inject(ContractService);
  private readonly alert       = inject(AlertService);

  readonly acting = signal(false);

  readonly canRequestSignature = computed(() => this.actions().includes('RequestSignature'));
  readonly canRenew            = computed(() => this.actions().includes('Renew'));
  readonly canResend           = computed(() => this.actions().includes('Resend'));
  // signatureStatus 'InProgress' = sent, awaiting client signature
  readonly isInProgress        = computed(() => this.signatureStatus() === 'InProgress');

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
