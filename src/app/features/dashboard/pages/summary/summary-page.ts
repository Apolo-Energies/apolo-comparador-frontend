import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@apolo-energies/auth';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { ContractService } from '../../../../core/services/contract.service';
import { TramitacionService } from '../../../../core/services/tramitacion.service';
import { EnergyExpertService, AltasBajasPoint, PieSegment, LiquidacionesKpis, InvoicesKpis } from '../../../../core/services/energy-expert.service';
import { OpportunityCountsStore } from '../../../../core/services/opportunity-counts.store';
import { CollaboratorScopeService } from '../../../../core/services/collaborator-scope.service';
import { BrandModulesService } from '../../../../core/services/brand-modules.service';
import { getUserRoles } from '../../../../core/helpers/auth.utils';
import { ContratosCards } from '../../../../core/models/contrato.model';
import { StatCardComponent, StatState } from '../../../../shared/ui/stat-card/stat-card';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header';
import { SectionTitleComponent } from '../../../../shared/ui/section-title/section-title';

/** Estado de un bloque que carga de forma independiente. */
interface Block<T> { state: StatState; data: T | null; }

const CONTRACTS_URL = '/dashboard/contratos/contratos';
/** Paso de eje "redondo" (1, 2, 5 × 10^n) para que las marcas sean legibles. */
function niceStep(raw: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

/**
 * Resumen de la cartera. Solo endpoints existentes, que el backend
 * ya filtra por la delegación del usuario; un bloque que falla no rompe el resto.
 */
@Component({
  selector: 'app-summary-page',
  standalone: true,
  imports: [StatCardComponent, PageHeaderComponent, SectionTitleComponent],
  templateUrl: './summary-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryPage {
  private readonly contracts = inject(ContractService);
  private readonly tramitacion = inject(TramitacionService);
  private readonly ee = inject(EnergyExpertService);
  private readonly counts = inject(OpportunityCountsStore);
  private readonly auth = inject(AuthService);
  private readonly brandModules = inject(BrandModulesService);
  /** "Ver como colaborador" del Master: los contratos siguen la selección, igual que en Contratos. */
  readonly scope = inject(CollaboratorScopeService);

  readonly contractsUrl = CONTRACTS_URL;
  readonly opportunitiesUrl = '/dashboard/analytics/opportunities';

  readonly cards       = signal<Block<ContratosCards>>({ state: 'loading', data: null });
  readonly enTramite   = signal<Block<number>>({ state: 'loading', data: null });
  readonly impagadas   = signal<Block<InvoicesKpis>>({ state: 'loading', data: null });
  readonly liquidaciones = signal<Block<LiquidacionesKpis>>({ state: 'loading', data: null });
  readonly altasBajas  = signal<Block<AltasBajasPoint[]>>({ state: 'loading', data: null });
  readonly porTipo     = signal<Block<PieSegment[]>>({ state: 'loading', data: null });

  /** El Colaborador no tiene Oportunidades de gas: mismo criterio que el menú y el Inicio. */
  private readonly isColaborador = computed(() => {
    const roles = getUserRoles(this.auth.currentUser());
    return (roles.includes('Colaborador') || roles.includes('Colaborador - Referenciador')) && !roles.includes('Master');
  });

  readonly showOportunidades = environment.features.opportunities && this.brandModules.brandAllows('opportunities');
  readonly oportunidadesHint = computed(() => this.isColaborador() ? 'Oportunidades de luz' : 'Luz y gas');

  readonly pendientes = computed(() => {
    const b = this.counts.badges();
    return b ? (b.electricity ?? 0) + (this.isColaborador() ? 0 : (b.gas ?? 0)) : null;
  });

  readonly pendientesState = computed<StatState>(() =>
    this.pendientes() !== null ? 'ok' : this.counts.failed() ? 'error' : 'loading');

  constructor() {
    if (this.showOportunidades) this.counts.ensureLoaded();
    this.loadAll();
    // Recarga los contratos al cambiar el colaborador elegido (la primera carga ya la hace loadAll).
    let first = true;
    effect(() => {
      this.scope.selected();
      if (first) { first = false; return; }
      untracked(() => this.loadCards());
    });
  }

  retryPendientes(): void { this.counts.ensureLoaded(); }

  loadAll(): void {
    this.loadCards(); this.loadTramite(); this.loadImpagadas();
    this.loadLiquidaciones(); this.loadAltasBajas(); this.loadPorTipo();
  }

  loadCards():         void { this.load(this.cards,         this.contracts.getContratosCards(null, this.scope.selected()?.id)); }
  loadTramite():       void { this.load(this.enTramite,     this.tramitacion.getEnTramitacion(), r => r.length); }
  loadImpagadas():     void { this.load(this.impagadas,     this.ee.getInvoicesKpis()); }
  loadLiquidaciones(): void { this.load(this.liquidaciones, this.ee.getLiquidacionesKpis()); }
  loadAltasBajas():    void { this.load(this.altasBajas,    this.ee.getAltasBajas('meses'), r => r.points ?? []); }
  loadPorTipo():       void { this.load(this.porTipo,       this.ee.getServicesKpis(), r => r.contratos?.segments ?? []); }

  /** 403 = el rol no tiene ese dato: el bloque se oculta en vez de mostrar un error. */
  private load<R, T>(target: ReturnType<typeof signal<Block<T>>>, src: Observable<R>, map: (r: R) => T = r => r as unknown as T): void {
    target.set({ state: 'loading', data: null });
    src.subscribe({
      next: r => target.set({ state: 'ok', data: map(r) }),
      error: (e: { status?: number }) => target.set({ state: e?.status === 403 ? 'hidden' : 'error', data: null }),
    });
  }

  // ── Barras agrupadas: altas, bajas y renovaciones por mes (últimos 12 meses) ──
  /** Mes bajo el ratón o con foco (tooltip). */
  readonly hover = signal<number | null>(null);

  /** Renovaciones solo si el backend las da en algún mes (si no, la serie no aparece). */
  readonly hasRenov = computed(() => (this.altasBajas().data ?? []).some(p => (p.renovaciones ?? 0) > 0));

  readonly bars = computed(() => {
    const pts = (this.altasBajas().data ?? []).slice(-12);
    const renov = this.hasRenov();
    const keys: { key: 'altas' | 'bajas' | 'renovaciones'; label: string; color: string }[] = [
      { key: 'altas', label: 'Altas', color: 'var(--series-1)' },
      { key: 'bajas', label: 'Bajas', color: 'var(--series-2)' },
      ...(renov ? [{ key: 'renovaciones' as const, label: 'Renovaciones', color: 'var(--series-3)' }] : []),
    ];
    const rawMax = Math.max(1, ...pts.flatMap(p => keys.map(k => p[k.key] ?? 0)));
    const step = niceStep(rawMax / 4);
    const max = Math.ceil(rawMax / step) * step;
    const W = 600, H = 200, left = 32, slot = (W - left) / Math.max(1, pts.length);
    const group = slot * 0.7, gap = 2, bw = (group - gap * (keys.length - 1)) / keys.length;
    const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => ({ y: H - (i * step / max) * H, label: i * step }));
    return {
      W, H, left, ticks, series: keys, slot,
      items: pts.map((p, i) => {
        const x0 = left + i * slot + (slot - group) / 2;
        return {
          label: p.etiqueta, cx: left + i * slot + slot / 2, x: left + i * slot,
          tip: `${p.etiqueta}: ` + keys.map(k => `${k.label} ${p[k.key] ?? 0}`).join(' · '),
          rects: keys.map((k, j) => {
            const v = p[k.key] ?? 0, h = Math.max(v > 0 ? 2 : 0, (v / max) * H);
            return { key: k.key, label: k.label, color: k.color, value: v, x: x0 + j * (bw + gap), w: bw, h, y: H - h };
          }),
        };
      }),
    };
  });

  /** Totales de los 12 meses para la cabecera del gráfico. */
  readonly totals = computed(() => {
    const pts = (this.altasBajas().data ?? []).slice(-12);
    const sum = (k: 'altas' | 'bajas' | 'renovaciones') => pts.reduce((a, p) => a + (p[k] ?? 0), 0);
    return { altas: sum('altas'), bajas: sum('bajas'), renovaciones: sum('renovaciones'), last: pts.at(-1) ?? null };
  });

  // ── Donut: contratos por tipo (paleta del portal en orden fijo) ─────────────
  readonly donut = computed(() => {
    const segs = (this.porTipo().data ?? []).filter(s => s.value > 0).sort((a, b) => b.value - a.value);
    const total = segs.reduce((a, s) => a + s.value, 0);
    if (!total) return { total: 0, arcs: [] as { d: string; color: string; label: string; pct: number; value: number }[] };
    const R = 84, r = 58, c = 100, pad = segs.length > 1 ? 0.012 : 0;
    let a0 = -Math.PI / 2;
    // Porcentajes por mayor resto: siempre suman 100.
    const raw = segs.map(s => (s.value / total) * 100);
    const pcts = raw.map(Math.floor);
    raw.map((v, i) => ({ i, rest: v - pcts[i] })).sort((a, b) => b.rest - a.rest)
      .slice(0, 100 - pcts.reduce((a, v) => a + v, 0)).forEach(({ i }) => pcts[i]++);
    const arcs = segs.map((s, i) => {
      const frac = s.value / total;
      const span = frac * 2 * Math.PI;
      // El hueco nunca supera un cuarto de la porción: las muy pequeñas no se invierten.
      const gap = Math.min(pad, span / 4);
      const s0 = a0 + gap, s1 = a0 + span - gap - (frac === 1 ? 0.0001 : 0);
      const large = s1 - s0 > Math.PI ? 1 : 0;
      const p = (rad: number, ang: number) => `${(c + rad * Math.cos(ang)).toFixed(2)} ${(c + rad * Math.sin(ang)).toFixed(2)}`;
      const d = `M${p(R, s0)}A${R} ${R} 0 ${large} 1 ${p(R, s1)}L${p(r, s1)}A${r} ${r} 0 ${large} 0 ${p(r, s0)}Z`;
      a0 += span;
      return { d, color: `var(--series-${(i % 8) + 1})`, label: s.label, value: s.value, pct: pcts[i] };
    });
    return { total, arcs };
  });

  eur(n: number | null | undefined): string {
    return n == null ? '—' : n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  }

  fmt(n: number | null | undefined): string {
    return n == null ? '—' : n.toLocaleString('es-ES');
  }
}
