import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed,
  inject, signal, PLATFORM_ID, TemplateRef, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, AlertService, ButtonComponent, ComboboxComponent, ComboboxOption, InputFieldComponent, SelectFieldComponent, SelectOption } from '@apolo-energies/ui';
import { AuthService } from '@apolo-energies/auth';
import { ApoloIcons, DateIcon, DownloadIcon, filterIcon, SearchIcon, StarIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { UserService } from '../../../../services/user.service';
import { PotentialParent } from '../../../../entities/user.model';
import { AddUserModalComponent } from './add-user-modal/add-user-modal';
import { UserActionsMenuComponent, UserRow, SubUserSummary } from './user-actions-menu/user-actions-menu.component';
import { getRoleLabel } from '../../../../entities/user-role';
import { getUserRoles } from '../../../../utils/auth.utils';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent, InputFieldComponent,
    SelectFieldComponent, ComboboxComponent, ButtonComponent, AlertComponent,
    AddUserModalComponent, UserActionsMenuComponent, TableSkeletonComponent,
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
  `],
})
export class UsersPageComponent implements AfterViewInit {
  @ViewChild('actionsTpl')        private actionsTpl!:        TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('contractStatusTpl') private contractStatusTpl!: TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('createdAtCellTpl')  private createdAtCellTpl!:  TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('parentCellTpl')     private parentCellTpl!:     TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('selectCellTpl')     private selectCellTpl!:     TemplateRef<{ $implicit: UserRow }>;

  private userService   = inject(UserService);
  private platformId    = inject(PLATFORM_ID);
  private globalLoading = inject(GlobalLoadingService);
  private auth          = inject(AuthService);
  private alertService  = inject(AlertService);

  // icons
  readonly searchIcon:   UiIconSource = { type: 'apolo', icon: SearchIcon,   size: 16 };
  readonly filterIcon:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 16 };
  readonly starIcon:     UiIconSource = { type: 'apolo', icon: StarIcon,     size: 16 };
  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };
  readonly xIcon:        UiIconSource = { type: 'apolo', icon: XIcon,        size: 16 };
  readonly dateIconSrc:  UiIconSource = { type: 'apolo', icon: DateIcon,     size: 16 };

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

  /**
   * Pre-filter rule on first load:
   *   - Non-Master: no pre-filter, the backend already restricts visibility to their subtree.
   *   - Master with a parent (Javi, Oscar, Gustavo, …): pre-filter by themselves ("mine").
   *   - Root Master (apolo, the one with parentUserId == null): no pre-filter — they see everything
   *     by default because they own the whole tree; they can still narrow down via the dropdown.
   */
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
        { key: 'fullName',                label: 'Razón Social' },
        { key: 'customer',                label: 'SIPS/DNI',        format: row => {
            const c = row.customer;
            if (!c) return '-';
            return c.personType === 'Individual' ? (c.dni ?? '-') : (c.cif ?? '-');
          }
        },
        { key: 'email',                   label: 'Email' },
        { key: 'phone',                   label: 'Teléfono',        format: row => row.phone || '-' },
        { key: 'role',                    label: 'Rol',             align: 'center', format: row => getRoleLabel(row.role) },
        { key: 'parentFullName',          label: 'Asignado a',      align: 'center', cellTemplate: this.parentCellTpl },
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
    // Refresh parents list — a newly created Master/Comercial can also be a parent.
    this.loadPotentialParents();
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
        // Surface the actual server error so we can diagnose 401 / 403 / 500 / validation issues.
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

  /**
   * Masters never show the expand chevron: their children already appear as top-level rows
   * (the top-level rule keeps them visible), so expanding would only duplicate what's on screen.
   * Comerciales keep the chevron because their sub-users are excluded from the top-level list.
   */
  readonly rowIsExpandable = (row: UserRow) =>
    !this.isMasterRow(row) && (row.subUsers?.length ?? 0) > 0;

  readonly rowBadge = (row: UserRow) =>
    this.isMasterRow(row) ? null : (row.subUsers?.length ?? null);

  private isMasterRow(row: UserRow): boolean {
    return row.role === 1 || row.role === 'Master';
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
