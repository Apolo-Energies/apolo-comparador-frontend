import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed,
  HostListener, inject, signal, PLATFORM_ID, TemplateRef, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, AlertService, ButtonComponent, ComboboxComponent, ComboboxOption, SelectOption } from '@apolo-energies/ui';
import { AuthService } from '@apolo-energies/auth';
import { ApoloIcons, DateIcon, DownloadIcon, filterIcon, StarIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { UserService } from '../../../../services/user.service';
import { SubUsersService } from '../../../../services/sub-users.service';
import { PotentialParent } from '../../../../entities/user.model';
import { AddUserModalComponent } from './add-user-modal/add-user-modal';
import { AddCommercialModalComponent, CommercialFormValue, CommercialParent } from './add-commercial-modal/add-commercial-modal';
import { ManageCommissionsModalComponent, CommissionsParent } from './manage-commissions-modal/manage-commissions-modal';
import { UserActionsMenuComponent, UserRow, SubUserSummary } from './user-actions-menu/user-actions-menu.component';
import { getRoleLabel, UserRole } from '../../../../entities/user-role';
import { getUserRoles } from '../../../../utils/auth.utils';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    ComboboxComponent, ButtonComponent, AlertComponent,
    AddUserModalComponent, AddCommercialModalComponent, ManageCommissionsModalComponent,
    UserActionsMenuComponent, TableSkeletonComponent,
    ApoloIcons,
  ],
  templateUrl: './users-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host ::ng-deep lib-data-table th:first-child,
    :host ::ng-deep lib-data-table td:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      box-shadow: 4px 0 8px -4px rgba(0, 0, 0, 0.4);
    }
    :host ::ng-deep lib-data-table th:first-child {
      background: var(--color-card);
    }
    :host ::ng-deep lib-data-table td:first-child {
      background: var(--color-card);
    }
    :host ::ng-deep lib-data-table tr:hover td:first-child {
      background: var(--color-body);
    }

    /* Recolor the expand-row badge ("2" next to the chevron) to the primary brand color. */
    :host ::ng-deep lib-data-table tbody button > span.rounded-full {
      background-color: color-mix(in srgb, var(--color-primary-button) 18%, transparent);
      color: var(--color-primary-button);
    }

    /* "Asignado a" badge — compact chip with the Master name. */
    :host ::ng-deep .parent-badge {
      background-color: color-mix(in srgb, var(--color-primary-button) 15%, transparent);
      color: var(--color-primary-button);
      border: 1px solid color-mix(in srgb, var(--color-primary-button) 30%, transparent);
    }

    /* Header filter icon — keep th div as flex-row, make the icon span block so
       when expanded the input fills available space rather than overflowing. */
    :host ::ng-deep lib-data-table thead th > div > span:last-child {
      display: flex;
      align-items: center;
      flex: 1;
    }

    /* "Añadir comercial" contextual CTA at the bottom of an expanded collaborator. */
    :host ::ng-deep .add-commercial-row:hover {
      background-color: color-mix(in srgb, var(--color-primary-button) 8%, transparent);
    }
    :host ::ng-deep .add-commercial-btn {
      color: color-mix(in srgb, var(--color-primary-button) 85%, transparent);
      cursor: pointer;
    }
    :host ::ng-deep .add-commercial-btn:hover {
      color: var(--color-primary-button);
    }
    :host ::ng-deep .add-commercial-plus {
      border-color: color-mix(in srgb, var(--color-primary-button) 50%, transparent);
      color: var(--color-primary-button);
      background-color: color-mix(in srgb, var(--color-primary-button) 10%, transparent);
    }
    :host ::ng-deep .add-commercial-btn:hover .add-commercial-plus {
      border-color: var(--color-primary-button);
      background-color: color-mix(in srgb, var(--color-primary-button) 18%, transparent);
    }

    /* "Gestionar comisiones" contextual link — matches the "Añadir comercial" tone. */
    :host ::ng-deep .manage-commissions-row:hover {
      background-color: color-mix(in srgb, var(--color-primary-button) 8%, transparent);
    }
    :host ::ng-deep .manage-commissions-btn {
      color: color-mix(in srgb, var(--color-primary-button) 85%, transparent);
      cursor: pointer;
    }
    :host ::ng-deep .manage-commissions-btn:hover {
      color: var(--color-primary-button);
    }
    :host ::ng-deep .manage-commissions-icon {
      border-color: color-mix(in srgb, var(--color-primary-button) 50%, transparent);
      color: var(--color-primary-button);
      background-color: color-mix(in srgb, var(--color-primary-button) 10%, transparent);
    }
    :host ::ng-deep .manage-commissions-btn:hover .manage-commissions-icon {
      border-color: var(--color-primary-button);
      background-color: color-mix(in srgb, var(--color-primary-button) 18%, transparent);
    }
  `],
})
export class UsersPageComponent implements AfterViewInit {
  @ViewChild('actionsTpl')        private actionsTpl!:        TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('contractStatusTpl') private contractStatusTpl!: TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('createdAtCellTpl')  private createdAtCellTpl!:  TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('parentCellTpl')     private parentCellTpl!:     TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('selectCellTpl')     private selectCellTpl!:     TemplateRef<{ $implicit: UserRow }>;

  // Header filter templates (injected via headerIconTemplate per column)
  @ViewChild('nameHeaderTpl')   private nameHeaderTpl!:   TemplateRef<void>;
  @ViewChild('emailHeaderTpl')  private emailHeaderTpl!:  TemplateRef<void>;
  @ViewChild('roleHeaderTpl')   private roleHeaderTpl!:   TemplateRef<void>;
  @ViewChild('parentHeaderTpl') private parentHeaderTpl!: TemplateRef<void>;

  private userService     = inject(UserService);
  private subUsersService = inject(SubUsersService);
  private platformId      = inject(PLATFORM_ID);
  private globalLoading   = inject(GlobalLoadingService);
  private auth            = inject(AuthService);
  private alertService    = inject(AlertService);

  // icons
  readonly colFilterIcon: UiIconSource = { type: 'apolo', icon: filterIcon,   size: 12 };
  readonly starIcon:      UiIconSource = { type: 'apolo', icon: StarIcon,     size: 16 };
  readonly downloadIcon:  UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };
  readonly xIcon:         UiIconSource = { type: 'apolo', icon: XIcon,        size: 16 };
  readonly dateIconSrc:   UiIconSource = { type: 'apolo', icon: DateIcon,     size: 16 };

  // filters
  readonly filterName         = signal('');
  readonly filterEmail        = signal('');
  readonly filterRole         = signal('');
  readonly filterParentUserId = signal('');

  // pagination
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly totalCount  = signal(0);

  readonly modalOpen = signal(false);
  readonly loading   = signal(false);
  readonly data      = signal<UserRow[]>([]);

  // Add-commercial contextual modal
  readonly commercialModalOpen = signal(false);
  readonly commercialParent    = signal<CommercialParent | null>(null);
  readonly commercialSaving    = signal(false);

  // Manage-commissions modal (edit % of every commercial of a given collaborator)
  readonly commissionsModalOpen = signal(false);
  readonly commissionsParent    = signal<CommissionsParent | null>(null);

  /** Comercial role value expected by the backend (UserRoles.Comercial = 16). */
  private static readonly ROLE_COMERCIAL = 16;

  readonly potentialParents = signal<PotentialParent[]>([]);

  // bulk selection
  readonly selectedIds        = signal<ReadonlySet<string>>(new Set());
  readonly selectedCount      = computed(() => this.selectedIds().size);
  readonly hasSelection       = computed(() => this.selectedCount() > 0);
  readonly allCurrentSelected = computed(() => {
    const rows = this.data();
    if (rows.length === 0) return false;
    const set = this.selectedIds();
    return rows.every(r => set.has(r.id));
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  readonly isApolo  = environment.features.userDetail;
  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));

  /** Display name of the currently active parent filter. */
  readonly parentLabel = computed(() =>
    this.potentialParents().find(p => p.id === this.filterParentUserId())?.fullName ?? '…'
  );

  /** Combobox options for the table-level "Asignado a" filter (includes an "All" entry). */
  readonly parentComboboxOptions = computed<ComboboxOption[]>(() => [
    { id: '', name: 'Todos' },
    ...this.potentialParents().map(p => ({ id: p.id, name: p.fullName })),
  ]);

  /** Combobox options for the bulk assignment dropdown (includes a "Detach" entry). */
  readonly parentComboboxOptionsForBulk = computed<ComboboxOption[]>(() => [
    { id: '__unassign__', name: '— Sin asignar —' },
    ...this.potentialParents().map(p => ({ id: p.id, name: p.fullName })),
  ]);

  readonly columns = signal<TableColumn<UserRow>[]>(
    this.isApolo ? [] : [
      { key: 'fullName',       label: 'Nombre' },
      { key: 'email',          label: 'Email', textColor: 'text-muted-foreground' },
      { key: 'role',           label: 'Rol',           align: 'center', format: row => getRoleLabel(row.role) },
      { key: 'isActive',       label: 'Estado',        align: 'center', format: row => row.isActive ? 'Activo' : 'Inactivo' },
      { key: 'isEnergyExpert', label: 'Energy Expert', align: 'center', format: row => row.isEnergyExpert ? 'Sí' : 'No' },
      { key: 'commissions',    label: 'Comisión',      align: 'center', format: row => row.commissions?.find(c => c.isActive)?.commissionType?.name ?? '-' },
      { key: 'createdAt',      label: 'Fecha de alta' },
    ]
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadPotentialParents();
      this.initFilterAndLoad();
    }
  }

  private initFilterAndLoad(): void {
    const me = this.auth.currentUser();
    if (!me?.id || !this.isMaster()) {
      this.load();
      return;
    }

    const meId = String(me.id);
    this.userService.getById(meId).subscribe({
      next: detail => {
        if (detail?.parentUserId) {
          this.filterParentUserId.set(meId);
        }
        this.load();
      },
      error: () => this.load(),
    });
  }

  ngAfterViewInit(): void {
    if (this.isApolo) {
      const cols: TableColumn<UserRow>[] = [];

      if (this.isMaster()) {
        cols.push({ key: '_select', label: '', align: 'center', cellTemplate: this.selectCellTpl });
      }

      cols.push(
        { key: 'fullName',                label: 'Razón Social',    headerIconTemplate: this.nameHeaderTpl },
        { key: 'customer',                label: 'SIPS/DNI',        format: row => {
            const c = row.customer;
            if (!c) return '-';
            return c.personType === 'Individual' ? (c.dni ?? '-') : (c.cif ?? '-');
          }
        },
        { key: 'email',                   label: 'Email',           headerIconTemplate: this.emailHeaderTpl },
        { key: 'phone',                   label: 'Teléfono',        format: row => row.phone || '-' },
        { key: 'role',                    label: 'Rol',             align: 'center', format: row => getRoleLabel(row.role), headerIconTemplate: this.roleHeaderTpl },
        { key: 'parentFullName',          label: 'Asignado a',      align: 'center', cellTemplate: this.parentCellTpl, headerIconTemplate: this.parentHeaderTpl },
        { key: 'contractSignatureStatus', label: 'Estado Contrato', align: 'center', cellTemplate: this.contractStatusTpl },
        { key: 'isEnergyExpert',          label: 'Energy Expert',   align: 'center', format: row => row.isEnergyExpert ? 'Sí' : 'No' },
        { key: 'commissions',             label: 'Comisión',        align: 'center', format: row => row.commissions?.find(c => c.isActive)?.commissionType?.name ?? '-' },
        { key: 'provider',                label: 'Proveedor',       align: 'center', format: row => row.provider?.name ?? '-' },
        { key: 'isActive',                label: 'Estado Usuario',  align: 'center', format: row => row.isActive ? 'Activo' : 'Inactivo' },
        { key: 'createdAt',               label: 'Fecha de alta',   cellTemplate: this.createdAtCellTpl },
        { key: 'actions',                 label: '',                align: 'center', cellTemplate: this.actionsTpl },
      );

      this.columns.set(cols);
    } else {
      this.columns.update(cols => cols.map(col =>
        col.key === 'createdAt' ? { ...col, cellTemplate: this.createdAtCellTpl } : col
      ).concat([{ key: 'actions', label: '', align: 'center', cellTemplate: this.actionsTpl }]));
    }
  }

  formatDate(iso: string | undefined): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('es-ES', {
      day:    '2-digit',
      month:  'short',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    });
  }

  private static readonly CONTRACT_STATUS_MAP: Record<string, { label: string; cls: string }> = {
    Pending:      { label: 'Pendiente',       cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
    Signed:       { label: 'Firmado',         cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    Declined:     { label: 'Cancelado',       cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    Expired:      { label: 'Vencido',         cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    InProgress:   { label: 'En firma',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    ReadyToSign:  { label: 'Listo p/firma',   cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
    DocsPending:  { label: 'Docs pendientes', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    Active:       { label: 'Activo',          cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    ExpiringSoon: { label: 'Por vencer',      cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
    NoContract:   { label: 'Sin contrato',    cls: 'bg-muted text-muted-foreground' },
  };

  contractStatusLabel(status: string | null | undefined): string {
    if (!status) return 'Sin contrato';
    return UsersPageComponent.CONTRACT_STATUS_MAP[status]?.label ?? status;
  }

  load() {
    this.loading.set(true);
    this.globalLoading.start();
    this.userService.getByFilters({
      fullName:     this.filterName()         || undefined,
      email:        this.filterEmail()        || undefined,
      role:         this.filterRole()         || undefined,
      parentUserId: this.filterParentUserId() || undefined,
      page:         this.currentPage(),
      pageSize:     this.pageSize(),
    }).subscribe({
      next: res => {
        this.data.set(res.items as unknown as UserRow[]);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: () => { this.loading.set(false); this.globalLoading.stop(); },
    });
  }

  private loadPotentialParents(): void {
    this.userService.getPotentialParents().subscribe({
      next: list => this.potentialParents.set(list),
      error: () => this.potentialParents.set([]),
    });
  }

  onSaved() {
    this.modalOpen.set(false);
    this.load();
    this.loadPotentialParents();
  }

  openAddCommercialFor(parent: UserRow): void {
    this.commercialParent.set({ id: parent.id, fullName: parent.fullName });
    this.commercialModalOpen.set(true);
  }

  openCommissions(parent: UserRow): void {
    this.commissionsParent.set({ id: parent.id, fullName: parent.fullName });
    this.commissionsModalOpen.set(true);
  }

  onCommissionsClosed(): void {
    this.commissionsModalOpen.set(false);
    this.commissionsParent.set(null);
  }

  onCommercialCancelled(): void {
    this.commercialModalOpen.set(false);
    this.commercialParent.set(null);
  }

  onCreateCommercial(value: CommercialFormValue): void {
    const parent = this.commercialParent();
    if (!parent) return;

    this.commercialSaving.set(true);
    this.userService.create({
      personType:   0,
      email:        value.email,
      role:         UsersPageComponent.ROLE_COMERCIAL,
      name:         value.name,
      surnames:     value.surnames,
      parentUserId: parent.id,
    }).subscribe({
      next: (created) => {
        const percentage = value.commissionPercentage;
        if (percentage != null && created?.id) {
          this.subUsersService.assignCommission({
            parentUserId: parent.id,
            subUserId:    created.id,
            percentage,
          }).subscribe({
            next: () => this.finishCommercialCreation(parent.fullName, percentage),
            error: () => {
              this.commercialSaving.set(false);
              this.commercialModalOpen.set(false);
              this.commercialParent.set(null);
              this.alertService.show(
                `Comercial creado, pero no se pudo asignar la comisión (${percentage}%). Asígnala desde "Gestionar comisiones".`,
                'error',
              );
              this.load();
            },
          });
        } else {
          this.finishCommercialCreation(parent.fullName, null);
        }
      },
      error: (err) => {
        this.commercialSaving.set(false);
        if (err?.status === 409) {
          this.alertService.show('Ya existe un usuario con ese email', 'error');
        } else if (err?.status === 403) {
          this.alertService.show('No tienes permiso para crear este comercial', 'error');
        } else {
          this.alertService.show('No se pudo crear el comercial', 'error');
        }
      },
    });
  }

  private finishCommercialCreation(parentName: string, percentage: number | null): void {
    this.commercialSaving.set(false);
    this.commercialModalOpen.set(false);
    this.commercialParent.set(null);
    const suffix = percentage != null ? ` con ${percentage}% de comisión` : '';
    this.alertService.show(`Comercial añadido a ${parentName}${suffix}`, 'success');
    this.load();
  }

  onSearch() {
    this.currentPage.set(1);
    this.load();
  }

  onClearFilters() {
    this.filterName.set('');
    this.filterEmail.set('');
    this.filterRole.set('');
    this.filterParentUserId.set('');
    this.currentPage.set(1);
    this.load();
  }

  // ─── Header filter handlers ──────────────────────────────────────────────────

  readonly openFilter = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.openFilter.set(null);
  }

  toggleFilter(col: string, e: MouseEvent): void {
    e.stopPropagation();
    const next = this.openFilter() === col ? null : col;
    this.openFilter.set(next);
    if (next) {
      setTimeout(() => {
        (document.querySelector(`[data-col-filter="${col}"]`) as HTMLElement | null)?.focus();
      }, 30);
    }
  }

  closeFilter(): void {
    this.openFilter.set(null);
  }

  clearFilter(col: 'name' | 'email' | 'role' | 'parent'): void {
    if (col === 'name')   this.filterName.set('');
    if (col === 'email')  this.filterEmail.set('');
    if (col === 'role')   this.filterRole.set('');
    if (col === 'parent') this.filterParentUserId.set('');
    this.openFilter.set(null);
    this.currentPage.set(1);
    this.load();
  }

  applyFilter(): void {
    this.openFilter.set(null);
    this.currentPage.set(1);
    this.load();
  }

  onHeaderNameInput(e: Event): void {
    this.filterName.set((e.target as HTMLInputElement).value);
  }

  onHeaderEmailInput(e: Event): void {
    this.filterEmail.set((e.target as HTMLInputElement).value);
  }

  onHeaderRoleChange(e: Event): void {
    this.filterRole.set((e.target as HTMLSelectElement).value);
    this.openFilter.set(null);
    this.currentPage.set(1);
    this.load();
  }

  onHeaderParentChange(e: Event): void {
    this.filterParentUserId.set((e.target as HTMLSelectElement).value);
    this.openFilter.set(null);
    this.currentPage.set(1);
    this.load();
  }

  onExport(): void {
    this.userService.downloadExcel().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users-report.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.clearSelection();
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.clearSelection();
    this.load();
  }

  onAssignParent(userId: string, parentUserId: string | null): void {
    this.userService.assignParent(userId, parentUserId).subscribe({
      next: () => {
        this.alertService.show('Asignación actualizada correctamente', 'success');
        this.load();
      },
      error: () => this.alertService.show('No se pudo actualizar la asignación', 'error'),
    });
  }

  // ─── Bulk selection ─────────────────────────────────────────────────────────

  isRowSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleRow(id: string): void {
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  toggleAllInPage(): void {
    const rows = this.data();
    this.selectedIds.update(current => {
      const next = new Set(current);
      const everySelected = rows.every(r => next.has(r.id));
      if (everySelected) rows.forEach(r => next.delete(r.id));
      else               rows.forEach(r => next.add(r.id));
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  onBulkComboboxChange(value: string | number): void {
    const raw = String(value ?? '');
    if (!raw) return;
    const parentId = raw === '__unassign__' ? null : raw;
    this.bulkAssignTo(parentId);
  }

  bulkAssignTo(parentId: string | null): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.userService.bulkAssignParent(ids, parentId).subscribe({
      next: () => {
        const label = parentId
          ? this.potentialParents().find(p => p.id === parentId)?.fullName ?? 'el seleccionado'
          : 'Sin asignar';
        this.alertService.show(`${ids.length} usuario(s) asignados a ${label}`, 'success');
        this.clearSelection();
        this.load();
      },
      error: (err) => {
        console.error('[bulk-assign-parent] error', err);
        const serverMsg =
          err?.error?.detail ||
          err?.error?.title ||
          err?.error?.message ||
          (typeof err?.error === 'string' ? err.error : null);
        const msg = serverMsg
          ? `Error ${err.status ?? ''}: ${serverMsg}`.trim()
          : `No se pudo completar la asignación masiva (HTTP ${err?.status ?? '?'})`;
        this.alertService.show(msg, 'error');
      },
    });
  }

  readonly rowIsExpandable = (row: UserRow) => {
    if (this.isMasterRow(row)) return false;
    if (this.canReceiveCommercials(row)) return true;
    return (row.subUsers?.length ?? 0) > 0;
  };

  readonly rowBadge = (row: UserRow) => {
    if (this.isMasterRow(row)) return null;
    const count = row.subUsers?.length ?? 0;
    return count > 0 ? count : null;
  };

  private isMasterRow(row: UserRow): boolean {
    return row.role === UserRole.MASTER || row.role === 'Master';
  }

  canReceiveCommercials(row: UserRow): boolean {
    return row.role === UserRole.COLLABORATOR
        || row.role === UserRole.COLLABORATOR_REFERRER
        || row.role === 'Colaborador'
        || row.role === 'Colaborador - Referenciador';
  }

  toSubUserRow(sub: SubUserSummary): UserRow {
    return {
      id:             sub.id,
      fullName:       sub.fullName,
      email:          sub.email,
      phone:          null,
      role:           sub.role,
      isActive:       sub.isActive,
      isEnergyExpert: false,
      commissions:    [],
      providerId:     sub.providerId,
      provider:       null,
      isSubUser:      true,
    };
  }

  readonly roleOptions: SelectOption[] = [
    { value: 'Master',        label: 'Master' },
    { value: 'Colaborador',   label: 'Colaborador' },
    { value: 'Referenciador', label: 'Referenciador' },
    { value: 'Tester',        label: 'Tester' },
  ];

}
