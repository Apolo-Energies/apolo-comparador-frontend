import { AfterViewInit, ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID, TemplateRef, ViewChild } from '@angular/core';
import { isPlatformBrowser, NgIf } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { DownloadIcon, filterIcon, SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { DashboardStatsService } from '../../../../services/dashboard-stats.service';
import { StatisticsRow } from '../../../../services/statistics.service';
import { StatisticsDashboardComponent } from './components/statistics-dashboard/statistics-dashboard';
import { UserDetailDialogComponent } from './components/user-detail-dialog/user-detail-dialog';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';
import { DailySummaryApiItem, SummaryApiResult, MonthlySummaryApiItem/*, FiltersData, FilterProduct*/ } from './models/dashboard-api.models';
import { DateRange } from './models/dashboard-ui.models';

type SortField = 'FullName' | 'Email' | 'TotalCups' | 'TotalAnnualConsumption';
type SortDirection = 'Asc' | 'Desc';

@Component({
  selector: 'app-statistics-page',
  standalone: true,
  imports: [DataTableComponent, PaginatorComponent, InputFieldComponent, ButtonComponent, StatisticsDashboardComponent, UserDetailDialogComponent, LoadingOverlayComponent, NgIf],
  templateUrl: './statistics-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsPageComponent implements AfterViewInit {
  @ViewChild('cupsHeaderTpl') private cupsHeaderTpl!: TemplateRef<void>;
  @ViewChild('consumptionHeaderTpl') private consumptionHeaderTpl!: TemplateRef<void>;
  @ViewChild('actionsTpl') private actionsTpl!: TemplateRef<{ $implicit: StatisticsRow }>;
  private dashboardService = inject(DashboardStatsService);
  private platformId       = inject(PLATFORM_ID);

  // icons
  readonly searchIcon:   UiIconSource = { type: 'apolo', icon: SearchIcon,   size: 16 };
  readonly filterIcon:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 16 };
  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };
  readonly xIcon:        UiIconSource = { type: 'apolo', icon: XIcon,        size: 16 };

  // filters
  readonly filterName      = signal('');
  readonly filterEmail     = signal('');
  readonly sortBy          = signal<SortField>('FullName');
  readonly sortDirection   = signal<SortDirection>('Asc');

  // TODO: Descomentar cuando se tenga la relación de tarifas y productos en BD
  // tariff and product filters
  // readonly selectedTariffId  = signal<number | null>(null);
  // readonly selectedProductId = signal<number | null>(null);
  // readonly availableFilters  = signal<FiltersData | null>(null);

  readonly data        = signal<StatisticsRow[]>([]);
  readonly loading     = signal(false);
  readonly columns     = signal<TableColumn<StatisticsRow>[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly totalCount  = signal(0);
  readonly totalPages  = signal(1);

  readonly dateRange      = signal<DateRange>({ from: null, to: null });
  readonly summary        = signal<SummaryApiResult | null>(null);
  readonly dailySummary   = signal<DailySummaryApiItem[]>([]);
  readonly monthlySummary = signal<MonthlySummaryApiItem[]>([]);

  // Modal de detalle
  readonly detailDialogOpen = signal(false);
  readonly selectedUserId   = signal('');
  readonly selectedUserName = signal('');

  // TODO: Descomentar cuando se tenga la relación de tarifas y productos en BD
  // Computed: productos disponibles basados en la tarifa seleccionada
  // readonly availableProducts = computed(() => {
  //   const selectedTariffId = this.selectedTariffId();
  //   const filters = this.availableFilters();
  //   
  //   if (selectedTariffId === null || !filters) {
  //     return [];
  //   }
  //   
  //   const products: FilterProduct[] = [];
  //   
  //   // Buscar la tarifa seleccionada en todos los providers
  //   filters.providers.forEach(provider => {
  //     const tariff = provider.tariffs.find(t => t.id === selectedTariffId);
  //     if (tariff) {
  //       products.push(...tariff.products);
  //     }
  //   });
  //   
  //   return products;
  // });

  // Los datos ya vienen paginados del servidor
  readonly pagedData = computed(() => this.data());

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.initializeColumns();
      this.load();
    }
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => cols.map(col => {
      if (col.key === 'totalCups') {
        return { ...col, headerIconTemplate: this.cupsHeaderTpl };
      }
      if (col.key === 'totalAnnualConsumption') {
        return { ...col, headerIconTemplate: this.consumptionHeaderTpl };
      }
      if (col.key === 'actions') {
        return { ...col, cellTemplate: this.actionsTpl };
      }
      return col;
    }));
  }

  private initializeColumns() {
    this.columns.set([
      { key: 'fullName',               label: 'Nombre' },
      { key: 'email',                  label: 'Email' },
      { key: 'totalCups',              label: 'Total CUPS',              align: 'center' },
      { key: 'totalAnnualConsumption', label: 'Consumo anual (kWh)',     align: 'right',
        format: row => `${row.totalAnnualConsumption.toFixed(2)} kWh` },
      { key: 'actions',                label: 'Acciones',                align: 'center' },
    ]);
  }

  private load(includeOnlyHistory = false) {
    this.loading.set(true);
    
    // TODO: Descomentar cuando se tenga la relación de tarifas y productos en BD
    // const tariffIds = this.selectedTariffId() !== null ? [this.selectedTariffId()!] : undefined;
    // const productIds = this.selectedProductId() !== null ? [this.selectedProductId()!] : undefined;
    
    this.dashboardService.getConsolidatedData(
      this.dateRange(),
      this.filterName() || undefined,
      this.filterEmail() || undefined,
      this.sortBy(),
      this.sortDirection(),
      this.currentPage(),
      this.pageSize(),
      includeOnlyHistory,
      undefined, // tariffIds
      undefined  // productIds
    ).subscribe({
      next: data => {
        // Solo actualizar dashboard si vienen los datos
        if (data.summary) {
          this.summary.set(data.summary);
        }
        if (data.dailySummary) {
          this.dailySummary.set(data.dailySummary);
        }
        if (data.monthlySummary) {
          this.monthlySummary.set(data.monthlySummary);
        }
        
        // TODO: Descomentar cuando se tenga la relación de tarifas y productos en BD
        // Actualizar filtros disponibles
        // if (data.filters) {
        //   this.availableFilters.set(data.filters);
        // }
        
        // Siempre actualizar history
        if (data.history) {
          this.data.set(data.history.items as StatisticsRow[]);
          this.totalCount.set(data.history.totalCount);
          this.totalPages.set(data.history.totalPages);
        } else {
          this.data.set([]);
          this.totalCount.set(0);
          this.totalPages.set(1);
        }
        
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    this.currentPage.set(1);
    this.load(true); // Solo history al filtrar
  }

  onClearFilters() {
    this.filterName.set('');
    this.filterEmail.set('');
    this.sortBy.set('FullName');
    this.sortDirection.set('Asc');
    // TODO: Descomentar cuando se tenga la relación de tarifas y productos en BD
    // this.selectedTariffId.set(null);
    // this.selectedProductId.set(null);
    this.currentPage.set(1);
    this.load();
  }

  // TODO: Descomentar cuando se tenga la relación de tarifas y productos en BD
  // onTariffChange(value: any): void {
  //   // Convertir a número si no es null
  //   const numValue = value === 'null' || value === null ? null : Number(value);
  //   this.selectedTariffId.set(numValue);
  //   // Resetear el producto seleccionado cuando cambia la tarifa
  //   this.selectedProductId.set(null);
  // }

  // onProductChange(value: any): void {
  //   // Convertir a número si no es null
  //   const numValue = value === 'null' || value === null ? null : Number(value);
  //   this.selectedProductId.set(numValue);
  // }

  onDateRangeChange(range: DateRange) {
    this.dateRange.set(range);
    this.currentPage.set(1);
    this.load(); // Datos completos al cambiar fecha
  }

  onRetry() {
    this.load();
  }

  onColumnSort(field: SortField) {
    if (this.sortBy() === field) {
      // Toggle direction si es la misma columna
      this.sortDirection.set(this.sortDirection() === 'Asc' ? 'Desc' : 'Asc');
    } else {
      // Nueva columna, empezar en descendente
      this.sortBy.set(field);
      this.sortDirection.set('Desc');
    }
    this.currentPage.set(1);
    this.load(true); // Solo history al ordenar
  }

  onPageChange(page: number) {
    this.currentPage.set(page);
    this.load(true); // Solo history al cambiar página
  }

  onPageSizeChange(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load(true); // Solo history al cambiar tamaño
  }

  isSortedBy(field: SortField): boolean {
    return this.sortBy() === field;
  }

  isSortAsc(field: SortField): boolean {
    return this.isSortedBy(field) && this.sortDirection() === 'Asc';
  }

  isSortDesc(field: SortField): boolean {
    return this.isSortedBy(field) && this.sortDirection() === 'Desc';
  }

  onRowClick(row: StatisticsRow) {
    this.selectedUserId.set(row.userId);
    this.selectedUserName.set(row.fullName);
    this.detailDialogOpen.set(true);
  }

  onDetailDialogClose() {
    this.detailDialogOpen.set(false);
  }
}
