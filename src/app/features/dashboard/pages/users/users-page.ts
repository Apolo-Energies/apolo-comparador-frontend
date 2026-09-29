import {
  AfterViewInit, ChangeDetectionStrategy, Component, computed, HostListener,
  inject, signal, PLATFORM_ID, TemplateRef, ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, AlertService, ButtonComponent, ComboboxComponent, SelectOption } from '@apolo-energies/ui';
import { AuthService } from '@apolo-energies/auth';
import { ApoloIcons, DateIcon, DownloadIcon, filterIcon, StarIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { UserService } from '../../../../core/services/user.service';
import { SubUsersService } from '../../../../core/services/sub-users.service';
import { AddUserModalComponent } from './add-user-modal/add-user-modal';
import { AddCommercialModalComponent } from './add-commercial-modal/add-commercial-modal';
import { ManageCommissionsModalComponent, CommissionsParent } from './manage-commissions-modal/manage-commissions-modal';
import { UserActionsMenuComponent, UserRow } from './user-actions-menu/user-actions-menu.component';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { environment } from '../../../../../environments/environment';
import {
  appendBasicColumnsExtras, BASIC_USER_COLUMNS, buildApoloColumns,
  canUserReceiveCommercials, computeRowExpandBadge, computeRowExpandable,
  formatUserCreatedAt, getContractStatusLabel, mapSubUserToRow, ROLE_OPTIONS,
} from './users-page.helpers';
import { UsersTableFiltersController } from './users-table-filters.controller';
import { UsersBulkSelectionController } from './users-bulk-selection.controller';
import { UsersCommercialFlowController } from './users-commercial-flow.controller';
import { UsersDataController } from './users-data.controller';

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
  styleUrl: './users-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersPageComponent implements AfterViewInit {
  @ViewChild('actionsTpl')        private actionsTpl!:        TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('contractStatusTpl') private contractStatusTpl!: TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('createdAtCellTpl')  private createdAtCellTpl!:  TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('parentCellTpl')     private parentCellTpl!:     TemplateRef<{ $implicit: UserRow }>;
  @ViewChild('selectCellTpl')     private selectCellTpl!:     TemplateRef<{ $implicit: UserRow }>;

  // Header filter templates (injected via headerIconTemplate per column)
  @ViewChild('nameHeaderTpl')       private nameHeaderTpl!:       TemplateRef<void>;
  @ViewChild('emailHeaderTpl')      private emailHeaderTpl!:      TemplateRef<void>;
  @ViewChild('roleHeaderTpl')       private roleHeaderTpl!:       TemplateRef<void>;
  @ViewChild('parentHeaderTpl')     private parentHeaderTpl!:     TemplateRef<void>;
  @ViewChild('identifierHeaderTpl') private identifierHeaderTpl!: TemplateRef<void>;
  @ViewChild('phoneHeaderTpl')      private phoneHeaderTpl!:      TemplateRef<void>;
  @ViewChild('commissionHeaderTpl') private commissionHeaderTpl!: TemplateRef<void>;

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

  readonly isApolo  = environment.features.userDetail;
  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));

  // Per-column header filters (state + handlers live in the controller; R1). Public: the
  // template talks to it directly, keeping this page free of one-line delegate methods.
  readonly tableFilters = new UsersTableFiltersController(() => {
    this.usersData.currentPage.set(1);
    this.usersData.load();
  });

  // Table data, pagination and reference lookups (state + fetch/export flow live in the
  // controller; R1). Public: the template reads/calls it directly.
  readonly usersData = new UsersDataController({
    userService:   this.userService,
    alertService:  this.alertService,
    globalLoading: this.globalLoading,
    auth:          this.auth,
    tableFilters:  this.tableFilters,
    getIsMaster:   () => this.isMaster(),
  });

  readonly modalOpen = signal(false);

  // Add-commercial contextual modal (state + save/error flow live in the controller; R1).
  readonly commercialFlow = new UsersCommercialFlowController({
    userService:     this.userService,
    subUsersService: this.subUsersService,
    alertService:    this.alertService,
    onSaved:         () => this.usersData.load(),
  });

  // Manage-commissions modal (edit % of every commercial of a given collaborator)
  readonly commissionsModalOpen = signal(false);
  readonly commissionsParent    = signal<CommissionsParent | null>(null);

  // Bulk selection (state + bulk-assign flow live in the controller; R1).
  readonly bulkSelection = new UsersBulkSelectionController({
    userService:        this.userService,
    alertService:       this.alertService,
    getRows:             () => this.usersData.data(),
    getPotentialParents: () => this.usersData.potentialParents(),
    onAssigned:          () => this.usersData.load(),
  });

  readonly columns = signal<TableColumn<UserRow>[]>(this.isApolo ? [] : BASIC_USER_COLUMNS);

  readonly roleOptions: SelectOption[] = ROLE_OPTIONS;

  // Pure lookups/formatters — reused as-is, no per-instance logic needed.
  readonly formatDate            = formatUserCreatedAt;
  readonly contractStatusLabel   = getContractStatusLabel;
  readonly canReceiveCommercials = canUserReceiveCommercials;
  readonly toSubUserRow          = mapSubUserToRow;
  readonly rowIsExpandable       = (row: UserRow) => computeRowExpandable(row);
  readonly rowBadge              = (row: UserRow) => computeRowExpandBadge(row);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.usersData.init();
    }
  }

  ngAfterViewInit(): void {
    if (this.isApolo) {
      this.columns.set(buildApoloColumns({
        selectCellTpl:       this.selectCellTpl,
        nameHeaderTpl:       this.nameHeaderTpl,
        identifierHeaderTpl: this.identifierHeaderTpl,
        emailHeaderTpl:      this.emailHeaderTpl,
        phoneHeaderTpl:      this.phoneHeaderTpl,
        roleHeaderTpl:       this.roleHeaderTpl,
        parentCellTpl:       this.parentCellTpl,
        parentHeaderTpl:     this.parentHeaderTpl,
        contractStatusTpl:   this.contractStatusTpl,
        commissionHeaderTpl: this.commissionHeaderTpl,
        createdAtCellTpl:    this.createdAtCellTpl,
        actionsTpl:          this.actionsTpl,
      }, this.isMaster()));
    } else {
      this.columns.update(cols => appendBasicColumnsExtras(cols, this.createdAtCellTpl, this.actionsTpl));
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.tableFilters.onDocumentClick();
  }

  onSaved(): void {
    this.modalOpen.set(false);
    this.usersData.load();
    this.usersData.loadPageInit();
  }

  openCommissions(parent: UserRow): void {
    this.commissionsParent.set({ id: parent.id, fullName: parent.fullName });
    this.commissionsModalOpen.set(true);
  }

  onCommissionsClosed(): void {
    this.commissionsModalOpen.set(false);
    this.commissionsParent.set(null);
  }

  onPageChange(page: number): void {
    this.bulkSelection.clearSelection();
    this.usersData.onPageChange(page);
  }

  onPageSizeChange(size: number): void {
    this.bulkSelection.clearSelection();
    this.usersData.onPageSizeChange(size);
  }
}
