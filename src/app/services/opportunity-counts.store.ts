import { Injectable, inject, signal } from '@angular/core';
import { OpportunityService } from './opportunity.service';
import { OpportunitySidebarBadges } from '../entities/opportunity.model';

/**
 * Cache compartido de los contadores del sidebar (pendientes Luz/Gas).
 * - El layout llama a ensureLoaded() si aterriza en una página distinta del board.
 * - El board (OpportunitiesBoard) llama a update() con los contadores que ya vienen en la
 *   respuesta del endpoint /opportunities/board, evitando una segunda petición.
 */
@Injectable({ providedIn: 'root' })
export class OpportunityCountsStore {
  private oppService = inject(OpportunityService);

  readonly badges = signal<OpportunitySidebarBadges | null>(null);
  private fetching = false;

  update(badges: OpportunitySidebarBadges): void {
    this.badges.set(badges);
  }

  /** Pide /opportunities/summary sólo si el store está vacío y no hay otra petición en curso. */
  ensureLoaded(): void {
    if (this.badges() !== null || this.fetching) return;
    this.fetching = true;
    this.oppService.summary().subscribe({
      next: badges => { this.badges.set(badges); this.fetching = false; },
      error: () => { this.fetching = false; },
    });
  }
}
