import { computed, signal } from '@angular/core';
import { AuthService } from '@apolo-energies/auth';
import { AlertService, ComboboxOption } from '@apolo-energies/ui';
import { UserService } from '../../../../core/services/user.service';
import { CommissionRow } from '../../../../core/services/commission.service';
import { PotentialParent } from '../../../../core/models/user.model';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { UserRow } from './user-actions-menu/user-actions-menu.component';
import { UsersTableFiltersController } from './users-table-filters.controller';
import { buildBulkParentComboboxOptions, buildParentComboboxOptions } from './users-page.helpers';

export interface UsersDataDeps {
  userService: UserService;
  alertService: AlertService;
  globalLoading: GlobalLoadingService;
  auth: AuthService;
  tableFilters: UsersTableFiltersController;
  getIsMaster: () => boolean;
}

/**
 * Encapsulates the users-table data lifecycle: pagination, the main list
 * fetch, the "page init" reference data (potential parents / commissions)
 * and the actions that mutate/export it. Extracted from UsersPageComponent
 * to keep it under the file-size guideline (R1).
 */
export class UsersDataController {
  constructor(private readonly deps: UsersDataDeps) {}

  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly totalCount  = signal(0);

  readonly loading = signal(false);
  readonly data    = signal<UserRow[]>([]);

  readonly potentialParents = signal<PotentialParent[]>([]);
  readonly allCommissions   = signal<CommissionRow[]>([]);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  /** Display name of the currently active parent filter. */
  readonly parentLabel = computed(() =>
    this.potentialParents().find(p => p.id === this.deps.tableFilters.filterParentUserId())?.fullName ?? '…'
  );

  /** Combobox options for the table-level "Asignado a" filter (includes an "All" entry). */
  readonly parentComboboxOptions = computed<ComboboxOption[]>(() =>
    buildParentComboboxOptions(this.potentialParents())
  );

  /** Combobox options for the bulk assignment dropdown (includes a "Detach" entry). */
  readonly parentComboboxOptionsForBulk = computed<ComboboxOption[]>(() =>
    buildBulkParentComboboxOptions(this.potentialParents())
  );

  /** Loads the reference data, then the first page (pre-selecting the user's own filter when relevant). */
  init(): void {
    this.loadPageInit();
    this.initFilterAndLoad();
  }

  private initFilterAndLoad(): void {
    const me = this.deps.auth.currentUser();
    if (!me?.id || !this.deps.getIsMaster()) {
      this.load();
      return;
    }

    const meId = String(me.id);
    this.deps.userService.getById(meId).subscribe({
      next: detail => {
        if (detail?.parentUserId) {
          this.deps.tableFilters.filterParentUserId.set(meId);
        }
        this.load();
      },
      error: () => this.load(),
    });
  }

  load(): void {
    this.loading.set(true);
    this.deps.globalLoading.start();
    this.deps.userService.getByFilters({
      ...this.deps.tableFilters.getQueryParams(),
      page:     this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe({
      next: res => {
        this.data.set(res.items as unknown as UserRow[]);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
        this.deps.globalLoading.stop();
      },
      error: () => { this.loading.set(false); this.deps.globalLoading.stop(); },
    });
  }

  loadPageInit(): void {
    this.deps.userService.pageInit().subscribe({
      next: res => {
        this.potentialParents.set(res.potentialParents ?? []);
        this.allCommissions.set(res.commissions ?? []);
      },
      error: () => {
        this.potentialParents.set([]);
        this.allCommissions.set([]);
      },
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  onAssignParent(userId: string, parentUserId: string | null): void {
    this.deps.userService.assignParent(userId, parentUserId).subscribe({
      next: () => {
        this.deps.alertService.show('Asignación actualizada correctamente', 'success');
        this.load();
      },
      error: () => this.deps.alertService.show('No se pudo actualizar la asignación', 'error'),
    });
  }

  onExport(): void {
    this.deps.userService.downloadExcel().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'users-report.xlsx';
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  }
}
