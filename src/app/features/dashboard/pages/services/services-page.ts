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
import { ServicioListItem } from '../../../../entities/servicio.model';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { estadoCls, estadoLabel, fmtDate, fmtKwh } from '../contracts/contracts-page';

function fmtLocalizacion(s: ServicioListItem): string {
  const parts = [s.PoblacionSuministro, s.ProvinciaSuministro].filter(Boolean);
  return parts.join(', ') || s.DireccionSuministro || '—';
}

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    InputFieldComponent, ButtonComponent,
    TableSkeletonComponent,
  ],
  templateUrl: './services-page.html',
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
export class ServicesPageComponent implements AfterViewInit {
  @ViewChild('clienteTpl')  private clienteTpl!:  TemplateRef<{ $implicit: ServicioListItem }>;
  @ViewChild('cupsTpl')     private cupsTpl!:     TemplateRef<{ $implicit: ServicioListItem }>;
  @ViewChild('tarifaTpl')   private tarifaTpl!:   TemplateRef<{ $implicit: ServicioListItem }>;
  @ViewChild('estadoTpl')   private estadoTpl!:   TemplateRef<{ $implicit: ServicioListItem }>;
  @ViewChild('fechaTpl')    private fechaTpl!:    TemplateRef<{ $implicit: ServicioListItem }>;

  private readonly contractService = inject(ContractService);
  private readonly globalLoading   = inject(GlobalLoadingService);
  private readonly platformId      = inject(PLATFORM_ID);
  private readonly cdr             = inject(ChangeDetectorRef);

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };

  readonly filter      = signal('');
  readonly copiedId    = signal<number | null>(null);
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly loading     = signal(false);
  readonly data        = signal<ServicioListItem[]>([]);
  readonly hasMore     = signal(false);

  readonly totalCount = computed(() =>
    (this.currentPage() - 1) * this.pageSize() + this.data().length
  );
  readonly totalPages = computed(() =>
    this.currentPage() + (this.hasMore() ? 1 : 0)
  );

  readonly columns = signal<TableColumn<ServicioListItem>[]>([
    { key: 'NombreCliente',     label: 'Cliente'    },
    { key: 'CUPS',              label: 'CUPS',       textColor: 'text-muted-foreground' },
    { key: 'Tarifa',            label: 'Tarifa'     },
    { key: 'Estado',            label: 'Estado',     align: 'center' },
    { key: 'NombreComercial',   label: 'Comercial',  textColor: 'text-muted-foreground' },
    { key: 'NombreDelegacion',  label: 'Delegación', textColor: 'text-muted-foreground' },
    { key: 'PoblacionSuministro', label: 'Localización', textColor: 'text-muted-foreground',
      format: row => fmtLocalizacion(row) },
    { key: 'ConsumoAnualContrato', label: 'Consumo', align: 'right',
      format: row => fmtKwh(row.ConsumoAnualContrato) },
    { key: 'FechaEstado',       label: 'Fecha estado' },
  ]);

  readonly estadoCls   = estadoCls;
  readonly estadoLabel = estadoLabel;
  readonly fmtDate     = fmtDate;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => cols.map(col => {
      if (col.key === 'NombreCliente') return { ...col, cellTemplate: this.clienteTpl };
      if (col.key === 'CUPS')         return { ...col, cellTemplate: this.cupsTpl    };
      if (col.key === 'Tarifa')       return { ...col, cellTemplate: this.tarifaTpl  };
      if (col.key === 'Estado')       return { ...col, cellTemplate: this.estadoTpl  };
      if (col.key === 'FechaEstado')  return { ...col, cellTemplate: this.fechaTpl   };
      return col;
    }));
    this.cdr.markForCheck();
  }

  copyCups(s: ServicioListItem): void {
    navigator.clipboard.writeText(s.CUPS).then(() => {
      this.copiedId.set(s.Id);
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
    this.contractService.getServicios({
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
