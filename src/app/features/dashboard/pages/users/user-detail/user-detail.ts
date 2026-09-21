import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { AlertComponent, AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { UserService } from '../../../../../core/services/user.service';
import { ContractService } from '../../../../../core/services/contract.service';
import { UserDetail } from '../../../../../core/models/user-detail.model';
import { getUserRoles } from '../../../../../core/helpers/auth.utils';
import { EditUserModalComponent } from './edit-user-modal/edit-user-modal';
import { CustomerModalComponent } from './customer-modal/customer-modal';
import { DocumentsSectionComponent } from './documents-section/documents-section';
import { ContractActionButtonComponent } from '../../../../../shared/components/contract-action-button/contract-action-button.component';
import { GlobalLoadingService } from '../../../../../core/services/global-loading.service';
import {
  buildPersonalDataRows, buildUserDataRows, computeAllDocsVerified, computeDocUploadProgress,
} from './user-detail.helpers';
import { ContractPreviewController } from './contract-preview.controller';
import { ContractActionsController } from './contract-actions.controller';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    FormsModule,
    AlertComponent,
    ButtonComponent,
    DialogComponent,
    EditUserModalComponent,
    CustomerModalComponent,
    DocumentsSectionComponent,
    ContractActionButtonComponent,
  ],
  templateUrl: './user-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDetailPageComponent implements OnInit {
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);
  private readonly userService     = inject(UserService);
  private readonly contractService = inject(ContractService);
  private readonly auth            = inject(AuthService);
  private readonly alertService    = inject(AlertService);
  private readonly sanitizer       = inject(DomSanitizer);
  private readonly platformId      = inject(PLATFORM_ID);
  private readonly globalLoading   = inject(GlobalLoadingService);

  readonly loading           = signal(false);
  readonly user              = signal<UserDetail | null>(null);
  readonly showEditUserModal = signal(false);
  readonly showCustomerModal = signal(false);
  readonly customerModalMode = signal<'create' | 'edit'>('create');

  private userId = '';

  // ── controllers: preview del contrato y acciones sobre el contrato ─────────
  private readonly preview = new ContractPreviewController(
    this.contractService, this.alertService, this.sanitizer,
    { isMaster: () => this.isMaster(), getContractId: () => this.user()?.contract?.id },
  );
  private readonly contractActions = new ContractActionsController(
    this.contractService, this.alertService,
    {
      getUserId:     () => this.userId,
      getContractId: () => this.user()?.contract?.id,
      onSuccess:     () => this.load(),
      onClosePreview: () => this.preview.close(),
    },
  );

  // Signals expuestos por referencia directa (mismo objeto) para no tocar el .html existente.
  readonly contractPreviewOpen = this.preview.open;
  readonly contractPreviewUrl  = this.preview.url;
  readonly loadingPreview      = this.preview.loading;

  readonly requestingSignature     = this.contractActions.requestingSignature;
  readonly requestingContract      = this.contractActions.requestingContract;
  readonly validatingContract      = this.contractActions.validatingContract;
  readonly rejectingContract       = this.contractActions.rejectingContract;
  readonly showContractRejectInput = this.contractActions.showContractRejectInput;
  readonly contractRejectReason    = this.contractActions.contractRejectReason;

  readonly isMaster = computed(() => {
    const roles = getUserRoles(this.auth.currentUser());
    return roles.includes('Master');
  });

  readonly hasCustomer         = computed(() => !!this.user()?.customer);
  readonly customerIdForAction = computed(() =>
    this.user()?.customerId ?? this.user()?.customer?.id ?? null
  );
  readonly availableActions    = computed(() => this.user()?.availableActions ?? []);
  readonly signatureStatus     = computed(() => this.user()?.contract?.signatureStatus ?? null);
  readonly completionPct       = computed(() => this.user()?.contract?.documents.completionPercentage ?? 0);
  readonly daysUntilExpiration = computed(() => this.user()?.contract?.daysUntilExpiration ?? null);
  readonly isInProgress        = computed(() => this.signatureStatus() === 'InProgress');
  readonly isSignedPending     = computed(() => this.signatureStatus() === 'SignedPending');
  readonly isSignedVerified    = computed(() => this.signatureStatus() === 'SignedVerified');
  readonly isSignedRejected    = computed(() => this.signatureStatus() === 'SignedRejected');

  // "Ver contrato" available to non-master as soon as they have customer data
  readonly canViewContract   = computed(() => !this.isMaster() && !!this.user()?.customer);

  // Master can validate/reject a contract when it is pending review
  readonly canReviewContract = computed(() => this.isMaster() && this.isSignedPending());

  readonly isExpiringSoon = computed(() => {
    const d = this.daysUntilExpiration();
    return d !== null && d >= 0 && d < 30;
  });

  // Document upload progress based on personType required list (works even without a contract)
  readonly docUploadProgress = computed(() => computeDocUploadProgress(this.user()));

  readonly missingDocCount = computed(() => {
    const p = this.docUploadProgress();
    return p.total - p.count;
  });

  readonly canRequestContract = computed(() => {
    if (this.isMaster()) return false;
    const { count, total } = this.docUploadProgress();
    if (total === 0 || count < total) return false;
    // Block only when already processing or successfully completed
    const status = this.signatureStatus();
    const blocked = ['InProgress', 'SignedPending', 'SignedVerified'];
    return !blocked.includes(status ?? '');
  });

  readonly allDocsVerified = computed(() => computeAllDocsVerified(this.user()?.contract));

  readonly hasSignatureRequest = computed(() => {
    const id = this.user()?.contract?.signatureRequestId;
    return !!id && id !== 'NULL';
  });

  readonly isSigned = computed(() => this.isSignedPending() || this.isSignedVerified());

  readonly personalDataRows = computed(() => buildPersonalDataRows(this.user()));
  readonly userDataRows     = computed(() => buildUserDataRows(this.user()));

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') ?? '';
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.globalLoading.start();
    this.userService.getById(this.userId).subscribe({
      next: u => { this.user.set(u); this.loading.set(false); this.globalLoading.stop(); },
      error: () => {
        this.loading.set(false);
        this.globalLoading.stop();
        this.alertService.show('Error al cargar el usuario', 'error');
        this.router.navigate(['/dashboard/settings/users']);
      },
    });
  }

  openCustomerModal(): void {
    this.customerModalMode.set(this.hasCustomer() ? 'edit' : 'create');
    this.showCustomerModal.set(true);
  }

  openContractPreview(): void { this.preview.openPreview(); }
  onContractSent(): void { this.preview.onContractSent(); }
  closeContractPreview(): void { this.preview.close(); }

  onRequestSignature(): void { this.contractActions.onRequestSignature(); }
  handleRequestContract(): void { this.contractActions.handleRequestContract(); }
  onValidateContract(): void { this.contractActions.onValidateContract(); }
  onRejectContractSubmit(): void { this.contractActions.onRejectContractSubmit(); }

  goBack(): void {
    this.router.navigate(['/dashboard/settings/users']);
  }
}
