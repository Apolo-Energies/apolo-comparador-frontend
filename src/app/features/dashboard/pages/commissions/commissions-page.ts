import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, computed, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, ButtonComponent } from '@apolo-energies/ui';
import { ApoloIcons, NoteIcon, StarIcon, UiIconSource } from '@apolo-energies/icons';
import { CommissionService, CommissionRow } from '../../../../services/commission.service';
import { AddCommissionModalComponent } from './add-commission-modal/add-commission-modal';

@Component({
  selector: 'app-commissions-page',
  standalone: true,
  imports: [DataTableComponent, PaginatorComponent, ButtonComponent, AlertComponent, AddCommissionModalComponent, ApoloIcons],
  templateUrl: './commissions-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommissionsPageComponent implements AfterViewInit {
  private commissionService = inject(CommissionService);
  private platformId        = inject(PLATFORM_ID);
  private cdr               = inject(ChangeDetectorRef);

  readonly modalOpen   = signal(false);
  readonly editData    = signal<CommissionRow | null>(null);
  readonly data        = signal<CommissionRow[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize    = signal(20);
  readonly totalCount  = signal(0);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  readonly starIcon: UiIconSource = { type: 'apolo', icon: StarIcon, size: 16 };
  readonly editIcon: UiIconSource = { type: 'apolo', icon: NoteIcon, size: 15 };

  @ViewChild('actionsTpl') actionsTpl!: TemplateRef<{ $implicit: CommissionRow }>;

  columns: TableColumn<CommissionRow>[] = [
    { key: 'name',       label: 'Nombre' },
    { key: 'percentage', label: 'Porcentaje (%)', align: 'center',
      format: row => `${row.percentage.toFixed(2)}%` },
    { key: 'actions',    label: 'Acciones', align: 'center' },
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit() {
    const actionsCol = this.columns.find(c => c.key === 'actions');
    if (actionsCol) actionsCol.cellTemplate = this.actionsTpl;
    this.cdr.markForCheck();
  }

  private load() {
    this.commissionService.getAll({ page: this.currentPage(), pageSize: this.pageSize() })
      .subscribe(res => {
        this.data.set(res.items);
        this.totalCount.set(res.totalCount);
      });
  }

  onEdit(row: CommissionRow) {
    this.editData.set(row);
    this.modalOpen.set(true);
  }

  onSaved() {
    this.modalOpen.set(false);
    this.editData.set(null);
    this.load();
  }

  onCancelled() {
    this.modalOpen.set(false);
    this.editData.set(null);
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