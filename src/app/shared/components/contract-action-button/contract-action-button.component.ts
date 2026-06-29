import {
  ChangeDetectionStrategy, Component, computed, inject, input, output, signal,
} from '@angular/core';
import { AlertService, ButtonComponent } from '@apolo-energies/ui';
import { ContractService } from '../../../services/contract.service';

@Component({
  selector: 'app-contract-action-button',
  standalone: true,
  imports: [ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (acting()) {
      <button disabled class="inline-flex items-center justify-center gap-2 min-w-32 rounded-md px-4 py-2 bg-primary-button text-white text-sm font-semibold cursor-not-allowed opacity-80">
        <svg class="h-4 w-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
          <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="white"/>
        </svg>
        Enviando…
      </button>
    } @else if (canSend() || canRequestSignature()) {
      <ui-button label="Enviar contrato" variant="default" size="sm"
        (click)="previewMode() ? openPreview.emit() : onSendContract()" />
    } @else if (canRenew()) {
      <ui-button label="Renovar contrato" variant="default" size="sm" (click)="onRenew()" />
    } @else if (canResend()) {
      <ui-button label="Reenviar contrato" variant="outline" size="sm" (click)="onResend()" />
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
