import { computed, signal, WritableSignal } from '@angular/core';
import { EnergyType } from '../../../../core/models/energy-type.enum';
import { OpportunityFilters } from '../../../../core/models/opportunity.model';
import { buildOpportunityFilters } from './opportunities-page.helpers';

/**
 * Owns the opportunities page's filter-bar draft inputs, the "applied"
 * filter snapshot and the active-filters indicator. Extracted from
 * OpportunitiesPageComponent to keep the page under the file-size guideline
 * (R1). No behavior change vs. the inline version — EnergyType always comes
 * from the route, never from the UI.
 */
export class OpportunityFiltersController {
  readonly search    = signal('');
  readonly status    = signal('');
  readonly dateFrom   = signal('');
  readonly dateTo     = signal('');
  readonly userName   = signal('');
  readonly userEmail  = signal('');
  readonly open       = signal(false);

  readonly applied: WritableSignal<OpportunityFilters>;

  constructor(private readonly energyType: EnergyType) {
    this.applied = signal<OpportunityFilters>({ energyType });
  }

  readonly hasActive = computed(() => {
    const f = this.applied();
    return !!(f.searchTerm || f.status !== undefined
           || f.startDate || f.endDate || f.createdByFullName || f.createdByEmail);
  });

  toggle(): void {
    this.open.update(v => !v);
  }

  /** Builds an OpportunityFilters snapshot from the current draft inputs and applies it. */
  apply(): OpportunityFilters {
    const next = buildOpportunityFilters(this.energyType, {
      search:    this.search(),
      status:    this.status(),
      dateFrom:  this.dateFrom(),
      dateTo:    this.dateTo(),
      userName:  this.userName(),
      userEmail: this.userEmail(),
    });
    this.applied.set(next);
    return next;
  }

  /** Resets every draft input and the applied snapshot back to defaults. */
  clear(): OpportunityFilters {
    this.search.set('');
    this.status.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.userName.set('');
    this.userEmail.set('');
    const next: OpportunityFilters = { energyType: this.energyType };
    this.applied.set(next);
    return next;
  }
}
