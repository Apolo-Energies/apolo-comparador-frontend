import { OpportunityStatus, OPPORTUNITY_STATUS_LABEL } from '../../../../entities/opportunity.model';

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
    case OpportunityStatus.Pending:     return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20';
    case OpportunityStatus.Negotiation: return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
    case OpportunityStatus.Won:         return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
    case OpportunityStatus.Lost:        return 'bg-red-500/10 text-red-400 border border-red-500/20';
    default:                            return 'bg-zinc-500/10 text-zinc-400';
  }
}
