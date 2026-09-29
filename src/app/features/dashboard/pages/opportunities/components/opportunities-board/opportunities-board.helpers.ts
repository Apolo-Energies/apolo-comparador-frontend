import { UiIconSource } from '@apolo-energies/icons';
import { OpportunitySummary, OpportunityStatus } from '../../../../../../core/models/opportunity.model';

export const BOARD_PAGE_SIZE_PER_COLUMN  = 20;
export const BOARD_SCROLL_THRESHOLD_PX   = 200;

export interface BoardColumn {
  statuses:    OpportunityStatus[];
  label:       string;
  loading:     boolean;
  loadingMore: boolean;
  items:       OpportunitySummary[];
  totalCount:  number;
  currentPage: number;
  hasMore:     boolean;
}

export interface BoardGroup { statuses: OpportunityStatus[]; label: string; }
export const BOARD_GROUPS: BoardGroup[] = [
  { label: 'Pendiente',   statuses: [OpportunityStatus.Pending] },
  { label: 'Negociación', statuses: [OpportunityStatus.Negotiation, OpportunityStatus.Meeting, OpportunityStatus.ContractSent, OpportunityStatus.ContractSigned] },
  { label: 'Ganada',      statuses: [OpportunityStatus.Won] },
  { label: 'Perdida',     statuses: [OpportunityStatus.Lost, OpportunityStatus.Nurturing] },
  { label: 'Finalizado',  statuses: [OpportunityStatus.Finalized] },
  { label: 'Baja',        statuses: [OpportunityStatus.Cancelled] },
];

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

/** Fresh loading placeholder columns, one per group, in board display order. */
export function createInitialBoardColumns(): BoardColumn[] {
  return BOARD_GROUPS.map(g => ({
    statuses:    g.statuses,
    label:       g.label,
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
  const palettes: Record<OpportunityStatus, BoardStatusPalette> = {
    [OpportunityStatus.Pending]:        { dot: 'opp-dot-pending',         badge: 'opp-badge-pending',         iconText: 'opp-icon-pending',         iconRing: 'opp-icon-pending',         emptyDescription: 'Las oportunidades pendientes aparecerán aquí.',    emptyIcon: icons.userCircle },
    [OpportunityStatus.Negotiation]:    { dot: 'opp-dot-negotiation',     badge: 'opp-badge-negotiation',     iconText: 'opp-icon-negotiation',     iconRing: 'opp-icon-negotiation',     emptyDescription: 'Las oportunidades en negociación aparecerán aquí.', emptyIcon: icons.userCircle },
    [OpportunityStatus.Won]:            { dot: 'opp-dot-won',             badge: 'opp-badge-won',             iconText: 'opp-icon-won',             iconRing: 'opp-icon-won',             emptyDescription: 'Las oportunidades ganadas aparecerán aquí.',       emptyIcon: icons.check },
    [OpportunityStatus.Lost]:           { dot: 'opp-dot-lost',            badge: 'opp-badge-lost',            iconText: 'opp-icon-lost',            iconRing: 'opp-icon-lost',            emptyDescription: 'Las oportunidades perdidas aparecerán aquí.',      emptyIcon: icons.xCircle },
    [OpportunityStatus.Meeting]:        { dot: 'opp-dot-meeting',         badge: 'opp-badge-meeting',         iconText: 'opp-icon-meeting',         iconRing: 'opp-icon-meeting',         emptyDescription: 'Las reuniones aparecerán aquí.',                   emptyIcon: icons.userCircle },
    [OpportunityStatus.ContractSent]:   { dot: 'opp-dot-contract-sent',   badge: 'opp-badge-contract-sent',   iconText: 'opp-icon-contract-sent',   iconRing: 'opp-icon-contract-sent',   emptyDescription: 'Los contratos enviados aparecerán aquí.',          emptyIcon: icons.userCircle },
    [OpportunityStatus.ContractSigned]: { dot: 'opp-dot-contract-signed', badge: 'opp-badge-contract-signed', iconText: 'opp-icon-contract-signed', iconRing: 'opp-icon-contract-signed', emptyDescription: 'Los contratos firmados aparecerán aquí.',          emptyIcon: icons.check },
    [OpportunityStatus.Nurturing]:      { dot: 'opp-dot-nurturing',       badge: 'opp-badge-nurturing',       iconText: 'opp-icon-nurturing',       iconRing: 'opp-icon-nurturing',       emptyDescription: 'Las oportunidades en nurturing aparecerán aquí.',  emptyIcon: icons.userCircle },
    [OpportunityStatus.Finalized]:      { dot: 'opp-dot-finalized',       badge: 'opp-badge-finalized',       iconText: 'opp-icon-finalized',       iconRing: 'opp-icon-finalized',       emptyDescription: 'Las oportunidades finalizadas aparecerán aquí.',   emptyIcon: icons.check },
    [OpportunityStatus.Cancelled]:      { dot: 'opp-dot-cancelled',       badge: 'opp-badge-cancelled',       iconText: 'opp-icon-cancelled',       iconRing: 'opp-icon-cancelled',       emptyDescription: 'Las bajas aparecerán aquí.',                       emptyIcon: icons.xCircle },
  };
  return palettes[status];
}

/** Aggregates each column's totalCount and item volumes into the Records the page's KPI cards expect. */
export function aggregateBoardCounts(columns: BoardColumn[]): {
  totals:  Record<OpportunityStatus, number>;
  volumes: Record<OpportunityStatus, number>;
} {
  const totals  = Object.fromEntries(BOARD_GROUPS.map(g => [g.statuses[0], 0])) as Record<OpportunityStatus, number>;
  const volumes = Object.fromEntries(BOARD_GROUPS.map(g => [g.statuses[0], 0])) as Record<OpportunityStatus, number>;
  for (const col of columns) {
    totals[col.statuses[0]]  = col.totalCount;
    volumes[col.statuses[0]] = col.items.reduce((sum, o) => sum + (o.lastAnnualConsumption ?? 0), 0);
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
  const prev     = prevCols.find(c => c.statuses[0] === col.statuses[0])!;
  const isSource = prev.statuses.includes(moved.status);
  const isTarget = col.statuses.includes(targetStatus);
  if (isSource && !isTarget) return Math.max(0, prev.totalCount - 1);
  if (isTarget && !isSource) return prev.totalCount + 1;
  return prev.totalCount;
}

/** True once the user has scrolled near the bottom of a column, which triggers loading the next page. */
export function isNearColumnBottom(el: HTMLElement): boolean {
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
  return distanceFromBottom <= BOARD_SCROLL_THRESHOLD_PX;
}

export const trackBoardColumnByStatus = (_: number, col: BoardColumn) => col.statuses[0];
export const trackOpportunityById     = (_: number, item: OpportunitySummary) => item.id;
