import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, computed, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent, SelectFieldComponent, SelectOption } from '@apolo-energies/ui';
import {
  ApoloIcons, chevronRightIcon, DateIcon, EmailIcon, filterIcon,
  ListIcon, NoteIcon, SearchIcon,
  UiIconSource, XIcon,
} from '@apolo-energies/icons';
import {
  OpportunitySummary, OpportunityStatus, OpportunityFilters,
  OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_STATUS_ORDER,
} from '../../../../entities/opportunity.model';
import { EnergyType } from '../../../../entities/energy-type.enum';
import { OpportunityService } from '../../../../services/opportunity.service';
import { OpportunityStatusBadgeComponent } from './components/opportunity-status-badge/opportunity-status-badge';
import { OpportunitiesBoardComponent } from './components/opportunities-board/opportunities-board';
import { OpportunityDetailDrawerComponent } from './components/opportunity-detail-drawer/opportunity-detail-drawer';
import { EsNumberPipe } from '../../../../shared/pipes/es-number.pipe';
import { environment } from '../../../../../environments/environment';
import { GlobalLoadingService } from '../../../../services/global-loading.service';
import { TableSkeletonComponent } from '../../../../shared/components/table-skeleton/table-skeleton.component';

type ViewMode = 'board' | 'table';

const _ZERO_COUNTS = () => Object.fromEntries(OPPORTUNITY_STATUS_ORDER.map(s => [s, 0])) as Record<OpportunityStatus, number>;

interface KpiGroup { label: string; key: OpportunityStatus; dot: string; icon: string; }

const KPI_GROUPS: KpiGroup[] = [
  { label: 'Pendiente',   key: OpportunityStatus.Pending,     dot: 'opp-dot-pending',    icon: 'opp-icon-pending'    },
  { label: 'Negociación', key: OpportunityStatus.Negotiation, dot: 'opp-dot-negotiation', icon: 'opp-icon-negotiation' },
  { label: 'Ganada',      key: OpportunityStatus.Won,         dot: 'opp-dot-won',         icon: 'opp-icon-won'         },
  { label: 'Perdida',     key: OpportunityStatus.Lost,        dot: 'opp-dot-lost',        icon: 'opp-icon-lost'        },
  { label: 'Finalizado',  key: OpportunityStatus.Finalized,   dot: 'opp-dot-finalized',   icon: 'opp-icon-finalized'   },
  { label: 'Baja',        key: OpportunityStatus.Cancelled,   dot: 'opp-dot-cancelled',   icon: 'opp-icon-cancelled'   },
];

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

  readonly tableroIcon: UiIconSource = { type: 'apolo', icon: NoteIcon, size: 14 };
  readonly tablaIcon:   UiIconSource = { type: 'apolo', icon: ListIcon, size: 14 };

  readonly viewMode = signal<ViewMode>('board');

  readonly selectedOpportunityId = signal<string | null>(null);

  readonly filterSearch     = signal('');
  readonly filterStatus     = signal<string>('');
  readonly filterDateFrom   = signal('');
  readonly filterDateTo     = signal('');
  readonly filterUserName   = signal('');
  readonly filterUserEmail  = signal('');
  readonly filtersOpen      = signal(false);

  readonly appliedFilters = signal<OpportunityFilters>({ energyType: this.energyType });

  readonly counts     = signal<Record<OpportunityStatus, number>>(_ZERO_COUNTS());
  readonly volumes    = signal<Record<OpportunityStatus, number>>(_ZERO_COUNTS());
  readonly conversion = signal(0);

  readonly kpiCards = computed(() => {
    const c = this.counts();
    const v = this.volumes();
    return KPI_GROUPS.map(g => ({
      label:     g.label,
      count:     c[g.key] ?? 0,
      volumeMwh: (v[g.key] ?? 0) / 1000,
      dot:       g.dot,
      icon:      g.icon,
    }));
  });


  readonly currentPage  = signal(1);
  readonly pageSize     = signal(10);
  readonly totalCount   = signal(0);
  readonly loadingTable = signal(false);
  readonly tableData    = signal<OpportunitySummary[]>([]);

  readonly statusOptions: SelectOption[] = [
    { value: '', label: 'Todos los estados' },
    ...OPPORTUNITY_STATUS_ORDER.map(s => ({ value: String(s), label: OPPORTUNITY_STATUS_LABEL[s] })),
  ];

  @ViewChild('statusCellTpl')   statusCellTpl!:   TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('clientCellTpl')   clientCellTpl!:   TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('creatorCellTpl')  creatorCellTpl!:  TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('updatedCellTpl')  updatedCellTpl!:  TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('actionsCellTpl')  actionsCellTpl!:  TemplateRef<{ $implicit: OpportunitySummary }>;
  @ViewChild('board')           board?: OpportunitiesBoardComponent;

  columns: TableColumn<OpportunitySummary>[] = [
    { key: 'cups',             label: 'CUPS' },
    { key: 'client',           label: 'Cliente' },
    { key: 'tariff',           label: 'Tarifa', format: row => row.tariff ?? '-' },
    { key: 'status',           label: 'Estado' },
    { key: 'comparisonsCount', label: 'Comp.', align: 'right' },
    { key: 'createdBy',        label: 'Creada por' },
    { key: 'updatedAt',        label: 'Actualizada' },
    { key: 'actions',          label: '' },
  ];

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
  }

  ngAfterViewInit() {
    const set = (k: string, tpl: TemplateRef<{ $implicit: OpportunitySummary }>) => {
      const c = this.columns.find(c => c.key === k);
      if (c) c.cellTemplate = tpl;
    };
    set('status',    this.statusCellTpl);
    set('client',    this.clientCellTpl);
    set('createdBy', this.creatorCellTpl);
    set('updatedAt', this.updatedCellTpl);
    set('actions',   this.actionsCellTpl);
    this.cdr.markForCheck();
  }

  private parseStatus(raw: string): OpportunityStatus | undefined {
    if (raw === '') return undefined;
    const n = Number(raw);
    return Number.isNaN(n) ? undefined : (n as OpportunityStatus);
  }

  /** Builds a filter snapshot from the current draft inputs. EnergyType siempre viene de la ruta, no del UI. */
  private buildDraftFilters(): OpportunityFilters {
    return {
      energyType:        this.energyType,
      searchTerm:        this.filterSearch()    || undefined,
      status:            this.parseStatus(this.filterStatus()),
      startDate:         this.filterDateFrom()  || undefined,
      endDate:           this.filterDateTo()    || undefined,
      createdByFullName: this.filterUserName()  || undefined,
      createdByEmail:    this.filterUserEmail() || undefined,
    };
  }

  readonly hasActiveFilters = computed(() => {
    const f = this.appliedFilters();
    return !!(f.searchTerm || f.status !== undefined
           || f.startDate || f.endDate || f.createdByFullName || f.createdByEmail);
  });

  readonly pageTitle = computed(() => this.energyType === EnergyType.Gas ? 'Oportunidades · Gas' : 'Oportunidades · Luz');

  readonly subtitleText = computed(() => {
    const total = (Object.values(this.counts()) as number[]).reduce((s, n) => s + n, 0);
    if (total === 0) return 'Pipeline de ventas';
    return `Pipeline de ventas · ${total.toLocaleString('es-ES')} oportunidades`;
  });

  toggleFilters() { this.filtersOpen.update(v => !v); }

  onFilterKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') this.onSearch();
  }

  onSearch() {
    this.appliedFilters.set(this.buildDraftFilters());
    if (this.viewMode() === 'board') {
      this.board?.reload();
    } else {
      this.currentPage.set(1);
      this.loadTable();
    }
  }

  onClearFilters() {
    this.filterSearch.set('');
    this.filterStatus.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterUserName.set('');
    this.filterUserEmail.set('');
    this.appliedFilters.set({ energyType: this.energyType });
    if (this.viewMode() === 'board') this.board?.reload();
    else { this.currentPage.set(1); this.loadTable(); }
  }

  setViewMode(mode: ViewMode) {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    if (mode === 'table' && this.tableData().length === 0) this.loadTable();
  }

  onBoardCounts(totals: Record<OpportunityStatus, number>) {
    const won   = totals[OpportunityStatus.Won]  ?? 0;
    const total = (Object.values(totals) as number[]).reduce((s, n) => s + n, 0);
    this.counts.set(totals);
    this.conversion.set(total > 0 ? (won / total) * 100 : 0);
  }

  onBoardVolumes(vols: Record<OpportunityStatus, number>) {
    this.volumes.set(vols);
  }


  onBoardError(message: string) {
    this.toast.add({
      severity: 'warn',
      summary:  'Transición no permitida',
      detail:   message,
      life:     4500,
    });
  }

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  private loadTable() {
    this.loadingTable.set(true);
    this.globalLoading.start();
    this.oppService.list({
      ...this.appliedFilters(),
      page:     this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe({
      next: res => {
        this.tableData.set(res.items);
        this.totalCount.set(res.totalCount);
        this.loadingTable.set(false);
        this.globalLoading.stop();
        this.cdr.markForCheck();
      },
      error: () => { this.loadingTable.set(false); this.globalLoading.stop(); },
    });
  }

  onPageChange(page: number)     { this.currentPage.set(page); this.loadTable(); }
  onPageSizeChange(size: number) { this.pageSize.set(size); this.currentPage.set(1); this.loadTable(); }

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
