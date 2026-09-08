import { AfterViewInit, ChangeDetectionStrategy, Component, TemplateRef, ViewChild, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, AlertService, ButtonComponent, InputFieldComponent, SelectFieldComponent, SelectOption } from '@apolo-energies/ui';
import { SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { QuixoticContractService } from '../../../../services/quixotic-contract.service';
import { QUIXOTIC_CONTRACT_STATUSES, QuixoticContract, QuixoticContractDocument } from '../../../../entities/quixotic-contract.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { fmtDate } from '../contracts/contracts-utils';
import { DocumentPreviewModalComponent } from './document-preview-modal/document-preview-modal.component';

const STATUS_LABELS: Record<string, string> = {
  new:                 'Nuevo',
  active:              'Activo',
  cancelled:           'Cancelado',
  activation_process:  'Enactivación',
  completed:           'Completado',
};

@Component({
  selector: 'app-gas-quixotic-contracts-page',
  standalone: true,
  imports: [
    DataTableComponent, InputFieldComponent, SelectFieldComponent,
    ButtonComponent, AlertComponent, TableSkeletonComponent, DocumentPreviewModalComponent,
  ],
  templateUrl: './gas-quixotic-contracts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GasQuixoticContractsPageComponent implements AfterViewInit {
  @ViewChild('actionsTpl') private actionsTpl!: TemplateRef<{ $implicit: QuixoticContract }>;

  private readonly contractsService = inject(QuixoticContractService);
  private readonly alertService     = inject(AlertService);
  private readonly globalLoading    = inject(GlobalLoadingService);
  private readonly platformId       = inject(PLATFORM_ID);
  private readonly router           = inject(Router);

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };

  readonly filterCode   = signal('');
  readonly filterStatus = signal('');
  readonly loading      = signal(false);
  readonly error        = signal(false);
  readonly data         = signal<QuixoticContract[]>([]);

  readonly loadingDocumentId  = signal<string | null>(null);
  readonly documentModalOpen  = signal(false);
  readonly documentModalDoc   = signal<QuixoticContractDocument | null>(null);

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todos los estados' },
    ...QUIXOTIC_CONTRACT_STATUSES.map(status => ({ value: status, label: STATUS_LABELS[status] ?? status })),
  ];

  readonly columns = signal<TableColumn<QuixoticContract>[]>([
    { key: 'contractCode', label: 'Código', format: row => row.contractCode || '—' },
    { key: 'contractName', label: 'Nombre' },
    { key: 'contractStatus', label: 'Estado', align: 'center', format: row => STATUS_LABELS[row.contractStatus] ?? row.contractStatus },
    { key: 'contractStartDate', label: 'Fecha inicio', format: row => fmtDate(row.contractStartDate) },
    { key: 'supplyPointId', label: 'Punto de suministro', textColor: 'text-muted-foreground', format: row => row.supplyPointId || '—' },
  ]);

  constructor() {
    if (isPlatformBrowser(this.platformId)) this.load();
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => [...cols, { key: 'actions', label: '', align: 'center', cellTemplate: this.actionsTpl }]);
  }

  onViewDocument(contract: QuixoticContract): void {
    if (this.loadingDocumentId()) return;
    this.loadingDocumentId.set(contract.id);
    this.contractsService.getDocument(contract.id).subscribe({
      next: doc => {
        this.loadingDocumentId.set(null);
        this.documentModalDoc.set(doc);
        this.documentModalOpen.set(true);
        this.triggerDownload(doc);
      },
      error: err => {
        this.loadingDocumentId.set(null);
        this.alertService.show(err?.error?.error ?? 'No se pudo obtener el documento del contrato', 'error');
      },
    });
  }

  /**
   * La URL de S3 viene firmada con Content-Disposition: attachment (lo pone el backend),
   * así que el navegador la descarga apenas la abrimos — no hace falta blob ni fetch propio.
   */
  private triggerDownload(doc: QuixoticContractDocument): void {
    const a = document.createElement('a');
    a.href = doc.publicUrl;
    a.download = doc.fileName;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  onDocumentModalClosed(): void {
    this.documentModalOpen.set(false);
    this.documentModalDoc.set(null);
  }

  onSearch(): void {
    this.load();
  }

  onClear(): void {
    this.filterCode.set('');
    this.filterStatus.set('');
    this.load();
  }

  goToNew(): void {
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new']);
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.globalLoading.start();
    this.contractsService.getContracts({
      contractCode:   this.filterCode()   || undefined,
      contractStatus: this.filterStatus() || undefined,
    }).subscribe({
      next: res => {
        this.data.set(res ?? []);
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: err => {
        this.data.set([]);
        this.error.set(true);
        this.loading.set(false);
        this.globalLoading.stop();
        this.alertService.show(err?.error?.error ?? 'No se pudieron cargar los contratos', 'error');
      },
    });
  }
}
