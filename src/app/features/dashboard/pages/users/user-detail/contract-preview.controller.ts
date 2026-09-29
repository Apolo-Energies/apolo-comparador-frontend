import { signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AlertService } from '@apolo-energies/ui';
import { ContractService } from '../../../../../core/services/contract.service';

export interface ContractPreviewDeps {
  isMaster: () => boolean;
  getContractId: () => string | undefined;
}

/**
 * State and handlers for the contract preview dialog (open/close, blob
 * loading and object-URL lifecycle). Plain class without Angular DI:
 * receives the services it needs via constructor, instantiated by
 * `UserDetailPageComponent`.
 */
export class ContractPreviewController {
  readonly open    = signal(false);
  readonly url     = signal<SafeResourceUrl | null>(null);
  readonly loading = signal(false);

  private objectUrl: string | null = null;

  constructor(
    private readonly contractService: ContractService,
    private readonly alertService: AlertService,
    private readonly sanitizer: DomSanitizer,
    private readonly deps: ContractPreviewDeps,
  ) {}

  openPreview(): void {
    this.loading.set(true);
    this.open.set(true);
    const contractId = this.deps.getContractId();
    const preview$ = this.deps.isMaster() && contractId
      ? this.contractService.getPreviewById(contractId)
      : this.contractService.getMyPreview();
    preview$.subscribe({
      next: blob => {
        this.revokeUrl();
        this.objectUrl = URL.createObjectURL(blob);
        this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
        this.loading.set(false);
      },
      error: () => {
        this.alertService.show('No se pudo cargar la vista previa del contrato', 'error');
        this.loading.set(false);
        this.open.set(false);
      },
    });
  }

  onContractSent(): void {
    this.close();
  }

  close(): void {
    this.open.set(false);
    this.url.set(null);
    this.revokeUrl();
  }

  private revokeUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
