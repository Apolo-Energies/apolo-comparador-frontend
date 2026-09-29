import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, EventEmitter, inject,
  Input, OnChanges, OnInit, Output, signal, SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { debounceTime, finalize, forkJoin, Subject, switchMap } from 'rxjs';
import { GlobalLoadingService } from '../../../../../../core/services/global-loading.service';
import { ApoloIcons, ShieldCheckIcon, UiIconSource, UserCircleIcon, XIcon } from '@apolo-energies/icons';
import {
  OpportunitySummary, OpportunityStatus, OpportunityFilters,
  OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_ALLOWED_TRANSITIONS,
} from '../../../../../../core/models/opportunity.model';
import { OpportunityService } from '../../../../../../core/services/opportunity.service';
import { OpportunityHubService } from '../../../../../../core/services/opportunity-hub.service';
import { OpportunityCountsStore } from '../../../../../../core/services/opportunity-counts.store';
import { OpportunityCardComponent } from '../opportunity-card/opportunity-card';
import { EsNumberPipe } from '../../../../../../shared/pipes/es-number.pipe';
import {
  aggregateBoardCounts, BOARD_GROUPS, BOARD_PAGE_SIZE_PER_COLUMN, BoardColumn,
  BoardStatusPalette, createInitialBoardColumns, isNearColumnBottom, recountBoardColumnTotal,
  resolveBoardStatusPalette, trackBoardColumnByStatus, trackOpportunityById,
} from './opportunities-board.helpers';

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

  private readonly userCircleIcon: UiIconSource = { type: 'apolo', icon: UserCircleIcon, size: 28 };
  private readonly checkIcon:      UiIconSource = { type: 'apolo', icon: ShieldCheckIcon, size: 28 };
  private readonly xCircleIcon:    UiIconSource = { type: 'apolo', icon: XIcon,           size: 28 };

  readonly columns = signal<BoardColumn[]>(createInitialBoardColumns());

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
          pageSize: BOARD_PAGE_SIZE_PER_COLUMN,
        }).pipe(
          finalize(() => this.globalLoadingSvc.stop()),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: response => {
        const byStatus = new Map(response.columns.map(c => [c.status, c]));
        this.columns.set(BOARD_GROUPS.map(group => {
          const apiCols    = group.statuses.map(s => byStatus.get(s));
          const items      = apiCols.flatMap(c => c?.items ?? []);
          const totalCount = apiCols.reduce((sum, c) => sum + (c?.totalCount ?? 0), 0);
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
    const { totals, volumes } = aggregateBoardCounts(this.columns());
    this.countsChange.emit(totals);
    this.volumesChange.emit(volumes);
  }

  paletteFor(status: OpportunityStatus): BoardStatusPalette {
    return resolveBoardStatusPalette(status, {
      userCircle: this.userCircleIcon,
      check:      this.checkIcon,
      xCircle:    this.xCircleIcon,
    });
  }

  readonly trackByStatus = trackBoardColumnByStatus;
  readonly trackById     = trackOpportunityById;

  onColumnScroll(event: Event, col: BoardColumn) {
    const el = event.target as HTMLElement;
    if (!isNearColumnBottom(el)) return;
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
        this.oppService.list({ ...this.filters, status: s, page: nextPage, pageSize: BOARD_PAGE_SIZE_PER_COLUMN })
      )
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: results => {
        this.columns.update(cols => cols.map(c => {
          if (c.statuses[0] !== primary) return c;
          const existingIds = new Set(c.items.map(i => i.id));
          const newItems    = results.flatMap(r => r.items).filter(i => !existingIds.has(i.id));
          const totalCount  = results.reduce((sum, r) => sum + r.totalCount, 0);
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
      return next.map(c => ({ ...c, totalCount: recountBoardColumnTotal(c, cols, item, targetStatus) }));
    });
    this.emitCounts();
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
