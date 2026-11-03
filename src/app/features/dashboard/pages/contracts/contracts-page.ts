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
import { AuthService } from '@apolo-energies/auth';
import { ContractService } from '../../../../core/services/contract.service';
import { ContratoClienteRow, TipoEnergia } from '../../../../core/models/contrato.model';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { CollaboratorScopeService } from '../../../../core/services/collaborator-scope.service';
import { RefreshTokenService } from '../../../../core/services/refresh-token.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ContractDetailDrawerComponent } from './components/contract-detail-drawer/contract-detail-drawer';
import { TramitacionPanelComponent } from './components/tramitacion-panel/tramitacion-panel';
import { TramitacionItem, TramitacionService } from '../../../../core/services/tramitacion.service';
import {
  applyContratosColumnTemplates, estadoCls, estadoEntries, estadoLabel, fmtDate, singleEstado,
} from './contracts-utils';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { ContractsListController } from './contracts-list.controller';

@Component({
  selector: 'app-contracts-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    TableSkeletonComponent,
    ContractDetailDrawerComponent,
    TramitacionPanelComponent,
  ],
  templateUrl: './contracts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './contracts-page.scss',
})
export class ContractsPageComponent implements AfterViewInit {
  @ViewChild('tipoTpl')           private tipoTpl!:           TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('nombreTpl')         private nombreTpl!:         TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('clienteTpl')        private clienteTpl!:        TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('cupsTpl')           private cupsTpl!:           TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('fechaInicioTpl')    private fechaInicioTpl!:    TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('fechaFinTpl')       private fechaFinTpl!:       TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('fechaCreacionTpl')  private fechaCreacionTpl!:  TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('estadoTpl')         private estadoTpl!:         TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('firmaTpl')          private firmaTpl!:          TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('incidenciaTpl')     private incidenciaTpl!:     TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('colaboradorTpl')    private colaboradorTpl!:    TemplateRef<{ $implicit: ContratoClienteRow }>;

  private readonly contractService   = inject(ContractService);
  private readonly globalLoading     = inject(GlobalLoadingService);
  private readonly collaboratorScope = inject(CollaboratorScopeService);
  private readonly platformId        = inject(PLATFORM_ID);
  private readonly cdr               = inject(ChangeDetectorRef);
  private readonly auth              = inject(AuthService);
  private readonly refreshToken      = inject(RefreshTokenService);
  private readonly tramitacion       = inject(TramitacionService);
  private isFirstLoad                = true;

  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));
  readonly delegationId = signal<number | null>(null);
  readonly hasDelegation = computed(() => this.isMaster() || this.delegationId() !== null);

  readonly selectedClient = signal<ContratoClienteRow | null>(null);

  // Badge "En tramitación": cambia la tabla por el panel de lo que falta en esos contratos.
  readonly showTramitacion    = signal(false);
  readonly tramitacionItems   = signal<TramitacionItem[]>([]);
  readonly tramitacionLoading = signal(false);

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
  readonly filterTipo     = this.list.filterTipo;
  readonly fechaDesde     = this.list.fechaDesde;
  readonly fechaHasta     = this.list.fechaHasta;
  readonly visibleData    = this.list.data;
  readonly totalPages     = this.list.totalPages;
  readonly totalCount     = this.list.totalCount;
  readonly total          = this.list.total;

  get hasFilters(): boolean { return this.list.hasFilters; }
  /** Búsqueda, Luz/Gas o cualquier filtro aplicado: muestra "Limpiar filtros". */
  get hasAnyFilter(): boolean { return this.list.hasFilters || !!this.filter() || !!this.filterTipo(); }

  onEstadoChange(v: string):      void { this.list.onEstadoChange(v); }
  onFaltanteChange(v: string):    void { this.list.onFaltanteChange(v); }
  onTipoChange(v: TipoEnergia | ''): void { this.list.onTipoChange(v); }
  setFechaDesde(v: string):       void { this.list.onFechaDesdeChange(v); }
  setFechaHasta(v: string):       void { this.list.onFechaHastaChange(v); }

  readonly tipoOptions: { value: TipoEnergia | ''; label: string }[] = [
    { value: '',    label: 'Todos' },
    { value: 'luz', label: 'Luz' },
    { value: 'gas', label: 'Gas' },
  ];
  clearFilters():                 void { this.list.clearFilters(); }
  onSearch():                     void { this.list.onSearch(); }
  onClear():                      void { this.list.clearAll(); }
  onPageChange(page: number):     void { this.list.onPageChange(page); }
  onPageSizeChange(size: number): void { this.list.onPageSizeChange(size); }
  load():                         void { this.list.load(); }

  // Mismas columnas que el listado de contratos de Quixotic, más Tipo (luz/gas), Colaborador e Incidencia.
  // Al pulsar una fila se abre el detalle (onTableClick).
  readonly columns = signal<TableColumn<ContratoClienteRow>[]>([
    { key: 'TipoEnergia',     label: 'Tipo',              align: 'center' },
    { key: '__nombre',        label: 'Nombre' },
    { key: 'NombreCliente',   label: 'Cliente' },
    { key: 'NombreDelegacion', label: 'Colaborador' },
    { key: 'CUPS',            label: 'CUPS' },
    { key: 'FechaInicio',     label: 'Fecha de inicio' },
    { key: 'FechaFin',        label: 'Fecha de fin' },
    { key: 'FechaCreacion',   label: 'Fecha de creación' },
    { key: 'EstadoResumen',   label: 'Estado',            align: 'center' },
    { key: 'EstadoFirma',     label: 'Estado de firma',   align: 'center' },
    { key: 'TieneIncidencia', label: 'Incidencia',        align: 'center' },
  ]);

  readonly estadoCls      = estadoCls;
  readonly estadoLabel    = estadoLabel;
  readonly fmtDate        = fmtDate;
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
      TipoEnergia:     this.tipoTpl,
      __nombre:        this.nombreTpl,
      NombreCliente:   this.clienteTpl,
      NombreDelegacion: this.colaboradorTpl,
      CUPS:            this.cupsTpl,
      FechaInicio:     this.fechaInicioTpl,
      FechaFin:        this.fechaFinTpl,
      FechaCreacion:   this.fechaCreacionTpl,
      EstadoResumen:   this.estadoTpl,
      EstadoFirma:     this.firmaTpl,
      TieneIncidencia: this.incidenciaTpl,
    }));
    this.cdr.markForCheck();
  }

  openDetail(c: ContratoClienteRow): void {
    this.selectedClient.set(c);
  }

  closeDetail(): void {
    this.selectedClient.set(null);
  }

  // lib-data-table no emite click de fila: se resuelve por la posición del <tr> en el tbody,
  // que sigue el orden de visibleData().
  onTableClick(ev: MouseEvent): void {
    const tr = (ev.target as HTMLElement).closest('tbody tr');
    if (!tr?.parentElement) return;
    const idx = Array.prototype.indexOf.call(tr.parentElement.children, tr);
    const row = this.visibleData()[idx];
    if (row) this.openDetail(row);
  }

  toggleTramitacion(): void {
    const show = !this.showTramitacion();
    this.showTramitacion.set(show);
    if (show) this.loadTramitacion();
  }

  loadTramitacion(): void {
    this.tramitacionLoading.set(true);
    this.tramitacion.getEnTramitacion().subscribe({
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
