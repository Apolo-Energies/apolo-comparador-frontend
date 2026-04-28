import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed,
  inject, signal, PLATFORM_ID, TemplateRef, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, ButtonComponent, InputFieldComponent, SelectFieldComponent, SelectOption } from '@apolo-energies/ui';
import { DownloadIcon, filterIcon, SearchIcon, StarIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { UserService } from '../../../../services/user.service';
import { AddUserModalComponent } from './add-user-modal/add-user-modal';
import { UserActionsMenuComponent, UserRow } from './user-actions-menu/user-actions-menu.component';
import { getRoleLabel } from '../../../../entities/user-role';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent, InputFieldComponent,
    SelectFieldComponent, ButtonComponent, AlertComponent,
    AddUserModalComponent, UserActionsMenuComponent, LoadingOverlayComponent,
  ],
  templateUrl: './users-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPageComponent implements AfterViewInit {
  @ViewChild('actionsTpl')         private actionsTpl!: TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('contractStatusTpl') private contractStatusTpl!: TemplateRef<{ $implicit: UserRow }>;

  private userService = inject(UserService);
  private platformId  = inject(PLATFORM_ID);

  // icons
  readonly searchIcon:   UiIconSource = { type: 'apolo', icon: SearchIcon,   size: 16 };
  readonly filterIcon:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 16 };
  readonly starIcon:     UiIconSource = { type: 'apolo', icon: StarIcon,     size: 16 };
  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };
  readonly xIcon:        UiIconSource = { type: 'apolo', icon: XIcon,        size: 16 };

  // filters
  readonly filterName  = signal('');
  readonly filterEmail = signal('');
  readonly filterRole  = signal('');

  // pagination
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly totalCount  = signal(0);

  readonly modalOpen = signal(false);
  readonly loading   = signal(false);
  readonly data      = signal<UserRow[]>([]);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  private readonly isApolo = environment.features.userDetail;

  readonly columns = signal<TableColumn<UserRow>[]>(
    this.isApolo ? [] : [
      { key: 'fullName',       label: 'Nombre' },
      { key: 'email',          label: 'Email', textColor: 'text-muted-foreground' },
      { key: 'role',           label: 'Rol',           align: 'center', format: row => getRoleLabel(row.role) },
      { key: 'isActive',       label: 'Estado',        align: 'center', format: row => row.isActive ? 'Activo' : 'Inactivo' },
      { key: 'isEnergyExpert', label: 'Energy Expert', align: 'center', format: row => row.isEnergyExpert ? 'Sí' : 'No' },
      { key: 'commissions',    label: 'Comisión',      align: 'center', format: row => row.commissions?.find(c => c.isActive)?.commissionType?.name ?? '-' },
    ]
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit(): void {
    if (this.isApolo) {
      this.columns.set([
        { key: 'fullName',                label: 'Razón Social' },
        { key: 'customer',                label: 'SIPS/DNI',        format: row => {
            const c = row.customer;
            if (!c) return '-';
            return c.personType === 'Individual' ? (c.dni ?? '-') : (c.cif ?? '-');
          }
        },
        { key: 'email',                   label: 'Usuario' },
        { key: 'phone',                   label: 'Teléfono',        format: row => row.phone || '-' },
        { key: 'role',                    label: 'Rol',             align: 'center', format: row => getRoleLabel(row.role) },
        { key: 'contractSignatureStatus', label: 'Estado Contrato', align: 'center', cellTemplate: this.contractStatusTpl },
        { key: 'isEnergyExpert',          label: 'Energy Expert',   align: 'center', format: row => row.isEnergyExpert ? 'Sí' : 'No' },
        { key: 'commissions',             label: 'Comisión',        align: 'center', format: row => row.commissions?.find(c => c.isActive)?.commissionType?.name ?? '-' },
        { key: 'provider',                label: 'Proveedor',       align: 'center', format: row => row.provider?.name ?? '-' },
        { key: 'isActive',                label: 'Estado Usuario',  align: 'center', format: row => row.isActive ? 'Activo' : 'Inactivo' },
        { key: 'actions',                 label: '',                align: 'center', cellTemplate: this.actionsTpl },
      ]);
    } else {
      this.columns.update(cols => [
        ...cols,
        { key: 'actions', label: '', align: 'center', cellTemplate: this.actionsTpl },
      ]);
    }
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
    this.userService.getByFilters({
      fullName: this.filterName()  || undefined,
      email:    this.filterEmail() || undefined,
      role:     this.filterRole()  || undefined,
      page:     this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe({
      next: res => {
        this.data.set(res.items as unknown as UserRow[]);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSaved() {
    this.modalOpen.set(false);
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
    this.load();
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  readonly roleOptions: SelectOption[] = [
    { value: 'Master',        label: 'Master' },
    { value: 'Colaborador',   label: 'Colaborador' },
    { value: 'Referenciador', label: 'Referenciador' },
    { value: 'Tester',        label: 'Tester' },
  ];

}
