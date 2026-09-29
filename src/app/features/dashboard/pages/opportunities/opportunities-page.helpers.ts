import { TemplateRef } from '@angular/core';
import { SelectOption } from '@apolo-energies/ui';
import { TableColumn } from '@apolo-energies/table';
import {
  OpportunitySummary, OpportunityStatus, OpportunityFilters,
  OPPORTUNITY_STATUS_LABEL, OPPORTUNITY_STATUS_ORDER,
} from '../../../../core/models/opportunity.model';
import { EnergyType } from '../../../../core/models/energy-type.enum';

/** Draft filter-bar inputs, before being turned into an OpportunityFilters snapshot. */
export interface OpportunityFilterDraft {
  search:    string;
  status:    string;
  dateFrom:  string;
  dateTo:    string;
  userName:  string;
  userEmail: string;
}

/** Parses the raw status filter value coming from the UI select. Empty string means "all statuses". */
export function parseOpportunityStatus(raw: string): OpportunityStatus | undefined {
  if (raw === '') return undefined;
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : (n as OpportunityStatus);
}

/** Builds an OpportunityFilters snapshot from the current draft inputs. EnergyType always comes from the route, never from the UI. */
export function buildOpportunityFilters(energyType: EnergyType, draft: OpportunityFilterDraft): OpportunityFilters {
  return {
    energyType,
    searchTerm:        draft.search    || undefined,
    status:            parseOpportunityStatus(draft.status),
    startDate:         draft.dateFrom  || undefined,
    endDate:           draft.dateTo    || undefined,
    createdByFullName: draft.userName  || undefined,
    createdByEmail:    draft.userEmail || undefined,
  };
}

export function formatOpportunityDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export const OPPORTUNITY_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'Todos los estados' },
  ...OPPORTUNITY_STATUS_ORDER.map(s => ({ value: String(s), label: OPPORTUNITY_STATUS_LABEL[s] })),
];

export interface OpportunityKpiGroup { label: string; key: OpportunityStatus; dot: string; icon: string; }

export const OPPORTUNITY_KPI_GROUPS: OpportunityKpiGroup[] = [
  { label: 'Pendiente',   key: OpportunityStatus.Pending,     dot: 'opp-dot-pending',     icon: 'opp-icon-pending'     },
  { label: 'Negociación', key: OpportunityStatus.Negotiation, dot: 'opp-dot-negotiation', icon: 'opp-icon-negotiation' },
  { label: 'Ganada',      key: OpportunityStatus.Won,         dot: 'opp-dot-won',         icon: 'opp-icon-won'         },
  { label: 'Perdida',     key: OpportunityStatus.Lost,        dot: 'opp-dot-lost',        icon: 'opp-icon-lost'        },
  { label: 'Finalizado',  key: OpportunityStatus.Finalized,   dot: 'opp-dot-finalized',   icon: 'opp-icon-finalized'   },
  { label: 'Baja',        key: OpportunityStatus.Cancelled,   dot: 'opp-dot-cancelled',   icon: 'opp-icon-cancelled'   },
];

export function zeroOpportunityCounts(): Record<OpportunityStatus, number> {
  return Object.fromEntries(OPPORTUNITY_STATUS_ORDER.map(s => [s, 0])) as Record<OpportunityStatus, number>;
}

/** Fresh table-column definitions for the "table" view mode. A factory (not a shared const) avoids sharing the mutable cellTemplate slots across page instances. */
export function createOpportunityTableColumns(): TableColumn<OpportunitySummary>[] {
  return [
    { key: 'cups',             label: 'CUPS' },
    { key: 'client',           label: 'Cliente' },
    { key: 'tariff',           label: 'Tarifa', format: row => row.tariff ?? '-' },
    { key: 'status',           label: 'Estado' },
    { key: 'comparisonsCount', label: 'Comp.', align: 'right' },
    { key: 'createdBy',        label: 'Creada por' },
    { key: 'updatedAt',        label: 'Actualizada' },
    { key: 'actions',          label: '' },
  ];
}

export interface OpportunityColumnTemplates {
  status:    TemplateRef<{ $implicit: OpportunitySummary }>;
  client:    TemplateRef<{ $implicit: OpportunitySummary }>;
  createdBy: TemplateRef<{ $implicit: OpportunitySummary }>;
  updatedAt: TemplateRef<{ $implicit: OpportunitySummary }>;
  actions:   TemplateRef<{ $implicit: OpportunitySummary }>;
}

/** Wires each @ViewChild cell template into its matching column definition. Mutates the given array in place, same as the original inline logic. */
export function applyOpportunityColumnTemplates(
  columns: TableColumn<OpportunitySummary>[],
  templates: OpportunityColumnTemplates,
): TableColumn<OpportunitySummary>[] {
  const set = (key: string, tpl: TemplateRef<{ $implicit: OpportunitySummary }>) => {
    const col = columns.find(c => c.key === key);
    if (col) col.cellTemplate = tpl;
  };
  set('status',    templates.status);
  set('client',    templates.client);
  set('createdBy', templates.createdBy);
  set('updatedAt', templates.updatedAt);
  set('actions',   templates.actions);
  return columns;
}
