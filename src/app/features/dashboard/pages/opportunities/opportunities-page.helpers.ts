import { TemplateRef } from '@angular/core';
import { SelectOption } from '@apolo-energies/ui';
import { TableColumn } from '@apolo-energies/table';
import {
  OpportunitySummary, OpportunityStatus, OpportunityFilters,
  OPPORTUNITY_STATUS_LABEL,
} from '../../../../core/models/opportunity.model';
import { EnergyType } from '../../../../core/models/energy-type.enum';

export interface OpportunityKpiTotals {
  total:       number;
  pending:     number;
  negotiation: number;
  won:         number;
  lost:        number;
  conversion:  number;
}

export interface OpportunityKpiVolumes {
  pending:     number;
  negotiation: number;
  won:         number;
  lost:        number;
}

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

/** Converts the per-status totals emitted by the board into the KPI summary shown in the header cards. */
export function computeOpportunityKpiTotals(totals: Record<OpportunityStatus, number>): OpportunityKpiTotals {
  const pending     = totals[OpportunityStatus.Pending];
  const negotiation = totals[OpportunityStatus.Negotiation];
  const won         = totals[OpportunityStatus.Won];
  const lost        = totals[OpportunityStatus.Lost];
  const total       = pending + negotiation + won + lost;
  const conversion  = total > 0 ? (won / total) * 100 : 0;
  return { total, pending, negotiation, won, lost, conversion };
}

/** Maps the per-status volumes emitted by the board into the KPI volume summary. */
export function mapOpportunityKpiVolumes(volumes: Record<OpportunityStatus, number>): OpportunityKpiVolumes {
  return {
    pending:     volumes[OpportunityStatus.Pending],
    negotiation: volumes[OpportunityStatus.Negotiation],
    won:         volumes[OpportunityStatus.Won],
    lost:        volumes[OpportunityStatus.Lost],
  };
}

export function formatOpportunityDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export const OPPORTUNITY_STATUS_OPTIONS: SelectOption[] = [
  { value: '',                                    label: 'Todos los estados' },
  { value: String(OpportunityStatus.Pending),     label: OPPORTUNITY_STATUS_LABEL[OpportunityStatus.Pending] },
  { value: String(OpportunityStatus.Negotiation), label: OPPORTUNITY_STATUS_LABEL[OpportunityStatus.Negotiation] },
  { value: String(OpportunityStatus.Won),         label: OPPORTUNITY_STATUS_LABEL[OpportunityStatus.Won] },
  { value: String(OpportunityStatus.Lost),        label: OPPORTUNITY_STATUS_LABEL[OpportunityStatus.Lost] },
];

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
