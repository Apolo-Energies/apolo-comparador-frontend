const ESTADO_MAP: Record<string, { label: string; cls: string }> = {
  F: { label: 'Firmado',   cls: 'bg-[#1AD5981A] text-[#1AD598]'   },
  A: { label: 'Alta',      cls: 'bg-blue-500/10 text-blue-400'     },
  P: { label: 'Pendiente', cls: 'bg-yellow-500/10 text-yellow-400' },
  B: { label: 'Baja',      cls: 'bg-[#ef444440] text-[#ef4444]'   },
  R: { label: 'Renovado',  cls: 'bg-violet-500/10 text-violet-400' },
  C: { label: 'Cancelado', cls: 'bg-[#ef444440] text-[#ef4444]'   },
};

export function estadoCls(code: string): string {
  return ESTADO_MAP[code?.toUpperCase()]?.cls ?? 'bg-accent/40 text-muted-foreground';
}

export function estadoLabel(code: string): string {
  return ESTADO_MAP[code?.toUpperCase()]?.label ?? (code || '—');
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function calcDias(fechaFin?: string | null): number | null {
  if (!fechaFin) return null;
  return Math.ceil((new Date(fechaFin).getTime() - Date.now()) / 86_400_000);
}

export function fmtKwh(kwh: number): string {
  if (!kwh) return '—';
  if (kwh >= 1_000_000) return `${(kwh / 1_000_000).toFixed(2)} GWh`;
  if (kwh >= 1_000)     return `${(kwh / 1_000).toFixed(2)} MWh`;
  return `${kwh.toFixed(0)} kWh`;
}

interface ServicioDedupItem {
  CUPS:        string;
  Estado:      string;
  FechaInicio: string | null;
  FechaFin:    string | null;
}

/**
 * Ranking del estado del servicio (mayor = más vigente).
 * Espeja el ranking del backend en GetMisContratos para que la deduplicación
 * en el drawer coincida con NumServicios (unique CUPS del cliente).
 */
function estadoRank(s: ServicioDedupItem): number {
  const estado = (s.Estado ?? '').toUpperCase();
  const vigente = s.FechaFin ? new Date(s.FechaFin).getTime() >= Date.now() : false;
  switch (estado) {
    case 'A': return 100;
    case 'F': return vigente ? 80 : 60;
    case 'R': return 40;
    case 'P': return 40;
    case 'B': return 20;
    case 'C': return 20;
    default:  return 10;
  }
}

/**
 * Colapsa el histórico de servicios a 1 por CUPS eligiendo el "ganador":
 * mayor EstadoRank → luego FechaInicio más reciente.
 * Garantiza que el drawer muestra exactamente NumServicios cards (una por CUPS).
 */
export function dedupeServiciosByCups<T extends ServicioDedupItem>(services: T[]): T[] {
  const byCups = new Map<string, T>();
  for (const s of services) {
    const cups = s.CUPS;
    if (!cups) continue;
    const existing = byCups.get(cups);
    if (!existing) {
      byCups.set(cups, s);
      continue;
    }
    const delta = estadoRank(s) - estadoRank(existing);
    if (delta > 0) { byCups.set(cups, s); continue; }
    if (delta < 0) continue;
    const currStart = s.FechaInicio ? new Date(s.FechaInicio).getTime() : 0;
    const exStart   = existing.FechaInicio ? new Date(existing.FechaInicio).getTime() : 0;
    if (currStart > exStart) byCups.set(cups, s);
  }
  return Array.from(byCups.values());
}
