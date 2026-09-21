import { ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '@apolo-energies/auth';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { ComparatorService } from '../../../../core/services/comparator.service';
import { CommissionService } from '../../../../core/services/commission.service';
import { UserService } from '../../../../core/services/user.service';
import { SubUsersService } from '../../../../core/services/sub-users.service';
import { SipsService } from '../../../../core/services/sips.service';
import { ComparatorUploadComponent } from './components/comparator-upload/comparator-upload';
import { ComparatorModalComponent } from './components/comparator-modal/comparator-modal';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';
import { ComparadorFormValue } from '../../../../core/models/comparator.model';
import { ComparadorCompareEvent, ComparadorDownloadEvent } from './comparator-events.model';
import { ComparadorUser, ComparatorProductsByTariff } from './comparator-ui.model';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';
import { FEE_LOCKED_PRODUCTS } from '../../../../shared/constants/flat-commission-products';
import { environment } from '../../../../../environments/environment';
import { ComparisonController } from './comparator-comparison.controller';
import { buildProductsByTariff } from './comparator.helpers';

@Component({
  selector: 'app-comparator',
  standalone: true,
  imports: [ComparatorUploadComponent, ComparatorModalComponent, BrandLoaderComponent, LoadingOverlayComponent, RouterLink],
  templateUrl: './comparator-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Comparator {
  private auth              = inject(AuthService);
  private comparatorService = inject(ComparatorService);
  private commissionService = inject(CommissionService);
  private userService       = inject(UserService);
  private subUsersService   = inject(SubUsersService);
  private sipsService       = inject(SipsService);
  private platformId        = inject(PLATFORM_ID);

  // ── state ──────────────────────────────────────────────────────────────────

  readonly isApolo        = environment.clientName === 'apolo';
  readonly usersLoading   = signal(false);
  readonly users          = signal<ComparadorUser[]>([]);
  readonly subUserPoolPct = signal<number | null>(null);

  // ── computed roles ─────────────────────────────────────────────────────────

  readonly currentUser = this.auth.currentUser;

  readonly isMaster = computed(() =>
    getUserRoles(this.currentUser()).includes('Master')
  );

  readonly isReferrer = computed(() => {
    const roles = getUserRoles(this.currentUser());
    return roles.includes('Referenciador') && !roles.includes('Colaborador') && !roles.includes('Colaborador - Referenciador');
  });

  readonly isComercial = computed(() =>
    getUserRoles(this.currentUser()).includes('Comercial')
  );

  // ── static config ──────────────────────────────────────────────────────────

  readonly productsByTariff = computed<ComparatorProductsByTariff>(() =>
    buildProductsByTariff(this.comparatorService.tariffs())
  );

  readonly feeLockedProducts = FEE_LOCKED_PRODUCTS;

  // ── comparison flow: compare/OCR/SIPS/form/download ─────────────────────────

  private readonly comparison = new ComparisonController(
    this.comparatorService,
    this.sipsService,
    {
      currentUserId:  () => this.auth.currentUser()?.id,
      isMaster:       () => this.isMaster(),
      isReferrer:     () => this.isReferrer(),
      users:          () => this.users(),
      commission:     () => this.commissionService.commission(),
      subUserPoolPct: () => this.subUserPoolPct(),
    },
  );

  // Signals expuestos por referencia directa (mismo objeto) para no tocar el .html existente.
  readonly loading        = this.comparison.loading;
  readonly modalOpen      = this.comparison.modalOpen;
  readonly result         = this.comparison.result;
  readonly ocrResult      = this.comparison.ocrResult;
  readonly fileId         = this.comparison.fileId;
  readonly selectedUserId = this.comparison.selectedUserId;
  readonly comisionBase   = this.comparison.comisionBase;
  readonly sipsAnnualKwh  = this.comparison.sipsAnnualKwh;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.comparatorService.loadTariffs();
      const userId = this.auth.currentUser()?.id;
      if (userId) {
        this.subUsersService.getMyCommission().subscribe({
          next: myCommission => {
            this.subUserPoolPct.set(myCommission.percentageOfParentPool);
            this.commissionService.loadForUserOnce(myCommission.parentUserId).subscribe((parentPct: number) => {
              this.commissionService.commission.set(parentPct);
            });
          },
          error: () => {
            // 404 → not a sub-user, load own commission normally
            this.commissionService.loadForUser(String(userId));
          },
        });
      }
      if (this.isMaster()) this.loadUsers();
    }
  }

  // ── handlers ───────────────────────────────────────────────────────────────

  onCompare(event: ComparadorCompareEvent): void {
    this.comparison.onCompare(event);
  }

  onFormChange(form: ComparadorFormValue): void {
    this.comparison.onFormChange(form);
  }

  onDownload(event: ComparadorDownloadEvent): void {
    this.comparison.onDownload(event);
  }

  // ── private ────────────────────────────────────────────────────────────────

  private loadUsers() {
    this.usersLoading.set(true);
    this.userService.getByFilters({ pageSize: 200 }).subscribe({
      next: res => {
        this.users.set(
          res.items.map(u => ({
            id:            u.id,
            name:          u.fullName,
            commissionPct: u.commissions?.find(c => c.isActive)?.commissionType?.percentage ?? null,
          }))
        );
        this.usersLoading.set(false);
      },
      error: () => this.usersLoading.set(false),
    });
  }
}
