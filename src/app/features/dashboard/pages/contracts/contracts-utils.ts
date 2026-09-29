import { TemplateRef } from '@angular/core';
import { TableColumn } from '@apolo-energies/table';
import { FileDownIcon, NoteIcon, SearchIcon, ShieldCheckIcon, XIcon } from '@apolo-energies/icons';
import { ContratoClienteRow, ContratosCards } from '../../../../core/models/contrato.model';

export interface ContratosCardTile {
  key:    keyof ContratosCards;
  label:  string;
  icon:   typeof ShieldCheckIcon;
  accent: string;
  /** Cada ícono de @apolo-energies/icons trae su propio viewBox/stroke-width
   *  hardcodeado, así que a igual [size] se ven de peso visual desparejo —
   *  se compensa afinando el size por ícono (ver también .contratos-tile-icon
   *  en styles.css, que fuerza un stroke-width uniforme). */
  size:   number;
  value:  number | null;
}

/**
 * Colores de estado tomados del skill de dataviz (paleta de status, variante dark —
 * la app no tiene tema claro): good/warning/serious/critical + un neutro para "Estudios"
 * (no forma parte del pipeline activos->bajas, y puede venir null).
 */
const CARD_ACCENTS: Record<keyof ContratosCards, string> = {
  activos:      '#0ca30c',
  paraFirma:    '#fab219',
  paraTramitar: '#ec835a',
  estudios:     '#a1a1aa',
  bajas:        '#d03b3b',
};

export function buildCardTiles(cards: ContratosCards | null): ContratosCardTile[] {
  const c = cards;
  return [
    { key: 'activos',      label: 'Activos',       icon: ShieldCheckIcon, accent: CARD_ACCENTS.activos,      size: 22, value: c?.activos      ?? null },
    { key: 'paraFirma',    label: 'Para firma',     icon: NoteIcon,        accent: CARD_ACCENTS.paraFirma,    size: 22, value: c?.paraFirma    ?? null },
    { key: 'paraTramitar', label: 'Para tramitar',  icon: FileDownIcon,    accent: CARD_ACCENTS.paraTramitar, size: 21, value: c?.paraTramitar ?? null },
    { key: 'estudios',     label: 'Estudios',       icon: SearchIcon,      accent: CARD_ACCENTS.estudios,     size: 24, value: c?.estudios     ?? null },
    { key: 'bajas',        label: 'Bajas',          icon: XIcon,           accent: CARD_ACCENTS.bajas,        size: 20, value: c?.bajas        ?? null },
  ];
}

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
/** Devuelve true si TODOS los servicios del cliente comparten un mismo estado. */
export function singleEstado(row: ContratoClienteRow): string | null {
  const keys = Object.keys(row.EstadoBreakdown ?? {});
  return keys.length === 1 ? keys[0] : null;
}

export function estadoEntries(row: ContratoClienteRow): { estado: string; count: number }[] {
  const bd = row.EstadoBreakdown ?? {};
  return Object.entries(bd)
    .map(([estado, count]) => ({ estado, count }))
    .sort((a, b) => b.count - a.count);
}

/** Cablea los cellTemplate de las columnas de la tabla de contratos con los ng-template del host. */
export function applyContratosColumnTemplates(
  cols:      TableColumn<ContratoClienteRow>[],
  templates: Record<string, TemplateRef<{ $implicit: ContratoClienteRow }>>,
): TableColumn<ContratoClienteRow>[] {
  return cols.map(col => {
    const tpl = templates[col.key as string];
    return tpl ? { ...col, cellTemplate: tpl } : col;
  });
}

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
