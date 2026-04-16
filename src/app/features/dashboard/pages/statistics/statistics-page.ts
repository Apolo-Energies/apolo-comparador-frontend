import { ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { DownloadIcon, filterIcon, SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { StatisticsService, StatisticsRow } from '../../../../services/statistics.service';
import { StatisticsDashboardComponent } from './components/statistics-dashboard/statistics-dashboard';
import { LoadingOverlayComponent } from '../../../../shared/components/loading-overlay/loading-overlay.component';

@Component({
  selector: 'app-statistics-page',
  standalone: true,
  imports: [DataTableComponent, PaginatorComponent, InputFieldComponent, ButtonComponent, StatisticsDashboardComponent, LoadingOverlayComponent],
  templateUrl: './statistics-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatisticsPageComponent {
  private statisticsService = inject(StatisticsService);
  private platformId        = inject(PLATFORM_ID);

  // icons
  readonly searchIcon:   UiIconSource = { type: 'apolo', icon: SearchIcon,   size: 16 };
  readonly filterIcon:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 16 };
  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };
  readonly xIcon:        UiIconSource = { type: 'apolo', icon: XIcon,        size: 16 };

  // filters
  readonly filterName  = signal('');
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly totalCount  = signal(0);

  readonly data    = signal<StatisticsRow[]>([]);
  readonly loading = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  private load() {
    this.loading.set(true);
    this.statisticsService.getByFilters({
      name:     this.filterName() || undefined,
      page:     this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe({
      next: res => {
        this.data.set(res.result ?? []);
        this.totalCount.set(res.total ?? res.result?.length ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  onSearch() {
    this.currentPage.set(1);
    this.load();
  }

  onClearFilters() {
    this.filterName.set('');
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

  readonly columns: TableColumn<StatisticsRow>[] = [
    { key: 'fullName',               label: 'Nombre' },
    { key: 'email',                  label: 'Email' },
    { key: 'totalCups',              label: 'Total CUPS',              align: 'center' },
    { key: 'totalAnnualConsumption', label: 'Consumo anual (kWh)',     align: 'right',
      format: row => `${row.totalAnnualConsumption.toFixed(2)} kWh` },
  ];
}
