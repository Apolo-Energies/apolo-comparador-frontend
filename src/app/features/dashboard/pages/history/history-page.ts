import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, computed, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { ApoloIcons, DateIcon, DownloadIcon, EmailIcon, filterIcon, SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { HistoryService, HistoryItem } from '../../../../services/history.service';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [DataTableComponent, PaginatorComponent, InputFieldComponent, ButtonComponent, ApoloIcons],
  templateUrl: './history-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryPageComponent implements AfterViewInit {
  private historyService = inject(HistoryService);
  private platformId     = inject(PLATFORM_ID);
  private cdr            = inject(ChangeDetectorRef);

  // icons
  readonly searchIcon:   UiIconSource = { type: 'apolo', icon: SearchIcon,   size: 16 };
  readonly filterIcon:   UiIconSource = { type: 'apolo', icon: filterIcon,   size: 16 };
  readonly downloadIcon: UiIconSource = { type: 'apolo', icon: DownloadIcon, size: 16 };
  readonly xIcon:        UiIconSource = { type: 'apolo', icon: XIcon,        size: 16 };
  readonly dateIconSrc:  UiIconSource = { type: 'apolo', icon: DateIcon,  size: 20 };
  readonly emailIconSrc: UiIconSource = { type: 'apolo', icon: EmailIcon, size: 20};

  // filters
  readonly filterUser      = signal('');
  readonly filterEmail     = signal('');
  readonly filterStartDate = signal('');
  readonly filterEndDate   = signal('');
  readonly filterCups      = signal('');

  // pagination
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly totalCount  = signal(0);

  readonly data = signal<HistoryItem[]>([]);

  @ViewChild('emailCellTpl') emailCellTpl!: TemplateRef<{ $implicit: HistoryItem }>;
  @ViewChild('dateCellTpl')  dateCellTpl!:  TemplateRef<{ $implicit: HistoryItem }>;

  columns: TableColumn<HistoryItem>[] = [
    { key: 'userName',          label: 'Usuario',   format: row => row.user?.fullName ?? '-' },
    { key: 'userEmail',         label: 'Email',     textColor: 'text-muted-foreground' },
    { key: 'cups',              label: 'CUPS' },
    { key: 'annualConsumption', label: 'Consumo anual (kWh)', align: 'right',
      format: row => `${row.annualConsumption.toFixed(2)} kWh` },
    { key: 'createdAt',         label: 'Fecha', align: 'left' },
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit() {
    const emailCol = this.columns.find(c => c.key === 'userEmail');
    const dateCol  = this.columns.find(c => c.key === 'createdAt');
    if (emailCol) emailCol.cellTemplate = this.emailCellTpl;
    if (dateCol)  dateCol.cellTemplate  = this.dateCellTpl;
    this.cdr.markForCheck();
  }

  formatDate(iso: string): string {
    return new Date(iso)
      .toLocaleString()
  }

  private load() {
    const start = this.filterStartDate() || undefined;
    const end   = this.filterEndDate()   || undefined;
    this.historyService.getByFilters({
      fullName:  this.filterUser()  || undefined,
      email:     this.filterEmail() || undefined,
      startDate: start ?? end,
      endDate:   end   ?? start,
      cups:      this.filterCups()  || undefined,
      page:      this.currentPage(),
      pageSize:  this.pageSize(),
    }).subscribe(res => {
      this.data.set(res.items);
      this.totalCount.set(res.totalCount);
    });
  }

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  onSearch() {
    this.currentPage.set(1);
    this.load();
  }

  onClearFilters() {
    this.filterUser.set('');
    this.filterEmail.set('');
    this.filterStartDate.set('');
    this.filterEndDate.set('');
    this.filterCups.set('');
    this.currentPage.set(1);
    this.load();
  }

  onExport(): void {
    this.historyService.downloadExcel().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `history-report.xlsx`;
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
}
