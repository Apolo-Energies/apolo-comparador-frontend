import { Injectable, inject, signal } from '@angular/core';
import { OpportunityService } from './opportunity.service';
import { OpportunitySidebarBadges } from '../models/opportunity.model';

// Cache de badges del sidebar; el board publica tras su fetch, el layout llena si falta.
@Injectable({ providedIn: 'root' })
export class OpportunityCountsStore {
  private oppService = inject(OpportunityService);

  readonly badges = signal<OpportunitySidebarBadges | null>(null);
  private fetching = false;

  update(badges: OpportunitySidebarBadges): void {
    this.badges.set(badges);
  }

  ensureLoaded(): void {
    if (this.badges() !== null || this.fetching) return;
    this.fetching = true;
    this.oppService.summary().subscribe({
      next: badges => { this.badges.set(badges); this.fetching = false; },
      error: () => { this.fetching = false; },
    });
  }
}
