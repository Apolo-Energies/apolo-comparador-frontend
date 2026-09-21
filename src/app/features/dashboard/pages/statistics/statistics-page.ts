import { AfterViewInit, ChangeDetectionStrategy, Component, effect, inject, signal, PLATFORM_ID, TemplateRef, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { filterIcon, SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { DashboardStatsService } from '../../../../core/services/dashboard-stats.service';
import { StatisticsRow } from '../../../../core/services/statistics.service';
import { environment } from '../../../../../environments/environment';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { CollaboratorScopeService } from '../../../../core/services/collaborator-scope.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { StatisticsDashboardComponent } from './components/statistics-dashboard/statistics-dashboard';
import { UserDetailDialogComponent } from './components/user-detail-dialog/user-detail-dialog';
import { DateRange } from './models/dashboard-ui.model';
import { EsNumberPipe } from '../../../../shared/pipes/es-number.pipe';
import { StatisticsFiltersController, SortField } from './statistics-filters.controller';

@Component({
  selector: 'app-statistics-page',
  standalone: true,
  imports: [DataTableComponent, PaginatorComponent, InputFieldComponent, ButtonComponent, StatisticsDashboardComponent, UserDetailDialogComponent, TableSkeletonComponent],
  templateUrl: './statistics-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsPageComponent implements AfterViewInit {
  @ViewChild('cupsHeaderTpl') private cupsHeaderTpl!: TemplateRef<void>;
  @ViewChild('consumptionHeaderTpl') private consumptionHeaderTpl!: TemplateRef<void>;
  @ViewChild('actionsTpl') private actionsTpl!: TemplateRef<{ $implicit: StatisticsRow }>;
  private dashboardService   = inject(DashboardStatsService);
  private platformId         = inject(PLATFORM_ID);
  private globalLoading      = inject(GlobalLoadingService);
  private collaboratorScope  = inject(CollaboratorScopeService);
  private esNumber           = new EsNumberPipe();
  private isFirstLoad        = true;

  readonly isApolo = environment.features.userDetail;

  // icons
  readonly searchIcon:   UiIconSource = { type: 'apolo', icon: SearchIcon,   size: 16 };
  readonly filterIcon:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 16 };
  readonly xIcon:        UiIconSource = { type: 'apolo', icon: XIcon,        size: 16 };

  // Filters, sorting, pagination and the consolidated-data load flow live in
  // the controller; the page only exposes signals/handlers by reference (R1).
  private readonly filters = new StatisticsFiltersController({
    dashboardService:  this.dashboardService,
    globalLoading:     this.globalLoading,
    esNumber:          this.esNumber,
    collaboratorScope: this.collaboratorScope,
  });

  readonly filterName        = this.filters.filterName;
  readonly filterEmail       = this.filters.filterEmail;
  readonly selectedTariffId  = this.filters.selectedTariffId;
  readonly selectedProductId = this.filters.selectedProductId;
  readonly availableFilters  = this.filters.availableFilters;
  readonly availableProducts = this.filters.availableProducts;

  readonly data        = this.filters.data;
  readonly loading     = this.filters.loading;
  readonly columns     = this.filters.columns;
  readonly currentPage = this.filters.currentPage;
  readonly pageSize    = this.filters.pageSize;
  readonly totalCount  = this.filters.totalCount;
  readonly totalPages  = this.filters.totalPages;
  readonly pagedData   = this.filters.pagedData;

  readonly dateRange      = this.filters.dateRange;
  readonly summary        = this.filters.summary;
  readonly dailySummary   = this.filters.dailySummary;
  readonly monthlySummary = this.filters.monthlySummary;

  // Modal de detalle
  readonly detailDialogOpen = signal(false);
  readonly selectedUserId   = signal('');
  readonly selectedUserName = signal('');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.filters.load();
    }
    // Recarga al cambiar el colaborador seleccionado en Analítica (Master).
    // Se salta la primera ejecución del effect: el load() de arriba ya cubre la carga inicial.
    effect(() => {
      this.collaboratorScope.selected();
      if (this.isFirstLoad) { this.isFirstLoad = false; return; }
      this.filters.currentPage.set(1);
      this.filters.load();
    });
  }

  ngAfterViewInit(): void {
    this.filters.setHeaderTemplates(this.cupsHeaderTpl, this.consumptionHeaderTpl, this.actionsTpl);
  }

  onSearch(): void {
    this.filters.onSearch();
  }

  onClearFilters(): void {
    this.filters.onClearFilters();
  }

  onTariffChange(value: any): void {
    this.filters.onTariffChange(value);
  }

  onProductChange(value: any): void {
    this.filters.onProductChange(value);
  }

  onDateRangeChange(range: DateRange): void {
    this.filters.onDateRangeChange(range);
  }

  onRetry(): void {
    this.filters.onRetry();
  }

  onColumnSort(field: SortField): void {
    this.filters.onColumnSort(field);
  }

  onPageChange(page: number): void {
    this.filters.onPageChange(page);
  }

  onPageSizeChange(size: number): void {
    this.filters.onPageSizeChange(size);
  }

  isSortedBy(field: SortField): boolean {
    return this.filters.isSortedBy(field);
  }

  isSortAsc(field: SortField): boolean {
    return this.filters.isSortAsc(field);
  }

  isSortDesc(field: SortField): boolean {
    return this.filters.isSortDesc(field);
  }

  onRowClick(row: StatisticsRow): void {
    this.selectedUserId.set(row.userId);
    this.selectedUserName.set(row.fullName);
    this.detailDialogOpen.set(true);
  }

  onDetailDialogClose(): void {
    this.detailDialogOpen.set(false);
  }

  onExport(): void {
    this.dashboardService.exportToExcel(this.dateRange());
  }
}
