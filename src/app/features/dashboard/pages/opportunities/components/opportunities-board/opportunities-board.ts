import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, EventEmitter, inject,
  Input, OnChanges, OnInit, Output, signal, SimpleChanges,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { debounceTime, finalize, Subject, switchMap } from 'rxjs';
import { GlobalLoadingService } from '../../../../../../core/services/global-loading.service';
import { ApoloIcons, ShieldCheckIcon, UiIconSource, UserCircleIcon, XIcon } from '@apolo-energies/icons';
import {
  OpportunitySummary, OpportunityStatus, OpportunityFilters,
  OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_ALLOWED_TRANSITIONS,
} from '../../../../../../core/models/opportunity.model';
import { OpportunityService } from '../../../../../../core/services/opportunity.service';
import { OpportunityCountsStore } from '../../../../../../core/services/opportunity-counts.store';
import { OpportunityCardComponent } from '../opportunity-card/opportunity-card';
import { EsNumberPipe } from '../../../../../../shared/pipes/es-number.pipe';
import {
  aggregateBoardCounts, BOARD_PAGE_SIZE_PER_COLUMN, BOARD_STATUS_ORDER, BoardColumn,
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
  private countsStore    = inject(OpportunityCountsStore);
  private destroyRef     = inject(DestroyRef);
  private globalLoadingSvc = inject(GlobalLoadingService);

  private readonly userCircleIcon: UiIconSource = { type: 'apolo', icon: UserCircleIcon, size: 28 };
  private readonly checkIcon:      UiIconSource = { type: 'apolo', icon: ShieldCheckIcon, size: 28 };
  private readonly xCircleIcon:    UiIconSource = { type: 'apolo', icon: XIcon,           size: 28 };

  readonly columns = signal<BoardColumn[]>(createInitialBoardColumns());

  readonly listIds = BOARD_STATUS_ORDER.map(s => `column-${s}`);

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
        this.columns.set(BOARD_STATUS_ORDER.map(status => {
          const col = byStatus.get(status);
          const items      = col?.items      ?? [];
          const totalCount = col?.totalCount ?? 0;
          return {
            status,
            label:       OPPORTUNITY_STATUS_LABEL[status],
            loading:     false,
            loadingMore: false,
            items,
            totalCount,
            currentPage: col?.currentPage ?? 1,
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

  onColumnScroll(event: Event, status: OpportunityStatus) {
    const el = event.target as HTMLElement;
    if (!isNearColumnBottom(el)) return;
    this.loadMore(status);
  }

  private loadMore(status: OpportunityStatus) {
    const col = this.columns().find(c => c.status === status);
    if (!col || col.loading || col.loadingMore || !col.hasMore) return;

    const nextPage = col.currentPage + 1;
    this.columns.update(cols => cols.map(c =>
      c.status === status ? { ...c, loadingMore: true } : c
    ));

    this.oppService.list({
      ...this.filters, status, page: nextPage, pageSize: BOARD_PAGE_SIZE_PER_COLUMN,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: result => {
        this.columns.update(cols => cols.map(c => {
          if (c.status !== status) return c;
          const existingIds = new Set(c.items.map(i => i.id));
          const newItems = result.items.filter(i => !existingIds.has(i.id));
          const items = [...c.items, ...newItems];
          return {
            ...c,
            items,
            loadingMore: false,
            currentPage: result.currentPage,
            totalCount:  result.totalCount,
            hasMore:     items.length < result.totalCount,
          };
        }));
        this.emitCounts();
      },
      error: () => {
        this.columns.update(cols => cols.map(c =>
          c.status === status ? { ...c, loadingMore: false } : c
        ));
      },
    });
  }

  onDrop(event: CdkDragDrop<OpportunitySummary[]>, targetStatus: OpportunityStatus) {
    if (event.previousContainer === event.container) return;

    const item = event.item.data as OpportunitySummary;
    if (!item) return;
    if (item.status === targetStatus) return;

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
      const next = cols.map(col => ({
        ...col,
        items: col.items.filter(o => o.id !== item.id),
      }));
      const targetIdx = next.findIndex(c => c.status === targetStatus);
      if (targetIdx >= 0) {
        const updated = { ...item, status: targetStatus };
        next[targetIdx] = {
          ...next[targetIdx],
          items: [updated, ...next[targetIdx].items],
        };
      }
      return next.map(c => ({ ...c, totalCount: recountBoardColumnTotal(c, cols, item, targetStatus) }));
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
