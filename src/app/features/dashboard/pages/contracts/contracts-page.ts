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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import {
  ArrowUpDownIcon, DateIcon, FileDownIcon, InfoIcon, ListIcon, NoteIcon,
  SearchIcon, ShieldCheckIcon, SvgIcon, TradingDownIcon, UiIconSource, XIcon,
} from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { ContractService } from '../../../../core/services/contract.service';
import { ContratoClienteRow, ContratosCards } from '../../../../core/models/contrato.model';
import { ContratoIncidencia, ContratoCheckItem } from '../../../../core/models/contrato-incidencia.model';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { CollaboratorScopeService } from '../../../../core/services/collaborator-scope.service';
import { RefreshTokenService } from '../../../../core/services/refresh-token.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import { ContractDetailDrawerComponent } from './components/contract-detail-drawer/contract-detail-drawer';
import {
  applyContratosColumnTemplates, buildCardTiles, calcDias, estadoCls, estadoEntries,
  estadoLabel, fmtDate, fmtKwh, singleEstado,
} from './contracts-utils';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { ContractIncidenciasController } from './contract-incidencias.controller';
import { ContractsListController } from './contracts-list.controller';

@Component({
  selector: 'app-contracts-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    InputFieldComponent, ButtonComponent,
    TableSkeletonComponent,
    ContractDetailDrawerComponent,
    Dialog, FormsModule, ReactiveFormsModule,
    SvgIcon,
  ],
  templateUrl: './contracts-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './contracts-page.scss',
})
export class ContractsPageComponent implements AfterViewInit {
  @ViewChild('clienteTpl')      private clienteTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('cupsTpl')         private cupsTpl!:         TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('serviciosTpl')    private serviciosTpl!:    TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('consumoTpl')      private consumoTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('estadoTpl')       private estadoTpl!:       TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('vencimientoTpl')  private vencimientoTpl!:  TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('movimientoTpl')   private movimientoTpl!:   TemplateRef<{ $implicit: ContratoClienteRow }>;
  @ViewChild('detalleTpl')      private detalleTpl!:      TemplateRef<{ $implicit: ContratoClienteRow }>;

  private readonly contractService   = inject(ContractService);
  private readonly globalLoading     = inject(GlobalLoadingService);
  private readonly collaboratorScope = inject(CollaboratorScopeService);
  private readonly platformId        = inject(PLATFORM_ID);
  private readonly cdr               = inject(ChangeDetectorRef);
  private readonly auth              = inject(AuthService);
  private readonly refreshToken      = inject(RefreshTokenService);
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
  /** Master ve todos los contratos; el resto necesita una delegación asignada (claim del JWT). */
  readonly hasDelegation = computed(() => this.isMaster() || this.delegationId() !== null);

  readonly cardsLoading = signal(false);
  readonly cards        = signal<ContratosCards | null>(null);
  readonly cardTiles    = computed(() => buildCardTiles(this.cards()));

  readonly selectedClient = signal<ContratoClienteRow | null>(null);

  /**
   * Vista/filtro activo de la tabla. Pills alineadas con la referencia del portal EE
   * más los subfiltros temporales de renovaciones que ya teníamos.
   *   - Estados de contrato (A/F/P/B/R/C agrupados):
   *       todos      → sin filtro
   *       activos    → EstadoBreakdown tiene al menos 1 servicio A (Alta) o F (Firmado)
   *       pendientes → EstadoBreakdown tiene al menos 1 servicio P (Pendiente)
   *       renovados  → EstadoBreakdown tiene al menos 1 servicio R (Renovado)
   *       bajas      → EstadoBreakdown tiene al menos 1 servicio B (Baja) o C (Cancelado)
   *   - Vista temporal (renovaciones):
   *       porCaducar → ProximoVencimiento ≤ 60 días
   *       caducados  → ProximoVencimiento en el pasado
   */
  readonly filterMode = signal<
    'todos' | 'activos' | 'pendientes' | 'renovados' | 'bajas' | 'porCaducar' | 'caducados'
  >('todos');

  readonly setFilterMode = (m: ReturnType<typeof this.filterMode>): void => {
    this.filterMode.set(m);
    this.currentPage.set(1);
  };

  /** Backwards-compat con el HTML previo (tabs Todos/Por caducar/Caducados). */
  readonly viewMode = this.filterMode;
  readonly setViewMode = this.setFilterMode;

  /** Rango de fechas opcional sobre UltimoMovimiento — ISO "yyyy-mm-dd" o vacío. */
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
    const has = (codes: string[]) => codes.some(c => (bd[c] ?? 0) > 0);
    switch (mode) {
      case 'activos':    return has(['A', 'F']);
      case 'pendientes': return has(['P']);
      case 'renovados':  return has(['R']);
      case 'bajas':      return has(['B', 'C']);
      default:           return true;
    }
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

  /** Rows visibles tras aplicar los filtros combinados (pill + rango de fechas). */
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

  // Contadores para las pills (previa filtro de fechas para dar señal global).
  readonly countActivos     = computed(() => this.data().filter(r => this.matchesEstadoFilter(r, 'activos')).length);
  readonly countPendientes  = computed(() => this.data().filter(r => this.matchesEstadoFilter(r, 'pendientes')).length);
  readonly countRenovados   = computed(() => this.data().filter(r => this.matchesEstadoFilter(r, 'renovados')).length);
  readonly countBajas       = computed(() => this.data().filter(r => this.matchesEstadoFilter(r, 'bajas')).length);
  readonly countPorCaducar  = computed(() => this.data().filter(r => this.matchesVencimiento(r, 'porCaducar')).length);
  readonly countCaducados   = computed(() => this.data().filter(r => this.matchesVencimiento(r, 'caducados')).length);

  /**
   * Consumos totales por estado (segunda fila de KPIs).
   * Aproxima el consumo por estado repartiendo `ConsumoTotal` del row entre los
   * estados del `EstadoBreakdown` proporcionalmente al conteo. Para clientes con
   * un único estado es exacto; para mixtos es una aproximación decente sin exigir
   * datos adicionales al backend.
   */
  readonly consumoPorEstado = computed<{ activos: number; pendientes: number; renovados: number; bajas: number }>(() => {
    let activos = 0, pendientes = 0, renovados = 0, bajas = 0;
    for (const row of this.data()) {
      const bd = row.EstadoBreakdown ?? {};
      const totalServicios = Object.values(bd).reduce((s, n) => s + n, 0);
      if (totalServicios <= 0 || !row.ConsumoTotal) continue;
      const consumoPorServicio = row.ConsumoTotal / totalServicios;
      activos    += consumoPorServicio * ((bd['A'] ?? 0) + (bd['F'] ?? 0));
      pendientes += consumoPorServicio * (bd['P'] ?? 0);
      renovados  += consumoPorServicio * (bd['R'] ?? 0);
      bajas      += consumoPorServicio * ((bd['B'] ?? 0) + (bd['C'] ?? 0));
    }
    return { activos, pendientes, renovados, bajas };
  });

  // Checklist de incidencias (edición inline, adjuntos, firma) — estado y llamadas
  // al servicio viven en el controller (R1). Signals se exponen por referencia directa
  // para que la plantilla no cambie.
  private readonly incidencias = new ContractIncidenciasController({
    contractService: this.contractService,
  });

  readonly saving    = this.incidencias.saving;
  readonly formError = this.incidencias.formError;
  readonly editOpen  = this.incidencias.editOpen;
  readonly editItem  = this.incidencias.editItem;
  readonly editValue = this.incidencias.editValue;

  get canSaveEdit(): boolean { return this.incidencias.canSaveEdit; }

  getChecklist(row: ContratoClienteRow): ContratoCheckItem[] {
    return this.incidencias.getChecklist(row);
  }

  groupItems(items: ContratoCheckItem[], group: string): ContratoCheckItem[] {
    return this.incidencias.groupItems(items, group);
  }

  firstIncidencia(row: ContratoClienteRow): ContratoIncidencia | null {
    return this.incidencias.firstIncidencia(row);
  }

  hasIncidencia(row: ContratoClienteRow): boolean {
    return this.incidencias.hasIncidencia(row);
  }

  openEdit(inc: ContratoIncidencia, item: ContratoCheckItem): void {
    this.incidencias.openEdit(inc, item);
  }

  closeEdit(): void {
    this.incidencias.closeEdit();
  }

  saveEdit(): void {
    this.incidencias.saveEdit();
  }

  onAdjuntar(inc: ContratoIncidencia, event: Event): void {
    this.incidencias.onAdjuntar(inc, event);
  }

  toggleFirma(inc: ContratoIncidencia): void {
    this.incidencias.toggleFirma(inc);
  }

  readonly rowIsExpandable = (row: ContratoClienteRow) => this.hasIncidencia(row);
  readonly rowExpandBadge  = (_row: ContratoClienteRow) => null;

  // Búsqueda, filtros y paginación de la tabla — estado y llamada al servicio
  // viven en el controller (R1). Cada load() recarga incidencias en paralelo.
  private readonly list = new ContractsListController({
    contractService:   this.contractService,
    globalLoading:      this.globalLoading,
    collaboratorScope:  this.collaboratorScope,
    onLoaded:           () => this.incidencias.load(),
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

  onEstadoChange(v: string):   void { this.list.onEstadoChange(v); }
  onFaltanteChange(v: string): void { this.list.onFaltanteChange(v); }
  clearFilters():              void { this.list.clearFilters(); }
  onSearch():                  void { this.list.onSearch(); }
  onClear():                   void { this.list.onClear(); }
  onPageChange(page: number):  void { this.list.onPageChange(page); }
  onPageSizeChange(size: number): void { this.list.onPageSizeChange(size); }
  load():                      void { this.list.load(); }

  readonly columns = signal<TableColumn<ContratoClienteRow>[]>([
    { key: 'NombreCliente',      label: 'Cliente' },
    { key: 'CUPS',               label: 'CUPS',        align: 'center' },
    { key: 'NumServicios',       label: 'Servicios',   align: 'center' },
    { key: 'ConsumoTotal',       label: 'Consumo',     align: 'right' },
    { key: 'EstadoResumen',      label: 'Estado',      align: 'center' },
    { key: 'ProximoVencimiento', label: 'Próx. venc.', align: 'center' },
    { key: 'UltimoMovimiento',   label: 'Último mov.', align: 'center' },
    { key: '__detalle',          label: 'Detalle',     align: 'center' },
  ]);

  readonly estadoCls      = estadoCls;
  readonly estadoLabel    = estadoLabel;
  readonly fmtDate        = fmtDate;
  readonly calcDias       = calcDias;
  readonly fmtKwh         = fmtKwh;
  readonly singleEstado   = singleEstado;
  readonly estadoEntries  = estadoEntries;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.delegationId.set(this.refreshToken.getDelegationIdFromToken());
      if (this.hasDelegation()) {
        this.load();
        this.loadCards();
      }
    }
    // Recarga al cambiar el colaborador seleccionado en el sidebar (Master, Apolo).
    // Se salta la primera ejecución del effect: el load() de arriba ya cubre la carga inicial.
    effect(() => {
      this.collaboratorScope.selected();
      if (this.isFirstLoad) { this.isFirstLoad = false; return; }
      if (!this.hasDelegation()) return;
      this.list.currentPage.set(1);
      this.load();
      this.loadCards();
    });
  }

  loadCards(): void {
    this.cardsLoading.set(true);
    this.contractService.getContratosCards(this.delegationId(), this.collaboratorScope.selected()?.id).subscribe({
      next: cards => {
        this.cards.set(cards);
        this.cardsLoading.set(false);
      },
      error: () => {
        this.cards.set(null);
        this.cardsLoading.set(false);
      },
    });
  }

  ngAfterViewInit(): void {
    this.columns.update(cols => applyContratosColumnTemplates(cols, {
      NombreCliente:      this.clienteTpl,
      CUPS:               this.cupsTpl,
      NumServicios:       this.serviciosTpl,
      ConsumoTotal:       this.consumoTpl,
      EstadoResumen:      this.estadoTpl,
      ProximoVencimiento: this.vencimientoTpl,
      UltimoMovimiento:   this.movimientoTpl,
      __detalle:          this.detalleTpl,
    }));
    this.cdr.markForCheck();
  }

  openDetail(c: ContratoClienteRow): void {
    this.selectedClient.set(c);
  }

  closeDetail(): void {
    this.selectedClient.set(null);
  }

}
