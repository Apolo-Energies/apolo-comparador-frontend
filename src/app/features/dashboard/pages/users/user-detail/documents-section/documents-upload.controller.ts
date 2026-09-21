import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { firstValueFrom } from 'rxjs';
import { ContractDocumentService } from '../../../../../../core/services/contract-document.service';
import { ContractService } from '../../../../../../core/services/contract.service';
import { UserDetail } from '../../../../../../core/models/user-detail.model';

export interface DocumentsUploadDeps {
  contractDocSvc: ContractDocumentService;
  contractSvc:    ContractService;
  alertService:   AlertService;
  getUser:        () => UserDetail | null;
  /** Called after a successful upload/replace so the page can reload the user/contract. */
  onDone:         () => void;
}

/**
 * Encapsulates the upload/replace-document modal flow for DocumentsSectionComponent
 * (open, file selection, upload or replace, and on-demand contract creation).
 * Extracted to keep the component under the file-size guideline (R1).
 */
export class DocumentsUploadController {
  constructor(private readonly deps: DocumentsUploadDeps) {}

  readonly localContractId    = signal<string | null>(null);
  readonly uploadModalOpen    = signal(false);
  readonly uploading          = signal(false);
  readonly selectedUploadType = signal<string | null>(null);
  readonly selectedFile       = signal<File | null>(null);
  // When set, onUpload calls replace instead of upload
  private readonly replacingDocId = signal<string | null>(null);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  openReplaceModal(type: string, docId: string): void {
    this.replacingDocId.set(docId);
    this.selectedUploadType.set(type);
    this.uploadModalOpen.set(true);
  }

  /** Subida directa desde el ícono "+" de una fila pendiente/opcional: pre-selecciona
   *  el tipo de esa fila para no obligar a elegirlo de nuevo en el modal. */
  openUploadForType(type: string): void {
    this.selectedUploadType.set(type);
    this.uploadModalOpen.set(true);
  }

  openSignedContractUpload(): void {
    const uploaded = this.deps.getUser()?.contract?.documents.uploaded ?? [];
    const existing = uploaded.find(
      d => d.documentType === 'SignedContract' && d.status === 'Rejected',
    );
    if (existing) {
      this.openReplaceModal('SignedContract', existing.id);
    } else {
      this.selectedUploadType.set('SignedContract');
      this.uploadModalOpen.set(true);
    }
  }

  closeUploadModal(): void {
    this.uploadModalOpen.set(false);
    this.selectedUploadType.set(null);
    this.selectedFile.set(null);
    this.replacingDocId.set(null);
  }

  async onUpload(): Promise<void> {
    const file = this.selectedFile();
    if (!file) return;

    this.uploading.set(true);

    const replaceId = this.replacingDocId();

    // Replace flow: POST /contract-document/replace/{documentId}
    if (replaceId) {
      this.deps.contractDocSvc.replace(replaceId, file).subscribe({
        next: () => {
          this.deps.alertService.show('Documento reemplazado correctamente', 'success');
          this.uploading.set(false);
          this.closeUploadModal();
          this.deps.onDone();
        },
        error: () => {
          this.deps.alertService.show('Error al reemplazar el documento', 'error');
          this.uploading.set(false);
        },
      });
      return;
    }

    // Upload flow: POST /contract-document/{contractId}
    const docType = this.selectedUploadType();
    if (docType === null) { this.uploading.set(false); return; }

    const u = this.deps.getUser();
    if (!u) { this.uploading.set(false); return; }

    let contractId = this.localContractId();

    if (!contractId) {
      const customerId = u.customerId ?? u.customer?.id ?? null;
      if (!customerId) {
        this.deps.alertService.show('El usuario no tiene cliente asignado', 'error');
        this.uploading.set(false);
        return;
      }
      try {
        const contract = await firstValueFrom(
          this.deps.contractSvc.createManual({ customerId, origin: 0 }),
        );
        contractId = contract.id;
        this.localContractId.set(contractId);
      } catch {
        this.deps.alertService.show('Error al crear el contrato', 'error');
        this.uploading.set(false);
        return;
      }
    }

    this.deps.contractDocSvc.upload(contractId, docType, file).subscribe({
      next: () => {
        this.deps.alertService.show('Documento subido correctamente', 'success');
        this.uploading.set(false);
        this.closeUploadModal();
        this.deps.onDone();
      },
      error: () => {
        this.deps.alertService.show('Error al subir el documento', 'error');
        this.uploading.set(false);
      },
    });
  }
}
