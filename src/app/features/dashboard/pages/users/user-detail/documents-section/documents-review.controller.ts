import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { ContractDocumentService } from '../../../../../../core/services/contract-document.service';
import { ContractDocument } from '../../../../../../core/models/user-detail.model';

export interface DocumentsReviewDeps {
  contractDocSvc:      ContractDocumentService;
  alertService:        AlertService;
  getLocalContractId:  () => string | null;
  /** Called after a successful verify/reject/delete so the page can reload the user/contract. */
  onDone:              () => void;
}

/**
 * Encapsulates the document review actions (verify, reject, delete) for
 * DocumentsSectionComponent, with optimistic local updates that roll back on
 * error. Extracted to keep the component under the file-size guideline (R1).
 */
export class DocumentsReviewController {
  constructor(private readonly deps: DocumentsReviewDeps) {}

  readonly docs              = signal<ContractDocument[]>([]);
  readonly rejectingDocId    = signal<string | null>(null);
  readonly rejectObservation = signal('');

  onVerify(docId: string): void {
    const prev = this.docs();
    const doc  = prev.find(d => d.id === docId);
    this.docs.update(list =>
      list.map(d => d.id === docId ? { ...d, status: 'Validated', reviewComment: null } : d)
    );
    const contractId = this.deps.getLocalContractId();
    const validate$  = doc?.documentType === 'SignedContract' && contractId
      ? this.deps.contractDocSvc.validateSigned(contractId)
      : this.deps.contractDocSvc.validate(docId);
    validate$.subscribe({
      next: () => { this.deps.alertService.show('Documento verificado correctamente', 'success'); this.deps.onDone(); },
      error: () => { this.docs.set(prev); this.deps.alertService.show('Error al verificar el documento', 'error'); },
    });
  }

  onRejectClick(docId: string): void {
    this.rejectingDocId.set(docId);
    this.rejectObservation.set('');
  }

  onRejectSubmit(docId: string): void {
    const observation = this.rejectObservation().trim();
    if (!observation) return;
    const prev = this.docs();
    this.docs.update(list =>
      list.map(d => d.id === docId ? { ...d, status: 'Rejected', reviewComment: observation } : d)
    );
    this.rejectingDocId.set(null);
    this.rejectObservation.set('');
    this.deps.contractDocSvc.reject(docId, observation).subscribe({
      next: () => { this.deps.alertService.show('Documento rechazado correctamente', 'success'); this.deps.onDone(); },
      error: () => { this.docs.set(prev); this.deps.alertService.show('Error al rechazar el documento', 'error'); },
    });
  }

  onDelete(docId: string): void {
    const prev = this.docs();
    this.docs.update(list => list.filter(d => d.id !== docId));
    if (this.rejectingDocId() === docId) this.rejectingDocId.set(null);
    this.deps.contractDocSvc.delete(docId).subscribe({
      next: () => { this.deps.alertService.show('Documento eliminado correctamente', 'success'); this.deps.onDone(); },
      error: () => { this.docs.set(prev); this.deps.alertService.show('Error al eliminar el documento', 'error'); },
    });
  }
}
