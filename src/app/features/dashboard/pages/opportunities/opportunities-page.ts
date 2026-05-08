import {
  AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef,
  Component, computed, inject, signal, TemplateRef, ViewChild, PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DataTableComponent, PaginatorComponent, TableColumn } from '@apolo-energies/table';
import { ButtonComponent, InputFieldComponent, SelectFieldComponent, SelectOption } from '@apolo-energies/ui';
import {
  ApoloIcons, chevronRightIcon, DateIcon, EmailIcon, filterIcon,
  ListIcon, NoteIcon, SearchIcon, ShieldCheckIcon, TradingUpIcon,
  UiIconSource, XIcon,
} from '@apolo-energies/icons';
import {
  OpportunitySummary, OpportunityStatus, OpportunityFilters,
  OPPORTUNITY_STATUS_LABEL,
} from '../../../../entities/opportunity.model';
import { OpportunityService } from '../../../../services/opportunity.service';
import { OpportunityStatusBadgeComponent } from './components/opportunity-status-badge/opportunity-status-badge';
import { OpportunitiesBoardComponent } from './components/opportunities-board/opportunities-board';
import { OpportunityDetailDrawerComponent } from './components/opportunity-detail-drawer/opportunity-detail-drawer';
import { EsNumberPipe } from '../../../../shared/pipes/es-number.pipe';

type ViewMode = 'board' | 'table';

interface KpiTotals {
  total:       number;
  pending:     number;
  negotiation: number;
  won:         number;
  lost:        number;
  conversion:  number;
}

interface KpiVolumes {
  pending:     number;
  negotiation: number;
  won:         number;
  lost:        number;
}

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
  ],
  templateUrl: './opportunities-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunitiesPageComponent implements AfterViewInit {
  private oppService = inject(OpportunityService);
  private platformId = inject(PLATFORM_ID);
  private cdr        = inject(ChangeDetectorRef);
  private router     = inject(Router);
  private toast      = inject(MessageService);

  // icons
  readonly searchIcon: UiIconSource = { type: 'apolo', icon: SearchIcon, size: 16 };
  readonly filterIcon: UiIconSource = { type: 'apolo', icon: filterIcon, size: 16 };
  readonly xIcon:      UiIconSource = { type: 'apolo', icon: XIcon,      size: 16 };
  readonly eyeIcon:    UiIconSource = { type: 'apolo', icon: chevronRightIcon, size: 16 };
  readonly dateIcon:   UiIconSource = { type: 'apolo', icon: DateIcon,   size: 16 };
  readonly emailIcon:  UiIconSource = { type: 'apolo', icon: EmailIcon,  size: 14 };
  readonly listIcon:   UiIconSource = { type: 'apolo', icon: ListIcon,   size: 16 };

  // KPI tile icons
  readonly kpiIconTotal:      UiIconSource = { type: 'apolo', icon: NoteIcon,        size: 36 };
  readonly kpiIconWon:        UiIconSource = { type: 'apolo', icon: ShieldCheckIcon, size: 36 };
  readonly kpiIconConversion: UiIconSource = { type: 'apolo', icon: TradingUpIcon,   size: 36 };
  readonly kpiIconLost:       UiIconSource = { type: 'apolo', icon: XIcon,           size: 36 };

  // segmented control icons
  readonly tableroIcon: UiIconSource = { type: 'apolo', icon: NoteIcon, size: 14 };
  readonly tablaIcon:   UiIconSource = { type: 'apolo', icon: ListIcon, size: 14 };

  //view mode
  readonly viewMode = signal<ViewMode>('board');

  // side drawer
  readonly selectedOpportunityId = signal<string | null>(null);

  readonly filterSearch     = signal('');
  readonly filterStatus     = signal<string>('');
  readonly filterDateFrom   = signal('');
  readonly filterDateTo     = signal('');
  readonly filterUserName   = signal('');
  readonly filterUserEmail  = signal('');
  readonly filtersOpen      = signal(false);

  readonly appliedFilters = signal<OpportunityFilters>({});

  readonly kpis = signal<KpiTotals>({
    total: 0, pending: 0, negotiation: 0, won: 0, lost: 0, conversion: 0,
  });

  readonly volumes = signal<KpiVolumes>({
    pending: 0, negotiation: 0, won: 0, lost: 0,
  });


  // table mode state 
  readonly currentPage  = signal(1);
  readonly pageSize     = signal(10);
  readonly totalCount   = signal(0);
  readonly loadingTable = signal(false);
  readonly tableData    = signal<OpportunitySummary[]>([]);

  readonly statusOptions: SelectOption[] = [
    { value: '',                                       label: 'Todos los estados' },
    { value: String(OpportunityStatus.Pending),        label: OPPORTUNITY_STATUS_LABEL[OpportunityStatus.Pending] },
    { value: String(OpportunityStatus.Negotiation),    label: OPPORTUNITY_STATUS_LABEL[OpportunityStatus.Negotiation] },
    { value: String(OpportunityStatus.Won),            label: OPPORTUNITY_STATUS_LABEL[OpportunityStatus.Won] },
    { value: String(OpportunityStatus.Lost),           label: OPPORTUNITY_STATUS_LABEL[OpportunityStatus.Lost] },
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

  //derived

  private parseStatus(raw: string): OpportunityStatus | undefined {
    if (raw === '') return undefined;
    const n = Number(raw);
    return Number.isNaN(n) ? undefined : (n as OpportunityStatus);
  }

  /** Builds a filter snapshot from the current draft inputs. */
  private buildDraftFilters(): OpportunityFilters {
    return {
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

  readonly kpiPending     = computed(() => this.kpis().pending);
  readonly kpiWon         = computed(() => this.kpis().won);
  readonly kpiConversion  = computed(() => this.kpis().conversion);
  readonly kpiLost        = computed(() => this.kpis().lost);

  readonly volPending = computed(() => this.volumes().pending);
  readonly volWon     = computed(() => this.volumes().won);
  readonly volLost    = computed(() => this.volumes().lost);

  readonly subtitleText = computed(() => {
    const total = this.kpis().total;
    if (total === 0) return 'Pipeline de ventas';
    return `Pipeline de ventas · ${total.toLocaleString('es-ES')} oportunidades`;
  });

  // handlers 

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
    this.appliedFilters.set({});
    if (this.viewMode() === 'board') this.board?.reload();
    else { this.currentPage.set(1); this.loadTable(); }
  }

  setViewMode(mode: ViewMode) {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    if (mode === 'table' && this.tableData().length === 0) this.loadTable();
  }

  onBoardCounts(totals: Record<OpportunityStatus, number>) {
    const pending     = totals[OpportunityStatus.Pending];
    const negotiation = totals[OpportunityStatus.Negotiation];
    const won         = totals[OpportunityStatus.Won];
    const lost        = totals[OpportunityStatus.Lost];
    const total       = pending + negotiation + won + lost;
    const conversion  = total > 0 ? (won / total) * 100 : 0;
    this.kpis.set({ total, pending, negotiation, won, lost, conversion });
  }

  onBoardVolumes(volumes: Record<OpportunityStatus, number>) {
    this.volumes.set({
      pending:     volumes[OpportunityStatus.Pending],
      negotiation: volumes[OpportunityStatus.Negotiation],
      won:         volumes[OpportunityStatus.Won],
      lost:        volumes[OpportunityStatus.Lost],
    });
  }


  onBoardError(message: string) {
    this.toast.add({
      severity: 'warn',
      summary:  'Transición no permitida',
      detail:   message,
      life:     4500,
    });
  }

  //table mode

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  private loadTable() {
    this.loadingTable.set(true);
    this.oppService.list({
      ...this.appliedFilters(),
      page:     this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe({
      next: res => {
        this.tableData.set(res.items);
        this.totalCount.set(res.totalCount);
        this.loadingTable.set(false);
        this.cdr.markForCheck();
      },
      error: () => this.loadingTable.set(false),
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
