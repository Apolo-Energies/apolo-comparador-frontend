import { OpportunityStatus, OPPORTUNITY_STATUS_LABEL } from '../../../../core/models/opportunity.model';

export function fmtNum(n: number | null | undefined): string {
  return n == null ? '—' : n.toLocaleString('es-ES');
}

export function fmtGwh(kwh: number | null | undefined): string {
  if (!kwh) return '—';
  return (kwh / 1e6).toFixed(2) + ' GWh';
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES');
}

export function initials(name: string): string {
  return name.split(' ').map(x => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export function statusLabel(s: OpportunityStatus): string {
  return OPPORTUNITY_STATUS_LABEL[s] ?? '—';
}

export function statusClass(s: OpportunityStatus): string {
  switch (s) {
    case OpportunityStatus.Pending:     return 'bg-yellow-500/10 text-warning border border-yellow-500/20';
    case OpportunityStatus.Negotiation: return 'bg-blue-500/10 text-primary border border-blue-500/20';
    case OpportunityStatus.Won:         return 'bg-emerald-500/10 text-success border border-emerald-500/20';
    case OpportunityStatus.Lost:        return 'bg-red-500/10 text-danger border border-red-500/20';
    default:                            return 'bg-zinc-500/10 text-muted-foreground';
  }
}
