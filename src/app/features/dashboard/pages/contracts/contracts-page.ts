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
import { ContratoListItem } from '../../../../entities/contrato.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';

const ESTADO_MAP: Record<string, { label: string; cls: string }> = {
  F: { label: 'Firmado',   cls: 'bg-[#1AD5981A] text-[#1AD598]'   },
  A: { label: 'Alta',      cls: 'bg-blue-500/10 text-blue-400'     },
  P: { label: 'Pendiente', cls: 'bg-yellow-500/10 text-yellow-400' },
  B: { label: 'Baja',      cls: 'bg-[#ef444440] text-[#ef4444]'   },
  R: { label: 'Renovado',  cls: 'bg-violet-500/10 text-violet-400' },
  C: { label: 'Cancelado', cls: 'bg-[#ef444440] text-[#ef4444]'   },
};

export function estadoCls(code: string): string {
  return ESTADO_MAP[code?.toUpperCase()]?.cls ?? 'bg-accent/40 text-muted-foreground';
}

export function estadoLabel(code: string): string {
  return ESTADO_MAP[code?.toUpperCase()]?.label ?? (code || '—');
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function calcDias(fechaFin?: string | null): number | null {
  if (!fechaFin) return null;
  return Math.ceil((new Date(fechaFin).getTime() - Date.now()) / 86_400_000);
}

export function fmtKwh(kwh: number): string {
  if (!kwh) return '—';
  if (kwh >= 1_000_000) return `${(kwh / 1_000_000).toFixed(2)} GWh`;
  if (kwh >= 1_000)     return `${(kwh / 1_000).toFixed(2)} MWh`;
  return `${kwh.toFixed(0)} kWh`;
}

@Component({
  selector: 'app-contracts-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    InputFieldComponent, ButtonComponent,
    TableSkeletonComponent,
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
  @ViewChild('clienteTpl')  private clienteTpl!:  TemplateRef<{ $implicit: ContratoListItem }>;
  @ViewChild('cupsTpl')     private cupsTpl!:     TemplateRef<{ $implicit: ContratoListItem }>;
  @ViewChild('estadoTpl')   private estadoTpl!:   TemplateRef<{ $implicit: ContratoListItem }>;
  @ViewChild('fechaFinTpl') private fechaFinTpl!: TemplateRef<{ $implicit: ContratoListItem }>;

  private readonly contractService = inject(ContractService);
  private readonly globalLoading   = inject(GlobalLoadingService);
  private readonly platformId      = inject(PLATFORM_ID);
  private readonly cdr             = inject(ChangeDetectorRef);

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };

  readonly filter   = signal('');
  readonly copiedId = signal<number | null>(null);
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly loading     = signal(false);
  readonly data        = signal<ContratoListItem[]>([]);
  readonly hasMore     = signal(false);

  // Without a real totalCount from the API we derive a best-effort value so
  // the paginator can still render prev/next correctly.
  readonly totalCount = computed(() =>
    (this.currentPage() - 1) * this.pageSize() + this.data().length
  );
  readonly totalPages = computed(() =>
    this.currentPage() + (this.hasMore() ? 1 : 0)
  );

  readonly columns = signal<TableColumn<ContratoListItem>[]>([
    { key: 'NombreCliente',       label: 'Cliente'    },
    { key: 'CUPS',                label: 'CUPS',        textColor: 'text-muted-foreground' },
    { key: 'Tarifa',              label: 'Tarifa',      align: 'center' },
    { key: 'EstadoContrato',      label: 'Estado',      align: 'center' },
    { key: 'DireccionSuministro', label: 'Dirección',   textColor: 'text-muted-foreground' },
    { key: 'ConsumoTotalNoEse',   label: 'Consumo',     align: 'right',
      format: row => fmtKwh(row.ConsumoTotalNoEse) },
    { key: 'FechaInicio',         label: 'Inicio',
      format: row => fmtDate(row.FechaInicio) },
    { key: 'FechaFin',            label: 'Fin · Días' },
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
      if (col.key === 'NombreCliente')  return { ...col, cellTemplate: this.clienteTpl  };
      if (col.key === 'CUPS')           return { ...col, cellTemplate: this.cupsTpl     };
      if (col.key === 'EstadoContrato') return { ...col, cellTemplate: this.estadoTpl   };
      if (col.key === 'FechaFin')       return { ...col, cellTemplate: this.fechaFinTpl };
      return col;
    }));
    this.cdr.markForCheck();
  }

  copyCups(c: ContratoListItem): void {
    navigator.clipboard.writeText(c.CUPS).then(() => {
      this.copiedId.set(c.Id);
      setTimeout(() => this.copiedId.set(null), 2000);
    });
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
        this.data.set(res ?? []);
        this.hasMore.set((res?.length ?? 0) >= this.pageSize());
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
