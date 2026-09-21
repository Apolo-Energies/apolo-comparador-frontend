import { UiIconSource } from '@apolo-energies/icons';
import {
  OpportunitySummary, OpportunityStatus, OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_STATUS_ORDER,
} from '../../../../../../core/models/opportunity.model';

export const BOARD_STATUS_ORDER          = OPPORTUNITY_STATUS_ORDER;
export const BOARD_PAGE_SIZE_PER_COLUMN  = 20;
export const BOARD_SCROLL_THRESHOLD_PX   = 200;

export interface BoardColumn {
  status:      OpportunityStatus;
  label:       string;
  loading:     boolean;
  loadingMore: boolean;
  items:       OpportunitySummary[];
  totalCount:  number;
  currentPage: number;
  hasMore:     boolean;
}

export interface BoardStatusPalette {
  dot:      string;
  badge:    string;
  iconText: string;
  iconRing: string;
  emptyDescription: string;
  emptyIcon?: UiIconSource;
}

/** Icons the board component owns (bound to concrete UiIconSource instances) and hands to the pure palette lookup below. */
export interface BoardStatusIcons {
  userCircle: UiIconSource;
  check:      UiIconSource;
  xCircle:    UiIconSource;
}

/** Fresh loading placeholder columns, one per status, in board display order. */
export function createInitialBoardColumns(): BoardColumn[] {
  return BOARD_STATUS_ORDER.map(status => ({
    status,
    label:       OPPORTUNITY_STATUS_LABEL[status],
    loading:     true,
    loadingMore: false,
    items:       [],
    totalCount:  0,
    currentPage: 1,
    hasMore:     false,
  }));
}

/** Visual palette (colors + empty-state copy/icon) per opportunity status. Pure UI mapping, no service calls. */
export function resolveBoardStatusPalette(status: OpportunityStatus, icons: BoardStatusIcons): BoardStatusPalette {
  switch (status) {
    case OpportunityStatus.Pending:
      return {
        dot:      'bg-blue-500',
        badge:    'bg-blue-500/10 text-blue-400 ring-blue-500/20',
        iconText: 'text-blue-400',
        iconRing: 'ring-blue-500/20',
        emptyDescription: 'Las oportunidades pendientes aparecerán aquí.',
        emptyIcon: icons.userCircle,
      };
    case OpportunityStatus.Negotiation:
      return {
        dot:      'bg-amber-400',
        badge:    'bg-amber-500/10 text-amber-400 ring-amber-500/20',
        iconText: 'text-amber-400',
        iconRing: 'ring-amber-500/20',
        emptyDescription: 'Las oportunidades en negociación aparecerán aquí.',
        emptyIcon: icons.userCircle,
      };
    case OpportunityStatus.Won:
      return {
        dot:      'bg-emerald-400',
        badge:    'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
        iconText: 'text-emerald-400',
        iconRing: 'ring-emerald-500/20',
        emptyDescription: 'Las oportunidades ganadas aparecerán aquí.',
        emptyIcon: icons.check,
      };
    case OpportunityStatus.Lost:
      return {
        dot:      'bg-rose-400',
        badge:    'bg-rose-500/10 text-rose-400 ring-rose-500/20',
        iconText: 'text-rose-400',
        iconRing: 'ring-rose-500/20',
        emptyDescription: 'Las oportunidades perdidas aparecerán aquí.',
        emptyIcon: icons.xCircle,
      };
  }
}

/** Aggregates each column's totalCount and item volumes into the Records the page's KPI cards expect. */
export function aggregateBoardCounts(columns: BoardColumn[]): {
  totals:  Record<OpportunityStatus, number>;
  volumes: Record<OpportunityStatus, number>;
} {
  const totals: Record<OpportunityStatus, number> = {
    [OpportunityStatus.Pending]:     0,
    [OpportunityStatus.Negotiation]: 0,
    [OpportunityStatus.Won]:         0,
    [OpportunityStatus.Lost]:        0,
  };
  const volumes: Record<OpportunityStatus, number> = {
    [OpportunityStatus.Pending]:     0,
    [OpportunityStatus.Negotiation]: 0,
    [OpportunityStatus.Won]:         0,
    [OpportunityStatus.Lost]:        0,
  };
  for (const col of columns) {
    totals[col.status]  = col.totalCount;
    volumes[col.status] = col.items.reduce((sum, o) => sum + (o.lastAnnualConsumption ?? 0), 0);
  }
  return { totals, volumes };
}

/** Recomputes a column's totalCount after an optimistic drag-and-drop move, before the server confirms it. */
export function recountBoardColumnTotal(
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

/** True once the user has scrolled near the bottom of a column, which triggers loading the next page. */
export function isNearColumnBottom(el: HTMLElement): boolean {
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distanceFromBottom <= BOARD_SCROLL_THRESHOLD_PX;
}

export const trackBoardColumnByStatus = (_: number, col: BoardColumn) => col.status;
export const trackOpportunityById     = (_: number, item: OpportunitySummary) => item.id;
