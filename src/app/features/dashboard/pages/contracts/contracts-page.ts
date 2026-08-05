import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { SearchIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { ContractService } from '../../../../services/contract.service';
import { ContratoClienteRow } from '../../../../entities/contrato.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ContractDetailDrawerComponent } from './components/contract-detail-drawer/contract-detail-drawer';
import { calcDias, estadoCls, estadoLabel, fmtDate, fmtKwh } from './contracts-utils';

@Component({
  selector: 'app-contracts-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    InputFieldComponent, ButtonComponent,
    TableSkeletonComponent,
    ContractDetailDrawerComponent,
  ],
  templateUrl: './contracts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host ::ng-deep lib-data-table th:first-child,
    :host ::ng-deep lib-data-table td:first-child {
      position: sticky;
      left: 0;
      z-index: 2;
      box-shadow: 4px 0 8px -4px rgba(0, 0, 0, 0.4);
    }
    :host ::ng-deep lib-data-table th:first-child {
      background: var(--color-card);
    }
    :host ::ng-deep lib-data-table td:first-child {
      background: var(--color-card);
    }
    :host ::ng-deep lib-data-table tr:hover td:first-child {
      background: var(--color-body);
    }
  `],
})
export class ContractsPageComponent implements AfterViewInit {
  @ViewChild('clienteTpl')      private clienteTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('serviciosTpl')    private serviciosTpl!:    TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('consumoTpl')      private consumoTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('estadoTpl')       private estadoTpl!:       TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('vencimientoTpl')  private vencimientoTpl!:  TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('movimientoTpl')   private movimientoTpl!:   TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('detalleTpl')      private detalleTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;

  private readonly contractService = inject(ContractService);
  private readonly globalLoading   = inject(GlobalLoadingService);
  private readonly platformId      = inject(PLATFORM_ID);
  private readonly cdr             = inject(ChangeDetectorRef);

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };

  readonly filter      = signal('');
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly loading     = signal(false);
  readonly data        = signal<ContratoClienteRow[]>([]);
  readonly hasMore     = signal(false);
  readonly selectedClient = signal<ContratoClienteRow | null>(null);

  readonly totalPages = computed(() =>
    this.hasMore() ? this.currentPage() + 1 : this.currentPage()
  );
  readonly totalCount = computed(() =>
    this.hasMore()
      ? this.currentPage() * this.pageSize() + 1
      : (this.currentPage() - 1) * this.pageSize() + this.data().length
  );

  readonly columns = signal<TableColumn<ContratoClienteRow>[]>([
    { key: 'NombreCliente',      label: 'Cliente' },
    { key: 'NumServicios',       label: 'Servicios',   align: 'center' },
    { key: 'ConsumoTotal',       label: 'Consumo',     align: 'right' },
    { key: 'EstadoResumen',      label: 'Estado',      align: 'center' },
    { key: 'ProximoVencimiento', label: 'Próx. venc.', align: 'center' },
    { key: 'UltimoMovimiento',   label: 'Último mov.', align: 'center' },
    { key: '__detalle',          label: 'Detalle',     align: 'center' },
  ]);

  readonly estadoCls   = estadoCls;
  readonly estadoLabel = estadoLabel;
  readonly fmtDate     = fmtDate;
  readonly calcDias    = calcDias;
  readonly fmtKwh      = fmtKwh;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => cols.map(col => {
      if (col.key === 'NombreCliente')      return { ...col, cellTemplate: this.clienteTpl     };
      if (col.key === 'NumServicios')       return { ...col, cellTemplate: this.serviciosTpl   };
      if (col.key === 'ConsumoTotal')       return { ...col, cellTemplate: this.consumoTpl     };
      if (col.key === 'EstadoResumen')      return { ...col, cellTemplate: this.estadoTpl      };
      if (col.key === 'ProximoVencimiento') return { ...col, cellTemplate: this.vencimientoTpl };
      if (col.key === 'UltimoMovimiento')   return { ...col, cellTemplate: this.movimientoTpl  };
      if (col.key === '__detalle')          return { ...col, cellTemplate: this.detalleTpl     };
      return col;
    }));
    this.cdr.markForCheck();
  }

  openDetail(c: ContratoClienteRow): void {
    this.selectedClient.set(c);
  }

  closeDetail(): void {
    this.selectedClient.set(null);
  }

  /** Devuelve true si TODOS los servicios del cliente comparten un mismo estado. */
  singleEstado(row: ContratoClienteRow): string | null {
    const keys = Object.keys(row.EstadoBreakdown ?? {});
    return keys.length === 1 ? keys[0] : null;
  }

  estadoEntries(row: ContratoClienteRow): { estado: string; count: number }[] {
    const bd = row.EstadoBreakdown ?? {};
    return Object.entries(bd)
      .map(([estado, count]) => ({ estado, count }))
      .sort((a, b) => b.count - a.count);
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.load();
  }

  onClear(): void {
    this.filter.set('');
    this.currentPage.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.globalLoading.start();
    this.contractService.getContratos({
      filter: this.filter() || undefined,
      offset: (this.currentPage() - 1) * this.pageSize(),
      limit:  this.pageSize(),
    }).subscribe({
      next: res => {
        this.data.set(res?.data ?? []);
        this.hasMore.set(res?.hasMore ?? false);
        this.loading.set(false);
        this.globalLoading.stop();
      },
      error: () => {
        this.loading.set(false);
        this.globalLoading.stop();
      },
    });
  }
}
