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
import { getRoleLabel, UserRole } from '../../../../entities/user-role';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent, InputFieldComponent,
    SelectFieldComponent, ButtonComponent, AlertComponent,
    AddUserModalComponent, UserActionsMenuComponent,
  ],
  templateUrl: './users-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPageComponent implements AfterViewInit {
  @ViewChild('actionsTpl') private actionsTpl!: TemplateRef<{ $implicit: UserRow }>;

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
  readonly data      = signal<UserRow[]>([]);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  readonly columns = signal<TableColumn<UserRow>[]>([
    { key: 'fullName', label: 'Nombre' },
    { key: 'email',    label: 'Email', textColor: 'text-muted-foreground' },
    // { key: 'phone',    label: 'Teléfono' },
    { key: 'role',     label: 'Rol', align: 'center', format: row => getRoleLabel(row.role) },
    { key: 'isActive', label: 'Estado', align: 'center',
      format: row => row.isActive ? 'Activo' : 'Inactivo' },
    { key: 'isEnergyExpert', label: 'Energy Expert', align: 'center',
      format: row => row.isEnergyExpert ? 'Sí' : 'No' },
    { key: 'commissions', label: 'Comisión', align: 'center',
      format: row => row.commissions?.find(c => c.isActive)?.commissionType?.name ?? '-' },
  ]);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => [
      ...cols,
      { key: 'actions', label: '', align: 'center', cellTemplate: this.actionsTpl },
    ]);
  }

  load() {
    this.userService.getByFilters({
      fullName: this.filterName()  || undefined,
      email:    this.filterEmail() || undefined,
      role:     this.filterRole()  || undefined,
      page:     this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe(res => {
      this.data.set(res.items as unknown as UserRow[]);
      this.totalCount.set(res.totalCount);
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
