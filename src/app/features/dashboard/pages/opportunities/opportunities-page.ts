import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, computed, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent, SelectFieldComponent } from '@apolo-energies/ui';
import {
  ApoloIcons, chevronRightIcon, DateIcon, EmailIcon, filterIcon,
  ListIcon, NoteIcon, SearchIcon, ShieldCheckIcon, TradingUpIcon,
  UiIconSource, XIcon,
} from '@apolo-energies/icons';
import { OpportunitySummary, OpportunityStatus } from '../../../../core/models/opportunity.model';
import { EnergyType } from '../../../../core/models/energy-type.enum';
import { OpportunityService } from '../../../../core/services/opportunity.service';
import { OpportunityStatusBadgeComponent } from './components/opportunity-status-badge/opportunity-status-badge';
import { OpportunitiesBoardComponent } from './components/opportunities-board/opportunities-board';
import { OpportunityDetailDrawerComponent } from './components/opportunity-detail-drawer/opportunity-detail-drawer';
import { EsNumberPipe } from '../../../../shared/pipes/es-number.pipe';
import { environment } from '../../../../../environments/environment';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';
import {
  applyOpportunityColumnTemplates, computeOpportunityKpiTotals, createOpportunityTableColumns,
  formatOpportunityDate, mapOpportunityKpiVolumes, OpportunityKpiTotals, OpportunityKpiVolumes,
  OPPORTUNITY_STATUS_OPTIONS,
} from './opportunities-page.helpers';
import { OpportunityFiltersController } from './opportunities-filters.controller';
import { OpportunitiesTableController } from './opportunities-table.controller';

type ViewMode = 'board' | 'table';

@Component({
  selector: 'app-opportunities-page',
  standalone: true,
  imports: [
    DataTableComponent, PaginatorComponent,
    InputFieldComponent, SelectFieldComponent, ButtonComponent,
    OpportunityStatusBadgeComponent,
    OpportunitiesBoardComponent,
    OpportunityDetailDrawerComponent,
    ApoloIcons,
    EsNumberPipe,
    TableSkeletonComponent,
  ],
  templateUrl: './opportunities-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunitiesPageComponent implements AfterViewInit {
  private oppService    = inject(OpportunityService);
  private platformId    = inject(PLATFORM_ID);
  private cdr           = inject(ChangeDetectorRef);
  private router        = inject(Router);
  private route         = inject(ActivatedRoute);
  private toast         = inject(MessageService);
  private globalLoading = inject(GlobalLoadingService);

  /** Tipo de energía determinado por la ruta (data.energyType). Default: Electricity. */
  readonly energyType: EnergyType = (this.route.snapshot.data['energyType'] as EnergyType | undefined) ?? EnergyType.Electricity;

  readonly isApolo = environment.features.userDetail;

  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly filterIcon: UiIconSource = { type: 'apolo', icon: filterIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };
  readonly eyeIcon:    UiIconSource = { type: 'apolo', icon: chevronRightIcon, size: 16 };
  readonly dateIcon:   UiIconSource = { type: 'apolo', icon: DateIcon,   size: 16 };
  readonly emailIcon:  UiIconSource = { type: 'apolo', icon: EmailIcon,  size: 14 };
  readonly listIcon:   UiIconSource = { type: 'apolo', icon: ListIcon,   size: 16 };

  readonly kpiIconTotal:      UiIconSource = { type: 'apolo', icon: NoteIcon,        size: 36 };
  readonly kpiIconWon:        UiIconSource = { type: 'apolo', icon: ShieldCheckIcon, size: 36 };
  readonly kpiIconConversion: UiIconSource = { type: 'apolo', icon: TradingUpIcon,   size: 36 };
  readonly kpiIconLost:       UiIconSource = { type: 'apolo', icon: XIcon,           size: 36 };

  readonly tableroIcon: UiIconSource = { type: 'apolo', icon: NoteIcon, size: 14 };
  readonly tablaIcon:   UiIconSource = { type: 'apolo', icon: ListIcon, size: 14 };

  readonly viewMode = signal<ViewMode>('board');
  readonly selectedOpportunityId = signal<string | null>(null);

  // Filtros del filter-bar (draft + snapshot aplicado) — estado y lógica
  // viven en el controller (R1). Signals se exponen por referencia directa
  // para que la plantilla no cambie.
  private readonly filters = new OpportunityFiltersController(this.energyType);

  readonly filterSearch     = this.filters.search;
  readonly filterStatus     = this.filters.status;
  readonly filterDateFrom   = this.filters.dateFrom;
  readonly filterDateTo     = this.filters.dateTo;
  readonly filterUserName   = this.filters.userName;
  readonly filterUserEmail  = this.filters.userEmail;
  readonly filtersOpen      = this.filters.open;
  readonly appliedFilters   = this.filters.applied;
  readonly hasActiveFilters = this.filters.hasActive;
  readonly statusOptions    = OPPORTUNITY_STATUS_OPTIONS;

  readonly kpis = signal<OpportunityKpiTotals>({
    total: 0, pending: 0, negotiation: 0, won: 0, lost: 0, conversion: 0,
  });

  readonly volumes = signal<OpportunityKpiVolumes>({
    pending: 0, negotiation: 0, won: 0, lost: 0,
  });

  // Vista "tabla" — paginación y llamada al servicio viven en el controller
  // (R1). Signals se exponen por referencia directa para que la plantilla no
  // cambie.
  private readonly table = new OpportunitiesTableController({
    oppService:    this.oppService,
    globalLoading: this.globalLoading,
    cdr:           this.cdr,
    getFilters:    () => this.appliedFilters(),
  });

  readonly currentPage  = this.table.currentPage;
  readonly pageSize     = this.table.pageSize;
  readonly totalCount   = this.table.totalCount;
  readonly loadingTable = this.table.loading;
  readonly tableData    = this.table.data;
  readonly totalPages   = this.table.totalPages;

  @ViewChild('statusCellTpl')   statusCellTpl!:   TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('clientCellTpl')   clientCellTpl!:   TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('creatorCellTpl')  creatorCellTpl!:  TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('updatedCellTpl')  updatedCellTpl!:  TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('actionsCellTpl')  actionsCellTpl!:  TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('board')           board?: OpportunitiesBoardComponent;

  columns: TableColumn<OpportunitySummary>[] = createOpportunityTableColumns();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
  }

  ngAfterViewInit() {
    applyOpportunityColumnTemplates(this.columns, {
      status:    this.statusCellTpl,
      client:    this.clientCellTpl,
      createdBy: this.creatorCellTpl,
      updatedAt: this.updatedCellTpl,
      actions:   this.actionsCellTpl,
    });
    this.cdr.markForCheck();
  }

  readonly kpiPending     = computed(() => this.kpis().pending);
  readonly kpiWon         = computed(() => this.kpis().won);
  readonly kpiConversion  = computed(() => this.kpis().conversion);
  readonly kpiLost        = computed(() => this.kpis().lost);

  readonly volPending = computed(() => this.volumes().pending);
  readonly volWon     = computed(() => this.volumes().won);
  readonly volLost    = computed(() => this.volumes().lost);

  readonly pageTitle = computed(() => this.energyType === EnergyType.Gas ? 'Oportunidades · Gas' : 'Oportunidades · Luz');

  readonly subtitleText = computed(() => {
    const total = this.kpis().total;
    if (total === 0) return 'Pipeline de ventas';
    return `Pipeline de ventas · ${total.toLocaleString('es-ES')} oportunidades`;
  });

  toggleFilters() { this.filters.toggle(); }

  onFilterKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.onSearch();
  }

  onSearch() {
    this.filters.apply();
    if (this.viewMode() === 'board') this.board?.reload();
    else this.table.reload();
  }

  onClearFilters() {
    this.filters.clear();
    if (this.viewMode() === 'board') this.board?.reload();
    else this.table.reload();
  }

  setViewMode(mode: ViewMode) {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    if (mode === 'table' && this.tableData().length === 0) this.table.load();
  }

  onBoardCounts(totals: Record<OpportunityStatus, number>) {
    this.kpis.set(computeOpportunityKpiTotals(totals));
  }

  onBoardVolumes(volumes: Record<OpportunityStatus, number>) {
    this.volumes.set(mapOpportunityKpiVolumes(volumes));
  }

  onBoardError(message: string) {
    this.toast.add({
      severity: 'warn',
      summary:  'Transición no permitida',
      detail:   message,
      life:     4500,
    });
  }

  formatDate(iso: string): string {
    return formatOpportunityDate(iso);
  }

  onPageChange(page: number)     { this.table.onPageChange(page); }
  onPageSizeChange(size: number) { this.table.onPageSizeChange(size); }

  openDetail(row: OpportunitySummary) {
    this.selectedOpportunityId.set(row.id);
  }

  closeDrawer() {
    this.selectedOpportunityId.set(null);
  }

  onDrawerUpdated() {
    this.board?.reload();
  }
}
