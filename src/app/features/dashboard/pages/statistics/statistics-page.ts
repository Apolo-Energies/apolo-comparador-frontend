import { ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { DownloadIcon, filterIcon, SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { StatisticsService, StatisticsRow } from '../../../../services/statistics.service';

@Component({
  selector: 'app-statistics-page',
  standalone: true,
  imports: [DataTableComponent, PaginatorComponent, InputFieldComponent, ButtonComponent],
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

  readonly data = signal<StatisticsRow[]>([]);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  private load() {
    this.statisticsService.getByFilters({
      name:     this.filterName() || undefined,
      page:     this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe(res => {
      this.data.set(res.result ?? []);
      this.totalCount.set(res.total ?? res.result?.length ?? 0);
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
    { key: 'nombre',        label: 'Nombre' },
    { key: 'comparaciones', label: 'Comparaciones', align: 'center' },
    { key: 'ahorro',        label: 'Ahorro total (€)', align: 'right',
      format: row => `${row.ahorro.toFixed(2)} €` },
    { key: 'fecha',         label: 'Última actividad', align: 'center' },
  ];
}
