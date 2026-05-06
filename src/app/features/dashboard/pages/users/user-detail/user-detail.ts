import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { AlertService, ButtonComponent, DialogComponent } from '@apolo-energies/ui';
import { UserService } from '../../../../../services/user.service';
import { ContractService } from '../../../../../services/contract.service';
import { UserDetail } from '../../../../../entities/user-detail.model';
import { UserRole, UserRoleLabel } from '../../../../../entities/user-role';
import { getUserRoles } from '../../../../../utils/auth.utils';
import { REQUIRED_DOCS_BY_PERSON_TYPE } from './configs/doc-by-person-type.config';
import { EditUserModalComponent } from './edit-user-modal/edit-user-modal';
import { CustomerModalComponent } from './customer-modal/customer-modal';
import { DocumentsSectionComponent } from './documents-section/documents-section';
import { LoadingOverlayComponent } from '../../../../../shared/components/loading-overlay/loading-overlay.component';
import { ContractActionButtonComponent } from '../../../../../shared/components/contract-action-button/contract-action-button.component';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [
    FormsModule,
    ButtonComponent,
    DialogComponent,
    EditUserModalComponent,
    CustomerModalComponent,
    DocumentsSectionComponent,
    LoadingOverlayComponent,
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

  readonly loading                 = signal(false);
  readonly user                    = signal<UserDetail | null>(null);
  readonly showEditUserModal       = signal(false);
  readonly showCustomerModal       = signal(false);
  readonly customerModalMode       = signal<'create' | 'edit'>('create');
  readonly contractPreviewOpen     = signal(false);
  readonly contractPreviewUrl      = signal<SafeResourceUrl | null>(null);
  readonly loadingPreview          = signal(false);
  readonly requestingSignature     = signal(false);
  readonly validatingContract      = signal(false);
  readonly rejectingContract       = signal(false);
  readonly showContractRejectInput = signal(false);
  readonly contractRejectReason    = signal('');

  private userId           = '';
  private previewObjectUrl: string | null = null;

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

  readonly isExpiringSoon    = computed(() => {
    const d = this.daysUntilExpiration();
    return d !== null && d >= 0 && d < 30;
  });

  // Document upload progress based on personType required list (works even without a contract)
  readonly docUploadProgress = computed(() => {
    const u = this.user();
    if (!u?.customer) return { count: 0, total: 0, pct: 0 };
    const contract = u.contract;
    const required = (contract?.documents.required.length
      ? contract.documents.required
      : REQUIRED_DOCS_BY_PERSON_TYPE[u.customer.personType]) ?? [];
    if (required.length === 0) return { count: 0, total: 0, pct: 0 };
    const uploaded = contract?.documents.uploaded ?? [];
    const done = new Set(
      uploaded.filter(d => d.status !== 'Rejected').map(d => d.documentType),
    );
    const count = required.filter(t => done.has(t)).length;
    return { count, total: required.length, pct: Math.round((count / required.length) * 100) };
  });

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

  readonly personalDataRows = computed<[string, string][]>(() => {
    const u = this.user();
    const c = u?.customer;
    const contract = u?.contract;

    const displayName = (c?.companyName
      ?? `${c?.firstName ?? ''} ${c?.lastName ?? ''}`.trim())
      || '-';

    return [
      ['Nombre / Razón social',   displayName],
      ['DNI / CIF',               c?.dni ?? c?.cif ?? '-'],
      ['Tipo de cliente',         c?.personType === 'Individual' ? 'Individual' : 'Empresa'],
      ['Correo',                  c?.email ?? '-'],
      ['Teléfono',                c?.phone ?? '-'],
      ['Dirección legal',         c?.legalAddress ?? '-'],
      ['Dirección notificación',  c?.notificationAddress ?? '-'],
      ['Estado contrato',         contract?.isActive ? 'Activo' : 'Inactivo'],
      ['Vigencia',                this.vigencia(contract?.endDate ?? null)],
    ];
  });

  readonly userDataRows = computed<[string, string][]>(() => {
    const u = this.user();
    return [
      ['Nombre completo',  u?.fullName                          ?? '-'],
      ['Correo de acceso', u?.email                             ?? '-'],
      ['Teléfono',         u?.phone                             ?? '-'],
      ['Rol',              UserRoleLabel[u?.role as UserRole]    ?? '-'],
      ['Estado',           u?.isActive ? 'Activo' : 'Inactivo'],
      ['Identificador',    u?.identifier                         ?? '-'],
    ];
  });

  ngOnInit(): void {
    this.userId = this.route.snapshot.paramMap.get('id') ?? '';
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.userService.getById(this.userId).subscribe({
      next: u => { this.user.set(u); this.loading.set(false); },
      error: () => {
        this.loading.set(false);
        this.alertService.show('Error al cargar el usuario', 'error');
        this.router.navigate(['/dashboard/settings/users']);
      },
    });
  }

  openCustomerModal(): void {
    this.customerModalMode.set(this.hasCustomer() ? 'edit' : 'create');
    this.showCustomerModal.set(true);
  }

  openContractPreview(): void {
    this.loadingPreview.set(true);
    this.contractPreviewOpen.set(true);
    this.contractService.getMyPreview().subscribe({
      next: blob => {
        this.revokePreviewUrl();
        this.previewObjectUrl = URL.createObjectURL(blob);
        this.contractPreviewUrl.set(
          this.sanitizer.bypassSecurityTrustResourceUrl(this.previewObjectUrl),
        );
        this.loadingPreview.set(false);
      },
      error: () => {
        this.alertService.show('No se pudo cargar la vista previa del contrato', 'error');
        this.loadingPreview.set(false);
        this.contractPreviewOpen.set(false);
      },
    });
  }

  closeContractPreview(): void {
    this.contractPreviewOpen.set(false);
    this.contractPreviewUrl.set(null);
    this.revokePreviewUrl();
  }

  private revokePreviewUrl(): void {
    if (this.previewObjectUrl) {
      URL.revokeObjectURL(this.previewObjectUrl);
      this.previewObjectUrl = null;
    }
  }

  onRequestSignature(): void {
    this.requestingSignature.set(true);
    this.contractService.requestSignature(this.userId).subscribe({
      next: () => {
        this.alertService.show('Solicitud enviada. El equipo de Apolo procesará tu contrato.', 'success');
        this.requestingSignature.set(false);
        this.closeContractPreview();
        this.load();
      },
      error: () => {
        this.alertService.show('Error al enviar la solicitud', 'error');
        this.requestingSignature.set(false);
      },
    });
  }

  onValidateContract(): void {
    const contractId = this.user()?.contract?.id;
    if (!contractId) return;
    this.validatingContract.set(true);
    this.contractService.validateContract(contractId).subscribe({
      next: () => {
        this.alertService.show('Contrato validado correctamente', 'success');
        this.validatingContract.set(false);
        this.load();
      },
      error: () => {
        this.alertService.show('Error al validar el contrato', 'error');
        this.validatingContract.set(false);
      },
    });
  }

  onRejectContractSubmit(): void {
    const reason     = this.contractRejectReason().trim();
    const contractId = this.user()?.contract?.id;
    if (!reason || !contractId) return;
    this.rejectingContract.set(true);
    this.contractService.rejectContract(contractId, reason).subscribe({
      next: () => {
        this.alertService.show('Contrato rechazado', 'success');
        this.rejectingContract.set(false);
        this.showContractRejectInput.set(false);
        this.contractRejectReason.set('');
        this.load();
      },
      error: () => {
        this.alertService.show('Error al rechazar el contrato', 'error');
        this.rejectingContract.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/settings/users']);
  }

  private vigencia(endDate: string | null): string {
    if (!endDate) return 'Sin vencimiento';
    const d    = new Date(endDate);
    const diff = d.getTime() - Date.now();
    if (diff < 0) return 'Vencido';
    const days = Math.ceil(diff / 86_400_000);
    return `Vence en ${days} día${days === 1 ? '' : 's'}`;
  }
}
