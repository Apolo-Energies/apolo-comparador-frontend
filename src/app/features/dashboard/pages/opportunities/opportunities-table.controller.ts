import { ChangeDetectorRef, computed, signal } from '@angular/core';
import { OpportunityFilters, OpportunitySummary } from '../../../../core/models/opportunity.model';
import { OpportunityService } from '../../../../core/services/opportunity.service';
import { GlobalLoadingService } from '../../../../core/services/global-loading.service';

export interface OpportunitiesTableDeps {
  oppService:    OpportunityService;
  globalLoading: GlobalLoadingService;
  cdr:           ChangeDetectorRef;
  /** Current applied filters, read fresh on every load() call. */
  getFilters: () => OpportunityFilters;
}

/**
 * Owns the "table" view mode's pagination state and the call to
 * OpportunityService.list(). Extracted from OpportunitiesPageComponent to
 * keep the page under the file-size guideline (R1). No behavior change vs.
 * the inline version.
 */
export class OpportunitiesTableController {
  constructor(private readonly deps: OpportunitiesTableDeps) {}

  readonly currentPage = signal(1);
  readonly pageSize    = signal(10);
  readonly totalCount  = signal(0);
  readonly loading     = signal(false);
  readonly data        = signal<OpportunitySummary[]>([]);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / this.pageSize())));

  load(): void {
    this.loading.set(true);
    this.deps.globalLoading.start();
    this.deps.oppService.list({
      ...this.deps.getFilters(),
      page:     this.currentPage(),
      pageSize: this.pageSize(),
    }).subscribe({
      next: res => {
        this.data.set(res.items);
        this.totalCount.set(res.totalCount);
        this.loading.set(false);
        this.deps.globalLoading.stop();
        this.deps.cdr.markForCheck();
      },
      error: () => {
        this.loading.set(false);
        this.deps.globalLoading.stop();
      },
    });
  }

  /** Resets to page 1 and reloads — used when a search/clear-filters is triggered from table view. */
  reload(): void {
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
}
