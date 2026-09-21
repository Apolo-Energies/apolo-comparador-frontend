import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { DomSanitizer } from '@angular/platform-browser';
import { ContractDocumentService } from '../../../../../../core/services/contract-document.service';
import { ContractService } from '../../../../../../core/services/contract.service';
import { ContractDocument, UserDetail } from '../../../../../../core/models/user-detail.model';
import {
  buildDocSlots, computeCanUploadSignedContract, getDocStatusConfig, getDocTypeLabel,
  getPendingRequiredTypes, isDocReviewable,
} from './documents-section.helpers';
import { DocumentsUploadController } from './documents-upload.controller';
import { DocumentsReviewController } from './documents-review.controller';

@Component({
  selector: 'app-documents-section',
  standalone: true,
  imports: [FormsModule, ButtonComponent, DialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './documents-section.html',
})
export class DocumentsSectionComponent {
  readonly user     = input.required<UserDetail | null>();
  readonly isMaster = input.required<boolean>();
  readonly reload   = output<void>();

  private readonly contractDocSvc = inject(ContractDocumentService);
  private readonly contractSvc    = inject(ContractService);
  private readonly alertService   = inject(AlertService);
  private readonly sanitizer      = inject(DomSanitizer);
  private readonly platformId     = inject(PLATFORM_ID);

  // Upload/replace-document modal flow (state + service calls live in the controller; R1).
  private readonly upload = new DocumentsUploadController({
    contractDocSvc: this.contractDocSvc,
    contractSvc:    this.contractSvc,
    alertService:   this.alertService,
    getUser:        () => this.user(),
    onDone:         () => this.reload.emit(),
  });
  readonly uploadModalOpen    = this.upload.uploadModalOpen;
  readonly uploading          = this.upload.uploading;
  readonly selectedUploadType = this.upload.selectedUploadType;
  readonly selectedFile       = this.upload.selectedFile;

  // Verify/reject/delete review actions (state + service calls live in the controller; R1).
  private readonly review = new DocumentsReviewController({
    contractDocSvc:     this.contractDocSvc,
    alertService:       this.alertService,
    getLocalContractId: () => this.upload.localContractId(),
    onDone:              () => this.reload.emit(),
  });
  readonly rejectingDocId    = this.review.rejectingDocId;
  readonly rejectObservation = this.review.rejectObservation;

  readonly viewDoc             = signal<ContractDocument | null>(null);
  readonly completionDismissed = signal(false);

  readonly canUploadSignedContract = computed(() => computeCanUploadSignedContract(this.user()));

  /** All slots: required + optional (always visible) + extra uploaded (SignedContract etc.). */
  readonly allSlots = computed(() => buildDocSlots(this.user()));

  /** Only slots with an uploaded doc (used for non-master empty state check). */
  readonly uploadedSlots = computed(() => this.allSlots().filter(s => s.doc !== null));

  private readonly pendingRequiredTypes = computed(() => getPendingRequiredTypes(this.user()));

  readonly showCompletionBanner = computed(() =>
    !this.isMaster() &&
    this.pendingRequiredTypes().length === 0 &&
    this.uploadedSlots().length > 0 &&
    !this.completionDismissed()
  );

  constructor() {
    effect(() => {
      const u = this.user();
      this.review.docs.set(u?.contract?.documents.uploaded ?? []);
      this.upload.localContractId.set(u?.contract?.id ?? null);
    }, { allowSignalWrites: true });

    effect(() => {
      const userId = this.user()?.id;
      if (!userId || !isPlatformBrowser(this.platformId)) return;
      const seen = !!localStorage.getItem(`docs_complete_${userId}`);
      this.completionDismissed.set(seen);
    }, { allowSignalWrites: true });
  }

  dismissCompletion(): void {
    const userId = this.user()?.id;
    if (userId && isPlatformBrowser(this.platformId)) {
      localStorage.setItem(`docs_complete_${userId}`, '1');
    }
    this.completionDismissed.set(true);
  }

  docTypeLabel(type: string): string {
    return getDocTypeLabel(type);
  }

  statusConfig(status: string) {
    return getDocStatusConfig(status);
  }

  canReview(status: string): boolean {
    return isDocReviewable(status);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  sanitizeUrl(url: string) {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  onFileSelected(event: Event): void {
    this.upload.onFileSelected(event);
  }

  openReplaceModal(type: string, docId: string): void {
    this.upload.openReplaceModal(type, docId);
  }

  openUploadForType(type: string): void {
    this.upload.openUploadForType(type);
  }

  openSignedContractUpload(): void {
    this.upload.openSignedContractUpload();
  }

  closeUploadModal(): void {
    this.upload.closeUploadModal();
  }

  async onUpload(): Promise<void> {
    await this.upload.onUpload();
  }

  onVerify(docId: string): void {
    this.review.onVerify(docId);
  }

  onRejectClick(docId: string): void {
    this.review.onRejectClick(docId);
  }

  onRejectSubmit(docId: string): void {
    this.review.onRejectSubmit(docId);
  }

  onDelete(docId: string): void {
    this.review.onDelete(docId);
  }
}
