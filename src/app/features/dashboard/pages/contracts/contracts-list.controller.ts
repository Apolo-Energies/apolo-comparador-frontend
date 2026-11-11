import { computed, signal } from '@angular/core';
import { ContractService } from '../../../../core/services/contract.service';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { CollaboratorScopeService } from '../../../../core/services/collaborator-scope.service';
import { ContratoClienteRow, TipoEnergia } from '../../../../core/models/contrato.model';

export interface ContractsListDeps {
  contractService:   ContractService;
  globalLoading:     GlobalLoadingService;
  collaboratorScope: CollaboratorScopeService;
  /** Called after every load() so the page can refresh dependent state (incidencias). */
  onLoaded: () => void;
}

/**
 * Owns the contracts table's search/filter/pagination state and the call to
 * GET /energy-expert/contratos. Extracted from ContractsPageComponent to keep
 * the page under the file-size guideline (R1). No behavior change vs. the
 * inline version.
 */
export class ContractsListController {
  constructor(private readonly deps: ContractsListDeps) {}

  readonly filter      = signal('');
  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly loading     = signal(false);
  readonly data        = signal<ContratoClienteRow[]>([]);
  readonly hasMore     = signal(false);
  /** Total de filas que cumplen los filtros (todas las páginas). */
  readonly total       = signal(0);

  /** Filtros de incidencia. Server-side — dispara reload al cambiar. */
  readonly filterEstado   = signal<string>('');
  readonly filterFaltante = signal<string>('');

  /** Selector rápido Luz / Gas. '' = todos. Server-side. */
  readonly filterTipo = signal<TipoEnergia | ''>('');

  /** Rango de "Último mov." (yyyy-MM-dd). Server-side. */
  readonly fechaDesde = signal('');
  readonly fechaHasta = signal('');

  get hasFilters(): boolean {
    return !!(this.filterEstado() || this.filterFaltante() || this.fechaDesde() || this.fechaHasta());
  }

  readonly totalPages = computed(() =>
    this.hasMore() ? this.currentPage() + 1 : this.currentPage()
  );
  readonly totalCount = computed(() =>
    this.hasMore()
      ? this.currentPage() * this.pageSize() + 1
      : (this.currentPage() - 1) * this.pageSize() + this.data().length
  );

  onEstadoChange(v: string): void {
    this.filterEstado.set(v);
    this.currentPage.set(1);
    this.load();
  }

  onTipoChange(v: TipoEnergia | ''): void {
    this.filterTipo.set(v);
    this.currentPage.set(1);
    this.load();
  }

  onFaltanteChange(v: string): void {
    this.filterFaltante.set(v);
    this.currentPage.set(1);
    this.load();
  }

  onFechaDesdeChange(v: string): void {
    this.fechaDesde.set(v);
    this.currentPage.set(1);
    this.load();
  }

  onFechaHastaChange(v: string): void {
    this.fechaHasta.set(v);
    this.currentPage.set(1);
    this.load();
  }

  clearFilters(): void {
    this.filterEstado.set('');
    this.filterFaltante.set('');
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.currentPage.set(1);
    this.load();
  }

  /** "Limpiar" de la toolbar: búsqueda, tipo y filtros avanzados. */
  clearAll(): void {
    this.filter.set('');
    this.filterTipo.set('');
    this.clearFilters();
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.load();
  }

  onClear(): void {
    this.filter.set('');
    this.currentPage.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.currentPage.set(1);
    this.load();
  }

  private query() {
    return {
      filter:       this.filter() || undefined,
      offset:       (this.currentPage() - 1) * this.pageSize(),
      limit:        this.pageSize(),
      estado:       this.filterEstado() || undefined,
      faltante:     this.filterFaltante() || undefined,
      tipo:         this.filterTipo() || undefined,
      desde:        this.fechaDesde() || undefined,
      hasta:        this.fechaHasta() || undefined,
      targetUserId: this.deps.collaboratorScope.selected()?.id,
    };
  }

  load(): void {
    this.loading.set(true);
    this.deps.globalLoading.start();
    this.deps.contractService.getContratos(this.query()).subscribe({
      next: res => {
        this.data.set(res?.data ?? []);
        this.hasMore.set(res?.hasMore ?? false);
        this.total.set(res?.total ?? 0);
        this.loading.set(false);
        this.deps.globalLoading.stop();
      },
      error: () => {
        this.loading.set(false);
        this.deps.globalLoading.stop();
      },
    });

    // Incidencias en paralelo (no bloquea la tabla).
    this.deps.onLoaded();
  }

  /** Recarga la página actual en segundo plano, sin skeleton ni loader global (estado de firma en vivo). */
  refreshSilently(): void {
    if (this.loading()) return;
    this.deps.contractService.getContratos(this.query()).subscribe({
      next: res => {
        if (this.loading()) return; // una carga del usuario empezó mientras tanto: manda la suya
        this.data.set(res?.data ?? []);
        this.hasMore.set(res?.hasMore ?? false);
        this.total.set(res?.total ?? 0);
      },
      error: () => {},
    });
  }
}
