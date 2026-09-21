import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { ContractService } from '../../../../../core/services/contract.service';

export interface ContractActionsDeps {
  getUserId: () => string;
  getContractId: () => string | undefined;
  onSuccess: () => void;
  onClosePreview: () => void;
}

/**
 * State and handlers for the signature-request / send-contract /
 * validate-contract / reject-contract actions on the user detail page.
 * Plain class without Angular DI, instantiated by `UserDetailPageComponent`.
 */
export class ContractActionsController {
  readonly requestingSignature     = signal(false);
  readonly requestingContract      = signal(false);
  readonly validatingContract      = signal(false);
  readonly rejectingContract       = signal(false);
  readonly showContractRejectInput = signal(false);
  readonly contractRejectReason    = signal('');

  constructor(
    private readonly contractService: ContractService,
    private readonly alertService: AlertService,
    private readonly deps: ContractActionsDeps,
  ) {}

  onRequestSignature(): void {
    this.requestingSignature.set(true);
    this.contractService.requestSignature(this.deps.getUserId()).subscribe({
      next: () => {
        this.alertService.show('Solicitud enviada. El equipo de Apolo procesará tu contrato.', 'success');
        this.requestingSignature.set(false);
        this.deps.onClosePreview();
        this.deps.onSuccess();
      },
      error: () => {
        this.alertService.show('Error al enviar la solicitud', 'error');
        this.requestingSignature.set(false);
      },
    });
  }

  handleRequestContract(): void {
    const contractId = this.deps.getContractId();
    if (!contractId) return;
    this.requestingContract.set(true);
    this.contractService.sendContract(contractId).subscribe({
      next: () => {
        this.alertService.show('Solicitud enviada correctamente', 'success');
        this.requestingContract.set(false);
        this.deps.onClosePreview();
        this.deps.onSuccess();
      },
      error: () => {
        this.alertService.show('Error al solicitar el contrato', 'error');
        this.requestingContract.set(false);
      },
    });
  }

  onValidateContract(): void {
    const contractId = this.deps.getContractId();
    if (!contractId) return;
    this.validatingContract.set(true);
    this.contractService.validateContract(contractId).subscribe({
      next: () => {
        this.alertService.show('Contrato validado correctamente', 'success');
        this.validatingContract.set(false);
        this.deps.onSuccess();
      },
      error: () => {
        this.alertService.show('Error al validar el contrato', 'error');
        this.validatingContract.set(false);
      },
    });
  }

  onRejectContractSubmit(): void {
    const reason     = this.contractRejectReason().trim();
    const contractId = this.deps.getContractId();
    if (!reason || !contractId) return;
    this.rejectingContract.set(true);
    this.contractService.rejectContract(contractId, reason).subscribe({
      next: () => {
        this.alertService.show('Contrato rechazado', 'success');
        this.rejectingContract.set(false);
        this.showContractRejectInput.set(false);
        this.contractRejectReason.set('');
        this.deps.onSuccess();
      },
      error: () => {
        this.alertService.show('Error al rechazar el contrato', 'error');
        this.rejectingContract.set(false);
      },
    });
  }
}
