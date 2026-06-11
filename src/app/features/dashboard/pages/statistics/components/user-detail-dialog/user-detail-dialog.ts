import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DialogComponent, ButtonComponent } from '@apolo-energies/ui';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { DashboardStatsService } from '../../../../../../services/dashboard-stats.service';
import { ComparisonDetailItem, PaginatedComparisonDetail } from '../../models/dashboard-api.models';
import { DateRange } from '../../models/dashboard-ui.models';
import { LoadingOverlayComponent } from '../../../../../../shared/components/loading-overlay/loading-overlay.component';
import { EsNumberPipe } from '../../../../../../shared/pipes/es-number.pipe';

@Component({
  selector: 'app-user-detail-dialog',
  standalone: true,
  imports: [DialogComponent, DataTableComponent, PaginatorComponent, ButtonComponent, LoadingOverlayComponent],
  templateUrl: './user-detail-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDetailDialogComponent {
  readonly open      = input<boolean>(false);
  readonly userId    = input<string>('');
  readonly userName  = input<string>('');
  readonly dateRange = input<DateRange>({ from: null, to: null });

  readonly closed = output<void>();

  private dashboardService = inject(DashboardStatsService);
  private esNumber         = new EsNumberPipe();

  readonly loading          = signal(false);
  readonly data             = signal<ComparisonDetailItem[]>([]);
  readonly currentPage      = signal(1);
  readonly pageSize         = signal(10);
  readonly totalCount       = signal(0);
  readonly totalPages       = signal(1);

  readonly columns = signal<TableColumn<ComparisonDetailItem>[]>([
    { key: 'cups',              label: 'CUPS',                align: 'left' },
    { key: 'annualConsumption', label: 'Consumo anual (MWh)', align: 'right',
      format: row => `${this.esNumber.transform(row.annualConsumption / 1000)} MWh` },
    { key: 'createdAt',         label: 'Fecha',               align: 'center',
      format: row => new Date(row.createdAt).toLocaleDateString('es-ES') },
  ]);

  constructor() {
    effect(() => {
      if (this.open() && this.userId()) {
        this.load();
      }
    });
  }

  private buildRange(): DateRange {
    return this.dateRange();
  }

  private load() {
    this.loading.set(true);
    this.dashboardService.getComparisonDetailByUserId(
      this.userId(),
      this.buildRange(),
      this.currentPage(),
      this.pageSize()
    ).subscribe({
      next: (result: PaginatedComparisonDetail) => {
        this.data.set(result.items);
        this.totalCount.set(result.totalCount);
        this.totalPages.set(result.totalPages);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
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

  onClose() {
    this.currentPage.set(1);
    this.data.set([]);
    this.closed.emit();
  }
}
