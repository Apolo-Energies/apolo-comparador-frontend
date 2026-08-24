import { ChangeDetectionStrategy, Component, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { DataTableComponent, TableColumn } from '@apolo-energies/table';
import { AlertComponent, AlertService, ButtonComponent, InputFieldComponent, SelectFieldComponent, SelectOption } from '@apolo-energies/ui';
import { SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { QuixoticContractService } from '../../../../services/quixotic-contract.service';
import { QUIXOTIC_CONTRACT_STATUSES, QuixoticContract } from '../../../../entities/quixotic-contract.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { fmtDate } from '../contracts/contracts-utils';

const STATUS_LABELS: Record<string, string> = {
  new:                 'Nuevo',
  active:              'Activo',
  cancelled:           'Cancelado',
  activation_process:  'En activación',
  completed:           'Completado',
};

@Component({
  selector: 'app-gas-quixotic-contracts-page',
  standalone: true,
  imports: [
    DataTableComponent, InputFieldComponent, SelectFieldComponent,
    ButtonComponent, AlertComponent, TableSkeletonComponent,
  ],
  templateUrl: './gas-quixotic-contracts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GasQuixoticContractsPageComponent {
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

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todos los estados' },
    ...QUIXOTIC_CONTRACT_STATUSES.map(status => ({ value: status, label: STATUS_LABELS[status] ?? status })),
  ];

  readonly columns: TableColumn<QuixoticContract>[] = [
    { key: 'contract_code', label: 'Código', format: row => row.contract_code || '—' },
    { key: 'contract_name', label: 'Nombre' },
    { key: 'contract_status', label: 'Estado', align: 'center', format: row => STATUS_LABELS[row.contract_status] ?? row.contract_status },
    { key: 'contract_start_date', label: 'Fecha inicio', format: row => fmtDate(row.contract_start_date) },
    { key: 'supply_point_id', label: 'Punto de suministro', textColor: 'text-muted-foreground', format: row => row.supply_point_id || '—' },
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) this.load();
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
