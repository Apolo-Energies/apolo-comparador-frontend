import {
  ChangeDetectionStrategy, Component, computed, EventEmitter, inject,
  Output, Input, OnChanges, signal, SimpleChanges,
} from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { ApoloIcons, ShieldCheckIcon, UiIconSource, UserCircleIcon, XIcon } from '@apolo-energies/icons';
import {
  OpportunitySummary, OpportunityStatus, OpportunityFilters,
  OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_ALLOWED_TRANSITIONS,
  OPPORTUNITY_STATUS_ORDER,
} from '../../../../../../entities/opportunity.model';
import { OpportunityService } from '../../../../../../services/opportunity.service';
import { OpportunityCardComponent } from '../opportunity-card/opportunity-card';

interface BoardColumn {
  status:     OpportunityStatus;
  label:      string;
  loading:    boolean;
  items:      OpportunitySummary[];
  totalCount: number;
}

interface StatusPalette {
  dot:      string;
  badge:    string;
  iconText: string;
  iconRing: string;
  emptyDescription: string;
  emptyIcon?: UiIconSource;
}

const STATUS_ORDER = OPPORTUNITY_STATUS_ORDER;
const PAGE_SIZE_PER_COLUMN = 100;

@Component({
  selector: 'app-opportunities-board',
  standalone: true,
  imports: [DragDropModule, OpportunityCardComponent, ApoloIcons],
  templateUrl: './opportunities-board.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OpportunitiesBoardComponent implements OnChanges {
  @Input() filters: OpportunityFilters = {};
  @Output() countsChange = new EventEmitter<Record<OpportunityStatus, number>>();
  @Output() errorMessage = new EventEmitter<string>();
  @Output() cardOpen     = new EventEmitter<OpportunitySummary>();

  private oppService = inject(OpportunityService);

  private readonly userCircleIcon: UiIconSource = { type: 'apolo', icon: UserCircleIcon, size: 28 };
  private readonly checkIcon:      UiIconSource = { type: 'apolo', icon: ShieldCheckIcon, size: 28 };
  private readonly xCircleIcon:    UiIconSource = { type: 'apolo', icon: XIcon,           size: 28 };

  readonly columns = signal<BoardColumn[]>(STATUS_ORDER.map(status => ({
    status,
    label:      OPPORTUNITY_STATUS_LABEL[status],
    loading:    true,
    items:      [],
    totalCount: 0,
  })));

  readonly listIds = STATUS_ORDER.map(s => `column-${s}`);

  readonly globalLoading = computed(() => this.columns().some(c => c.loading));

  ngOnChanges(_: SimpleChanges) {
    this.load();
  }

  private load() {
    this.columns.update(cols => cols.map(c => ({ ...c, loading: true })));

    const requests = STATUS_ORDER.reduce((acc, status) => {
      acc[status] = this.oppService.list({
        ...this.filters,
        status,
        page: 1,
        pageSize: PAGE_SIZE_PER_COLUMN,
      });
      return acc;
    }, {} as Record<OpportunityStatus, ReturnType<OpportunityService['list']>>);

    forkJoin(requests).subscribe({
      next: results => {
        const next = STATUS_ORDER.map(status => {
          const r = results[status];
          return {
            status,
            label:      OPPORTUNITY_STATUS_LABEL[status],
            loading:    false,
            items:      r.items,
            totalCount: r.totalCount,
          } as BoardColumn;
        });
        this.columns.set(next);
        this.emitCounts();
      },
      error: () => {
        this.columns.update(cols => cols.map(c => ({ ...c, loading: false })));
      },
    });
  }

  private emitCounts() {
    const totals: Record<OpportunityStatus, number> = {
      [OpportunityStatus.Pending]:     0,
      [OpportunityStatus.Negotiation]: 0,
      [OpportunityStatus.Won]:         0,
      [OpportunityStatus.Lost]:        0,
    };
    for (const col of this.columns()) totals[col.status] = col.totalCount;
    this.countsChange.emit(totals);
  }

  paletteFor(status: OpportunityStatus): StatusPalette {
    switch (status) {
      case OpportunityStatus.Pending:
        return {
          dot:      'bg-blue-500',
          badge:    'bg-blue-500/10 text-blue-400 ring-blue-500/20',
          iconText: 'text-blue-400',
          iconRing: 'ring-blue-500/20',
          emptyDescription: 'Las oportunidades pendientes aparecerán aquí.',
          emptyIcon: this.userCircleIcon,
        };
      case OpportunityStatus.Negotiation:
        return {
          dot:      'bg-amber-400',
          badge:    'bg-amber-500/10 text-amber-400 ring-amber-500/20',
          iconText: 'text-amber-400',
          iconRing: 'ring-amber-500/20',
          emptyDescription: 'Las oportunidades en negociación aparecerán aquí.',
          emptyIcon: this.userCircleIcon,
        };
      case OpportunityStatus.Won:
        return {
          dot:      'bg-emerald-400',
          badge:    'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
          iconText: 'text-emerald-400',
          iconRing: 'ring-emerald-500/20',
          emptyDescription: 'Las oportunidades ganadas aparecerán aquí.',
          emptyIcon: this.checkIcon,
        };
      case OpportunityStatus.Lost:
        return {
          dot:      'bg-rose-400',
          badge:    'bg-rose-500/10 text-rose-400 ring-rose-500/20',
          iconText: 'text-rose-400',
          iconRing: 'ring-rose-500/20',
          emptyDescription: 'Las oportunidades perdidas aparecerán aquí.',
          emptyIcon: this.xCircleIcon,
        };
    }
  }

  trackByStatus = (_: number, col: BoardColumn) => col.status;
  trackById     = (_: number, item: OpportunitySummary) => item.id;

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
      return next.map(c => ({ ...c, totalCount: this.recountTotal(c, cols, item, targetStatus) }));
    });
    this.emitCounts();
  }

  private recountTotal(
    col: BoardColumn,
    prevCols: BoardColumn[],
    moved: OpportunitySummary,
    targetStatus: OpportunityStatus,
  ): number {
    const prev = prevCols.find(c => c.status === col.status)!;
    if (col.status === moved.status && col.status !== targetStatus) return Math.max(0, prev.totalCount - 1);
    if (col.status === targetStatus && col.status !== moved.status) return prev.totalCount + 1;
    return prev.totalCount;
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

  reload() { this.load(); }
}
