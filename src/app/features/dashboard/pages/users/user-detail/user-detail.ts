import {
  ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { AlertService, ButtonComponent } from '@apolo-energies/ui';
import { UserService } from '../../../../../services/user.service';
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
    ButtonComponent,
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
  private readonly route        = inject(ActivatedRoute);
  private readonly router       = inject(Router);
  private readonly userService  = inject(UserService);
  private readonly auth         = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly platformId   = inject(PLATFORM_ID);

  readonly loading            = signal(false);
  readonly user               = signal<UserDetail | null>(null);
  readonly showEditUserModal   = signal(false);
  readonly showCustomerModal   = signal(false);
  readonly customerModalMode   = signal<'create' | 'edit'>('create');

  private userId = '';

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
  readonly isInProgress        = computed(() => this.signatureStatus() === 1);
  readonly isExpiringSoon      = computed(() => {
    const d = this.daysUntilExpiration();
    return d !== null && d >= 0 && d < 30;
  });

  readonly missingDocCount = computed(() => {
    const u = this.user();
    if (!u?.customer) return 0;
    const required = REQUIRED_DOCS_BY_PERSON_TYPE[u.customer.personType] ?? [];
    const existing = new Set((u.contract?.documents.uploaded ?? []).map(d => d.documentType));
    return required.filter(t => !existing.has(t)).length;
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
      ['Tipo de cliente',         c?.personType === 0 ? 'Individual' : 'Empresa'],
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
