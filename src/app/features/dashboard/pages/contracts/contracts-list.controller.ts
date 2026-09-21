import { computed, signal } from '@angular/core';
import { ContractService } from '../../../../core/services/contract.service';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { ContratoClienteRow } from '../../../../core/models/contrato.model';

export interface ContractsListDeps {
  contractService: ContractService;
  globalLoading:   GlobalLoadingService;
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

  /** Filtros de incidencia. Server-side — dispara reload al cambiar. */
  readonly filterEstado   = signal<string>('');
  readonly filterFaltante = signal<string>('');

  get hasFilters(): boolean { return !!(this.filterEstado() || this.filterFaltante()); }

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

  onFaltanteChange(v: string): void {
    this.filterFaltante.set(v);
    this.currentPage.set(1);
    this.load();
  }

  clearFilters(): void {
    this.filterEstado.set('');
    this.filterFaltante.set('');
    this.currentPage.set(1);
    this.load();
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

  load(): void {
    this.loading.set(true);
    this.deps.globalLoading.start();
    this.deps.contractService.getContratos({
      filter:   this.filter() || undefined,
      offset:   (this.currentPage() - 1) * this.pageSize(),
      limit:    this.pageSize(),
      estado:   this.filterEstado() || undefined,
      faltante: this.filterFaltante() || undefined,
    }).subscribe({
      next: res => {
        this.data.set(res?.data ?? []);
        this.hasMore.set(res?.hasMore ?? false);
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
}
