import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import {
  ArrowUpDownIcon, DateIcon, InfoIcon, ListIcon,
  SearchIcon, ShieldCheckIcon, SvgIcon, TradingDownIcon, UiIconSource, XIcon,
} from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { ContractService } from '../../../../core/services/contract.service';
import { ContratoClienteRow } from '../../../../core/models/contrato.model';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { CollaboratorScopeService } from '../../../../core/services/collaborator-scope.service';
import { RefreshTokenService } from '../../../../core/services/refresh-token.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ContractDetailDrawerComponent } from './components/contract-detail-drawer/contract-detail-drawer';
import { TramitacionPanelComponent } from './components/tramitacion-panel/tramitacion-panel';
import { TramitacionItem, TramitacionService } from '../../../../core/services/tramitacion.service';
import {
  applyContratosColumnTemplates, estadoCategory, estadoCls, estadoEntries, estadoLabel, fmtDate, fmtKwh, singleEstado,
} from './contracts-utils';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { ContractsListController } from './contracts-list.controller';

@Component({
  selector: 'app-contracts-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    InputFieldComponent, ButtonComponent,
    TableSkeletonComponent,
    ContractDetailDrawerComponent,
    TramitacionPanelComponent,
    SvgIcon,
  ],
  templateUrl: './contracts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './contracts-page.scss',
})
export class ContractsPageComponent implements AfterViewInit {
  @ViewChild('clienteTpl')        private clienteTpl!:        TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('nifTpl')            private nifTpl!:            TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('cupsTpl')           private cupsTpl!:           TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('colaboradorTpl')    private colaboradorTpl!:    TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('estadoTpl')         private estadoTpl!:         TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('tarifaTpl')         private tarifaTpl!:         TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('fechaCreacionTpl')  private fechaCreacionTpl!:  TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('fechaFinTpl')       private fechaFinTpl!:       TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('consumoTpl')        private consumoTpl!:        TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('detalleTpl')        private detalleTpl!:        TemplateRef<{ $implicit: ContratoClienteRow }>;

  private readonly contractService   = inject(ContractService);
  private readonly globalLoading     = inject(GlobalLoadingService);
  private readonly collaboratorScope = inject(CollaboratorScopeService);
  private readonly platformId        = inject(PLATFORM_ID);
  private readonly cdr               = inject(ChangeDetectorRef);
  private readonly auth              = inject(AuthService);
  private readonly refreshToken      = inject(RefreshTokenService);
  private readonly tramitacion       = inject(TramitacionService);
  private isFirstLoad                = true;

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };

  readonly pillAllIcon        = ListIcon;
  readonly pillActivosIcon    = ShieldCheckIcon;
  readonly pillPendientesIcon = DateIcon;
  readonly pillRenovadosIcon  = ArrowUpDownIcon;
  readonly pillBajasIcon      = XIcon;
  readonly pillPorCaducarIcon = InfoIcon;
  readonly pillCaducadosIcon  = TradingDownIcon;

  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));
  readonly delegationId = signal<number | null>(null);
  readonly hasDelegation = computed(() => this.isMaster() || this.delegationId() !== null);

  readonly selectedClient = signal<ContratoClienteRow | null>(null);

  // Pestañas: listado de contratos o lo que falta en los contratos en tramitación.
  readonly tab = signal<'contratos' | 'tramitacion'>('contratos');
  readonly tramitacionItems   = signal<TramitacionItem[]>([]);
  readonly tramitacionLoading = signal(false);

  readonly filterMode = signal<
    'todos' | 'activos' | 'pendientes' | 'renovados' | 'bajas' | 'porCaducar' | 'caducados'
  >('todos');

  readonly setFilterMode = (m: ReturnType<typeof this.filterMode>): void => {
    this.filterMode.set(m);
    this.currentPage.set(1);
  };

  readonly viewMode = this.filterMode;

  readonly fechaDesde = signal<string>('');
  readonly fechaHasta = signal<string>('');
  readonly setFechaDesde = (v: string): void => { this.fechaDesde.set(v); this.currentPage.set(1); };
  readonly setFechaHasta = (v: string): void => { this.fechaHasta.set(v); this.currentPage.set(1); };
  readonly hasDateFilter = computed(() => !!this.fechaDesde() || !!this.fechaHasta());
  readonly clearDateFilter = (): void => {
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.currentPage.set(1);
  };

  private matchesEstadoFilter(row: ContratoClienteRow, mode: string): boolean {
    const bd = row.EstadoBreakdown ?? {};
    for (const [estado, count] of Object.entries(bd)) {
      if ((count ?? 0) <= 0) continue;
      if (estadoCategory(estado) === mode) return true;
    }
    return false;
  }

  private matchesDateRange(row: ContratoClienteRow): boolean {
    if (!this.hasDateFilter()) return true;
    const iso = row.UltimoMovimiento;
    if (!iso) return false;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return false;
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    if (desde && t < new Date(desde).getTime()) return false;
    if (hasta && t > new Date(hasta).getTime() + 86_400_000 - 1) return false;
    return true;
  }

  private matchesVencimiento(row: ContratoClienteRow, mode: 'porCaducar' | 'caducados'): boolean {
    if (!row.ProximoVencimiento) return false;
    const end = new Date(row.ProximoVencimiento).getTime();
    if (Number.isNaN(end)) return false;
    const today = new Date().setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    return mode === 'caducados' ? diffDays < 0 : (diffDays >= 0 && diffDays <= 60);
  }

  readonly visibleData = computed<ContratoClienteRow[]>(() => {
    const mode = this.filterMode();
    return this.data().filter(row => {
      if (!this.matchesDateRange(row)) return false;
      if (mode === 'todos') return true;
      if (mode === 'porCaducar' || mode === 'caducados') {
        return this.matchesVencimiento(row, mode);
      }
      return this.matchesEstadoFilter(row, mode);
    });
  });

  readonly countActivos     = computed(() => this.data().filter(r => this.matchesEstadoFilter(r, 'activos')).length);
  readonly countPendientes  = computed(() => this.data().filter(r => this.matchesEstadoFilter(r, 'pendientes')).length);
  readonly countRenovados   = computed(() => this.data().filter(r => this.matchesEstadoFilter(r, 'renovados')).length);
  readonly countBajas       = computed(() => this.data().filter(r => this.matchesEstadoFilter(r, 'bajas')).length);
  readonly countPorCaducar  = computed(() => this.data().filter(r => this.matchesVencimiento(r, 'porCaducar')).length);
  readonly countCaducados   = computed(() => this.data().filter(r => this.matchesVencimiento(r, 'caducados')).length);

  private readonly list = new ContractsListController({
    contractService:   this.contractService,
    globalLoading:      this.globalLoading,
    collaboratorScope:  this.collaboratorScope,
    onLoaded:           () => {},
  });

  readonly filter         = this.list.filter;
  readonly currentPage    = this.list.currentPage;
  readonly pageSize       = this.list.pageSize;
  readonly loading        = this.list.loading;
  readonly data           = this.list.data;
  readonly hasMore        = this.list.hasMore;
  readonly filterEstado   = this.list.filterEstado;
  readonly filterFaltante = this.list.filterFaltante;
  readonly totalPages     = this.list.totalPages;
  readonly totalCount     = this.list.totalCount;

  get hasFilters(): boolean { return this.list.hasFilters; }

  onEstadoChange(v: string):      void { this.list.onEstadoChange(v); }
  onFaltanteChange(v: string):    void { this.list.onFaltanteChange(v); }
  clearFilters():                 void { this.list.clearFilters(); }
  onSearch():                     void { this.list.onSearch(); }
  onClear():                      void { this.list.onClear(); }
  onPageChange(page: number):     void { this.list.onPageChange(page); }
  onPageSizeChange(size: number): void { this.list.onPageSizeChange(size); }
  load():                         void { this.list.load(); }

  readonly columns = signal<TableColumn<ContratoClienteRow>[]>([
    { key: 'NombreCliente',          label: 'Cliente' },
    { key: 'NIF',                    label: 'NIF/CIF' },
    { key: 'CUPS',                   label: 'CUPS',              align: 'center' },
    { key: 'NombreComercialCliente', label: 'Colaborador' },
    { key: 'EstadoResumen',          label: 'Estado',            align: 'center' },
    { key: 'Tarifa',                 label: 'Tarifa' },
    { key: 'FechaCreacion',          label: 'Fecha de creación', align: 'center' },
    { key: 'FechaFin',               label: 'Fecha de fin',      align: 'center' },
    { key: 'ConsumoTotal',           label: 'Consumo',           align: 'right' },
    { key: '__detalle',              label: 'Detalle',           align: 'center' },
  ]);

  readonly estadoCls      = estadoCls;
  readonly estadoLabel    = estadoLabel;
  readonly fmtDate        = fmtDate;
  readonly fmtKwh         = fmtKwh;
  readonly singleEstado   = singleEstado;
  readonly estadoEntries  = estadoEntries;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.delegationId.set(this.refreshToken.getDelegationIdFromToken());
      if (this.hasDelegation()) {
        this.load();
        this.loadTramitacion();
      }
    }
    effect(() => {
      this.collaboratorScope.selected();
      if (this.isFirstLoad) { this.isFirstLoad = false; return; }
      if (!this.hasDelegation()) return;
      this.list.currentPage.set(1);
      this.load();
    });
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => applyContratosColumnTemplates(cols, {
      NombreCliente:          this.clienteTpl,
      NIF:                    this.nifTpl,
      CUPS:                   this.cupsTpl,
      NombreComercialCliente: this.colaboradorTpl,
      EstadoResumen:          this.estadoTpl,
      Tarifa:                 this.tarifaTpl,
      FechaCreacion:          this.fechaCreacionTpl,
      FechaFin:               this.fechaFinTpl,
      ConsumoTotal:           this.consumoTpl,
      __detalle:              this.detalleTpl,
    }));
    this.cdr.markForCheck();
  }

  openDetail(c: ContratoClienteRow): void {
    this.selectedClient.set(c);
  }

  closeDetail(): void {
    this.selectedClient.set(null);
  }

  loadTramitacion(): void {
    this.tramitacionLoading.set(true);
    this.tramitacion.getAbiertos().subscribe({
      next: items => {
        this.tramitacionItems.set(items);
        this.tramitacionLoading.set(false);
      },
      error: () => {
        this.tramitacionItems.set([]);
        this.tramitacionLoading.set(false);
      },
    });
  }
}
