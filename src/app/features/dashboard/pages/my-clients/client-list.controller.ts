import { computed, signal } from '@angular/core';
import { AssignedClientsService } from '../../../../core/services/assigned-clients.service';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';
import { CollaboratorScopeService } from '../../../../core/services/collaborator-scope.service';
import { AssignedClient } from '../../../../core/models/assigned-client.model';

export interface ClientListDeps {
  clientsService:     AssignedClientsService;
  globalLoading:      GlobalLoadingService;
  collaboratorScope:  CollaboratorScopeService;
  /** Called after every load() so the page can refresh dependent state (incidencias). */
  onLoaded: () => void;
}

/**
 * Owns the "Mis clientes" table's filter/pagination state and the call to
 * GET /energy-expert/clientes. Extracted from MyClientsPageComponent to keep
 * the page under the file-size guideline (R1). Same pattern as
 * ContractsListController (contracts-page). No behavior change vs. the
 * inline version.
 */
export class ClientListController {
  constructor(private readonly deps: ClientListDeps) {}

  readonly currentPage = signal(1);
  readonly pageSize    = signal(20);
  readonly loading     = signal(false);
  readonly error       = signal(false);
  readonly data        = signal<AssignedClient[]>([]);
  readonly total       = signal(0);

  readonly totalContracts = signal<number | null>(null);
  readonly totalServices  = signal<number | null>(null);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));

  /** Filtros de incidencia. Server-side — dispara reload al cambiar. */
  readonly filterEstado   = signal<string>('');
  readonly filterFaltante = signal<string>('');

  get hasFilters(): boolean { return !!(this.filterEstado() || this.filterFaltante()); }

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
    this.error.set(false);
    this.deps.globalLoading.start();
    this.deps.clientsService.list({
      page:         this.currentPage(),
      pageSize:     this.pageSize(),
      estado:       this.filterEstado() || undefined,
      faltante:     this.filterFaltante() || undefined,
      targetUserId: this.deps.collaboratorScope.selected()?.id,
    }).subscribe({
      next: res => {
        this.data.set(res?.data ?? []);
        this.total.set(res?.total ?? 0);
        this.totalContracts.set(res?.totalContracts ?? null);
        this.totalServices.set(res?.totalServices ?? null);
        this.loading.set(false);
        this.deps.globalLoading.stop();
      },
      error: () => {
        this.data.set([]);
        this.total.set(0);
        this.totalContracts.set(null);
        this.totalServices.set(null);
        this.error.set(true);
        this.loading.set(false);
        this.deps.globalLoading.stop();
      },
    });

    // Incidencias en paralelo (mismo patrón que Contratos → Luz).
    this.deps.onLoaded();
  }
}
