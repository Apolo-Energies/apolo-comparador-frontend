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
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { SearchIcon, SvgIcon, UiIconSource, XIcon } from '@apolo-energies/icons';
import { AuthService } from '@apolo-energies/auth';
import { ContractService } from '../../../../core/services/contract.service';
import { ContratoClienteRow, ContratosCards } from '../../../../core/models/contrato.model';
import { ContratoIncidencia, ContratoCheckItem } from '../../../../core/models/contrato-incidencia.model';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
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
  private readonly auth            = inject(AuthService);
  private readonly refreshToken    = inject(RefreshTokenService);

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };

  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));
  readonly delegationId = signal<number | null>(null);
  /** Master ve todos los contratos; el resto necesita una delegación asignada (claim del JWT). */
  readonly hasDelegation = computed(() => this.isMaster() || this.delegationId() !== null);

  readonly cardsLoading = signal(false);
  readonly cards        = signal<ContratosCards | null>(null);
  readonly cardTiles    = computed(() => buildCardTiles(this.cards()));

  readonly selectedClient = signal<ContratoClienteRow | null>(null);

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
    contractService: this.contractService,
    globalLoading:   this.globalLoading,
    onLoaded:        () => this.incidencias.load(),
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
  }

  loadCards(): void {
    this.cardsLoading.set(true);
    this.contractService.getContratosCards(this.delegationId()).subscribe({
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
