import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, EventEmitter, inject,
  Input, OnChanges, OnInit, Output, signal, SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { debounceTime, finalize, forkJoin, Subject, switchMap } from 'rxjs';
import { GlobalLoadingService } from '../../../../../../services/global-loading.service';
import { ApoloIcons, ShieldCheckIcon, UiIconSource, UserCircleIcon, XIcon } from '@apolo-energies/icons';
import {
  OpportunitySummary, OpportunityStatus, OpportunityFilters,
  OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_ALLOWED_TRANSITIONS,
  OPPORTUNITY_STATUS_ORDER,
} from '../../../../../../entities/opportunity.model';
import { OpportunityService } from '../../../../../../services/opportunity.service';
import { OpportunityHubService } from '../../../../../../services/opportunity-hub.service';
import { OpportunityCountsStore } from '../../../../../../services/opportunity-counts.store';
import { OpportunityCardComponent } from '../opportunity-card/opportunity-card';
import { EsNumberPipe } from '../../../../../../shared/pipes/es-number.pipe';

interface BoardColumn {
  statuses:    OpportunityStatus[];
  label:       string;
  loading:     boolean;
  loadingMore: boolean;
  items:       OpportunitySummary[];
  totalCount:  number;
  currentPage: number;
  hasMore:     boolean;
}

interface BoardGroup { statuses: OpportunityStatus[]; label: string; }
const BOARD_GROUPS: BoardGroup[] = [
  { label: 'Pendiente',   statuses: [OpportunityStatus.Pending] },
  { label: 'Negociación', statuses: [OpportunityStatus.Negotiation, OpportunityStatus.Meeting, OpportunityStatus.ContractSent, OpportunityStatus.ContractSigned] },
  { label: 'Ganada',      statuses: [OpportunityStatus.Won] },
  { label: 'Perdida',     statuses: [OpportunityStatus.Lost, OpportunityStatus.Nurturing] },
  { label: 'Finalizado',  statuses: [OpportunityStatus.Finalized] },
  { label: 'Baja',        statuses: [OpportunityStatus.Cancelled] },
];

interface StatusPalette {
  dot:      string;
  badge:    string;
  iconText: string;
  iconRing: string;
  emptyDescription: string;
  emptyIcon?: UiIconSource;
}

const STATUS_ORDER = OPPORTUNITY_STATUS_ORDER;
const PAGE_SIZE_PER_COLUMN = 20;
const SCROLL_THRESHOLD_PX = 200;

const ICON_USER:  UiIconSource = { type: 'apolo', icon: UserCircleIcon,  size: 28 };
const ICON_CHECK: UiIconSource = { type: 'apolo', icon: ShieldCheckIcon, size: 28 };
const ICON_X:     UiIconSource = { type: 'apolo', icon: XIcon,           size: 28 };

const STATUS_PALETTE: Record<OpportunityStatus, StatusPalette> = {
  [OpportunityStatus.Pending]:        { dot: 'opp-dot-pending',         badge: 'opp-badge-pending',         iconText: 'opp-icon-pending',         iconRing: 'opp-icon-pending',         emptyDescription: 'Las oportunidades pendientes aparecerán aquí.',   emptyIcon: ICON_USER  },
  [OpportunityStatus.Negotiation]:    { dot: 'opp-dot-negotiation',     badge: 'opp-badge-negotiation',     iconText: 'opp-icon-negotiation',     iconRing: 'opp-icon-negotiation',     emptyDescription: 'Las oportunidades en negociación aparecerán aquí.', emptyIcon: ICON_USER  },
  [OpportunityStatus.Won]:            { dot: 'opp-dot-won',             badge: 'opp-badge-won',             iconText: 'opp-icon-won',             iconRing: 'opp-icon-won',             emptyDescription: 'Las oportunidades ganadas aparecerán aquí.',       emptyIcon: ICON_CHECK },
  [OpportunityStatus.Lost]:           { dot: 'opp-dot-lost',            badge: 'opp-badge-lost',            iconText: 'opp-icon-lost',            iconRing: 'opp-icon-lost',            emptyDescription: 'Las oportunidades perdidas aparecerán aquí.',      emptyIcon: ICON_X     },
  [OpportunityStatus.Meeting]:        { dot: 'opp-dot-meeting',         badge: 'opp-badge-meeting',         iconText: 'opp-icon-meeting',         iconRing: 'opp-icon-meeting',         emptyDescription: 'Las reuniones aparecerán aquí.',                   emptyIcon: ICON_USER  },
  [OpportunityStatus.ContractSent]:   { dot: 'opp-dot-contract-sent',   badge: 'opp-badge-contract-sent',   iconText: 'opp-icon-contract-sent',   iconRing: 'opp-icon-contract-sent',   emptyDescription: 'Los contratos enviados aparecerán aquí.',          emptyIcon: ICON_USER  },
  [OpportunityStatus.ContractSigned]: { dot: 'opp-dot-contract-signed', badge: 'opp-badge-contract-signed', iconText: 'opp-icon-contract-signed', iconRing: 'opp-icon-contract-signed', emptyDescription: 'Los contratos firmados aparecerán aquí.',          emptyIcon: ICON_CHECK },
  [OpportunityStatus.Nurturing]:      { dot: 'opp-dot-nurturing',       badge: 'opp-badge-nurturing',       iconText: 'opp-icon-nurturing',       iconRing: 'opp-icon-nurturing',       emptyDescription: 'Las oportunidades en nurturing aparecerán aquí.',  emptyIcon: ICON_USER  },
  [OpportunityStatus.Finalized]:      { dot: 'opp-dot-finalized',       badge: 'opp-badge-finalized',       iconText: 'opp-icon-finalized',       iconRing: 'opp-icon-finalized',       emptyDescription: 'Las oportunidades finalizadas aparecerán aquí.',   emptyIcon: ICON_CHECK },
  [OpportunityStatus.Cancelled]:      { dot: 'opp-dot-cancelled',       badge: 'opp-badge-cancelled',       iconText: 'opp-icon-cancelled',       iconRing: 'opp-icon-cancelled',       emptyDescription: 'Las bajas aparecerán aquí.',                       emptyIcon: ICON_X     },
};

@Component({
  selector: 'app-opportunities-board',
  standalone: true,
  imports: [DragDropModule, OpportunityCardComponent, ApoloIcons, EsNumberPipe],
  templateUrl: './opportunities-board.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunitiesBoardComponent implements OnInit, OnChanges {
  @Input() filters: OpportunityFilters = {};
  @Output() countsChange = new EventEmitter<Record<OpportunityStatus, number>>();
  @Output() volumesChange = new EventEmitter<Record<OpportunityStatus, number>>();
  @Output() errorMessage = new EventEmitter<string>();
  @Output() cardOpen     = new EventEmitter<OpportunitySummary>();

  private oppService     = inject(OpportunityService);
  private hubService     = inject(OpportunityHubService);
  private countsStore    = inject(OpportunityCountsStore);
  private destroyRef     = inject(DestroyRef);
  private globalLoadingSvc = inject(GlobalLoadingService);

  readonly columns = signal<BoardColumn[]>(BOARD_GROUPS.map(g => ({
    statuses:    g.statuses,
    label:       g.label,
    loading:     true,
    loadingMore: false,
    items:       [],
    totalCount:  0,
    currentPage: 1,
    hasMore:     false,
  })));

  readonly listIds = BOARD_GROUPS.map(g => `column-${g.statuses[0]}`);

  readonly globalLoading = computed(() => this.columns().some(c => c.loading));

  private readonly loadTrigger$ = new Subject<void>();

  constructor() {
    this.loadTrigger$.pipe(
      debounceTime(0),
      switchMap(() => {
        this.columns.update(cols => cols.map(c => ({ ...c, loading: true })));
        this.globalLoadingSvc.start();
        return this.oppService.board({
          ...this.filters,
          pageSize: PAGE_SIZE_PER_COLUMN,
        }).pipe(
          finalize(() => this.globalLoadingSvc.stop()),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: response => {
        const byStatus = new Map(response.columns.map(c => [c.status, c]));
        this.columns.set(BOARD_GROUPS.map(group => {
          const apiCols  = group.statuses.map(s => byStatus.get(s));
          const items     = apiCols.flatMap(c => c?.items      ?? []);
          const totalCount = apiCols.reduce((s, c)  => s + (c?.totalCount ?? 0), 0);
          return {
            statuses:    group.statuses,
            label:       group.label,
            loading:     false,
            loadingMore: false,
            items,
            totalCount,
            currentPage: 1,
            hasMore:     items.length < totalCount,
          };
        }));
        // La respuesta del board incluye los contadores del sidebar para evitar la
        // segunda llamada del layout (GET /opportunities/summary).
        this.countsStore.update(response.sidebarBadges);
        this.emitCounts();
      },
      error: () => {
        this.columns.update(cols => cols.map(c => ({ ...c, loading: false })));
      },
    });
  }

  ngOnInit(): void {
    this.loadTrigger$.next();
    this.hubService.start();
    this.hubService.opportunityUpdated$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(updated => this.handleHubUpdate(updated));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && !changes['filters'].isFirstChange()) {
      this.loadTrigger$.next();
    }
  }

  private emitCounts() {
    const totals  = Object.fromEntries(STATUS_ORDER.map(s => [s, 0])) as Record<OpportunityStatus, number>;
    const volumes = Object.fromEntries(STATUS_ORDER.map(s => [s, 0])) as Record<OpportunityStatus, number>;
    for (const col of this.columns()) {
      totals[col.statuses[0]]  = col.totalCount;
      volumes[col.statuses[0]] = col.items.reduce((sum, o) => sum + (o.lastAnnualConsumption ?? 0), 0);
    }
    this.countsChange.emit(totals);
    this.volumesChange.emit(volumes);
  }

  paletteFor(status: OpportunityStatus): StatusPalette {
    return STATUS_PALETTE[status];
  }

  trackByStatus = (_: number, col: BoardColumn) => col.statuses[0];
  trackById     = (_: number, item: OpportunitySummary) => item.id;

  onColumnScroll(event: Event, col: BoardColumn) {
    const el = event.target as HTMLElement;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > SCROLL_THRESHOLD_PX) return;
    this.loadMore(col);
  }

  private loadMore(col: BoardColumn) {
    if (col.loading || col.loadingMore || !col.hasMore) return;
    const primary  = col.statuses[0];
    const nextPage = col.currentPage + 1;
    this.columns.update(cols => cols.map(c =>
      c.statuses[0] === primary ? { ...c, loadingMore: true } : c
    ));
    forkJoin(
      col.statuses.map(s =>
        this.oppService.list({ ...this.filters, status: s, page: nextPage, pageSize: PAGE_SIZE_PER_COLUMN })
      )
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: results => {
        this.columns.update(cols => cols.map(c => {
          if (c.statuses[0] !== primary) return c;
          const existingIds = new Set(c.items.map(i => i.id));
          const newItems    = results.flatMap(r => r.items).filter(i => !existingIds.has(i.id));
          const totalCount  = results.reduce((s, r) => s + r.totalCount, 0);
          const items       = [...c.items, ...newItems];
          return { ...c, items, loadingMore: false, currentPage: nextPage, totalCount, hasMore: items.length < totalCount };
        }));
        this.emitCounts();
      },
      error: () => {
        this.columns.update(cols => cols.map(c =>
          c.statuses[0] === primary ? { ...c, loadingMore: false } : c
        ));
      },
    });
  }

  onDrop(event: CdkDragDrop<OpportunitySummary[]>, col: BoardColumn) {
    if (event.previousContainer === event.container) return;
    const item = event.item.data as OpportunitySummary;
    if (!item) return;
    if (col.statuses.includes(item.status)) return;
    const targetStatus = col.statuses[0];
    const allowed = OPPORTUNITY_ALLOWED_TRANSITIONS[item.status] ?? [];
    if (!allowed.includes(targetStatus)) {
      this.errorMessage.emit(
        `No se permite la transición de ${OPPORTUNITY_STATUS_LABEL[item.status]} a ${OPPORTUNITY_STATUS_LABEL[targetStatus]}.`
      );
      return;
    }
    this.applyOptimistic(item, targetStatus);

    this.oppService.updateStatus(item.id, targetStatus).subscribe({
      next: updated => this.replaceItem(updated),
      error: () => {
        this.applyOptimistic(item, item.status);
        this.errorMessage.emit('No se pudo cambiar el estado. Inténtalo de nuevo.');
      },
    });
  }

  private applyOptimistic(item: OpportunitySummary, targetStatus: OpportunityStatus) {
    this.columns.update(cols => {
      const next = cols.map(col => ({ ...col, items: col.items.filter(o => o.id !== item.id) }));
      const targetIdx = next.findIndex(c => c.statuses.includes(targetStatus));
      if (targetIdx >= 0) {
        const updated = { ...item, status: targetStatus };
        next[targetIdx] = { ...next[targetIdx], items: [updated, ...next[targetIdx].items] };
      }
      return next.map(c => ({ ...c, totalCount: this.recountTotal(c, cols, item, targetStatus) }));
    });
    this.emitCounts();
  }

  private recountTotal(col: BoardColumn, prevCols: BoardColumn[], moved: OpportunitySummary, targetStatus: OpportunityStatus): number {
    const prev     = prevCols.find(c => c.statuses[0] === col.statuses[0])!;
    const isSource = prev.statuses.includes(moved.status);
    const isTarget = col.statuses.includes(targetStatus);
    if (isSource && !isTarget) return Math.max(0, prev.totalCount - 1);
    if (isTarget && !isSource) return prev.totalCount + 1;
    return prev.totalCount;
  }

  private handleHubUpdate(updated: OpportunitySummary): void {
    this.columns.update(cols => {
      const srcCol = cols.find(c => c.items.some(i => i.id === updated.id));
      const dstCol = cols.find(c => c.statuses.includes(updated.status));
      return cols.map(col => {
        const isSrc = srcCol && col.statuses[0] === srcCol.statuses[0];
        const isDst = dstCol && col.statuses[0] === dstCol.statuses[0];
        if (isSrc && !isDst)
          return { ...col, items: col.items.filter(i => i.id !== updated.id), totalCount: Math.max(0, col.totalCount - 1) };
        if (isDst && !isSrc)
          return { ...col, items: [updated, ...col.items], totalCount: col.totalCount + 1 };
        if (isSrc && isDst)
          return { ...col, items: col.items.map(i => i.id === updated.id ? { ...i, ...updated } : i) };
        return col;
      });
    });
    this.emitCounts();
  }

  private replaceItem(updated: OpportunitySummary) {
    this.columns.update(cols => cols.map(col => ({
      ...col,
      items: col.items.map(o => o.id === updated.id ? { ...o, ...updated } : o),
    })));
  }

  onCardOpen(opportunity: OpportunitySummary) {
    this.cardOpen.emit(opportunity);
  }

  reload() { this.loadTrigger$.next(); }
}
