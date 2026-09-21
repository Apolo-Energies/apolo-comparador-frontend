import { computed, signal, TemplateRef } from '@angular/core';
import { TableColumn } from '@apolo-energies/table';
import { DashboardStatsService } from '../../../../core/services/dashboard-stats.service';
import { StatisticsRow } from '../../../../core/services/statistics.service';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { EsNumberPipe } from '../../../../shared/pipes/es-number.pipe';
import { DailySummaryApiItem, SummaryApiResult, MonthlySummaryApiItem, FiltersData, FilterProduct } from '../../../../core/models/dashboard-api.model';
import { DateRange } from './models/dashboard-ui.model';

export type SortField = 'FullName' | 'Email' | 'TotalCups' | 'TotalAnnualConsumption';
export type SortDirection = 'Asc' | 'Desc';

export interface StatisticsFiltersDeps {
  readonly dashboardService: DashboardStatsService;
  readonly globalLoading:    GlobalLoadingService;
  readonly esNumber:         EsNumberPipe;
}

/**
 * Encapsulates the statistics table state: name/email/tariff/product filters,
 * sorting, pagination, and the consolidated-data load flow, plus the summary
 * data feeding the dashboard chart. Extracted from StatisticsPageComponent to
 * keep the page under the file-size guideline (R1). No Angular DI here: the
 * page owns the instance and injects its services.
 */
export class StatisticsFiltersController {
  constructor(private readonly deps: StatisticsFiltersDeps) {
    this.initializeColumns();
  }

  // filters
  readonly filterName    = signal('');
  readonly filterEmail   = signal('');
  readonly sortBy        = signal<SortField>('FullName');
  readonly sortDirection = signal<SortDirection>('Asc');

  // tariff and product filters
  readonly selectedTariffId  = signal<number | null>(null);
  readonly selectedProductId = signal<number | null>(null);
  readonly availableFilters  = signal<FiltersData | null>(null);

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

  // Computed: productos disponibles basados en la tarifa seleccionada
  readonly availableProducts = computed(() => {
    const selectedTariffId = this.selectedTariffId();
    const filters = this.availableFilters();

    if (selectedTariffId === null || !filters) {
      return [];
    }

    const products: FilterProduct[] = [];

    // Buscar la tarifa seleccionada en todos los providers
    filters.providers.forEach(provider => {
      const tariff = provider.tariffs.find(t => t.id === selectedTariffId);
      if (tariff) {
        products.push(...tariff.products);
      }
    });

    return products;
  });

  // Los datos ya vienen paginados del servidor
  readonly pagedData = computed(() => this.data());

  /** Wires the header-sort/action templates once the view is ready. */
  setHeaderTemplates(
    cupsHeaderTpl: TemplateRef<void>,
    consumptionHeaderTpl: TemplateRef<void>,
    actionsTpl: TemplateRef<{ $implicit: StatisticsRow }>,
  ): void {
    this.columns.update(cols => cols.map(col => {
      if (col.key === 'totalCups') {
        return { ...col, headerIconTemplate: cupsHeaderTpl };
      }
      if (col.key === 'totalAnnualConsumption') {
        return { ...col, headerIconTemplate: consumptionHeaderTpl };
      }
      if (col.key === 'actions') {
        return { ...col, cellTemplate: actionsTpl };
      }
      return col;
    }));
  }

  private initializeColumns(): void {
    this.columns.set([
      { key: 'fullName',               label: 'Nombre' },
      { key: 'email',                  label: 'Email' },
      { key: 'totalCups',              label: 'Total CUPS',              align: 'center' },
      { key: 'totalAnnualConsumption', label: 'Consumo anual (MWh)',     align: 'right',
        format: row => `${this.deps.esNumber.transform(row.totalAnnualConsumption / 1000)} MWh` },
      { key: 'actions',                label: 'Acciones',                align: 'center' },
    ]);
  }

  load(includeOnlyHistory = false): void {
    this.loading.set(true);
    this.deps.globalLoading.start();

    const tariffIds = this.selectedTariffId() !== null ? [this.selectedTariffId()!] : undefined;
    const productIds = this.selectedProductId() !== null ? [this.selectedProductId()!] : undefined;

    this.deps.dashboardService.getConsolidatedData(
      this.dateRange(),
      this.filterName() || undefined,
      this.filterEmail() || undefined,
      this.sortBy(),
      this.sortDirection(),
      this.currentPage(),
      this.pageSize(),
      includeOnlyHistory,
      tariffIds,
      productIds
    ).subscribe({
      next: data => {
        // Actualizar dashboard solo en carga completa (no al filtrar/paginar)
        if (!includeOnlyHistory) {
          if (data.summary)        this.summary.set(data.summary);
          if (data.dailySummary)   this.dailySummary.set(data.dailySummary);
          if (data.monthlySummary) this.monthlySummary.set(data.monthlySummary);
          if (data.filters)        this.availableFilters.set(data.filters);
        }

        // Los datos agregados por usuario vienen directamente en history.items
        const historyItems = data.history?.items ?? [];
        const rows = historyItems.map(item => ({
          userId: item.userId,
          fullName: item.fullName,
          email: item.email,
          totalCups: item.totalCups,
          totalAnnualConsumption: item.totalAnnualConsumption,
        })) as StatisticsRow[];

        this.data.set(rows);
        this.totalCount.set(data.history?.totalCount ?? 0);
        this.totalPages.set(data.history?.totalPages ?? 1);

        this.loading.set(false);
        this.deps.globalLoading.stop();
      },
      error: () => { this.loading.set(false); this.deps.globalLoading.stop(); },
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.load(true); // Solo history al filtrar
  }

  onClearFilters(): void {
    this.filterName.set('');
    this.filterEmail.set('');
    this.sortBy.set('FullName');
    this.sortDirection.set('Asc');
    this.selectedTariffId.set(null);
    this.selectedProductId.set(null);
    this.currentPage.set(1);
    this.load();
  }

  onTariffChange(value: any): void {
    // Convertir a número si no es null
    const numValue = value === 'null' || value === null ? null : Number(value);
    this.selectedTariffId.set(numValue);
    // Resetear el producto seleccionado cuando cambia la tarifa
    this.selectedProductId.set(null);
  }

  onProductChange(value: any): void {
    // Convertir a número si no es null
    const numValue = value === 'null' || value === null ? null : Number(value);
    this.selectedProductId.set(numValue);
  }

  onDateRangeChange(range: DateRange): void {
    this.dateRange.set(range);
    this.currentPage.set(1);
    this.load(); // Datos completos al cambiar fecha
  }

  onRetry(): void {
    this.load();
  }

  onColumnSort(field: SortField): void {
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

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.load(true); // Solo history al cambiar página
  }

  onPageSizeChange(size: number): void {
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
}
