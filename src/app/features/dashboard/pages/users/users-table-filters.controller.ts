import { signal } from '@angular/core';

/**
 * Encapsulates the per-column header-filter UI state (open/close, values,
 * input/change handlers) for the users table. Extracted from
 * UsersPageComponent to keep the page under the file-size guideline (R1).
 * No Angular DI here: the page owns the instance and passes a callback that
 * resets pagination and reloads data.
 */
export class UsersTableFiltersController {
  constructor(private readonly search: () => void) {}

  readonly filterName           = signal('');
  readonly filterEmail          = signal('');
  readonly filterRole           = signal('');
  readonly filterParentUserId   = signal('');
  readonly filterIdentifier     = signal('');
  readonly filterPhone          = signal('');
  readonly filterCommissionName = signal('');

  readonly openFilter = signal<string | null>(null);

  /** Query params consumed by UsersPageComponent.load(). */
  getQueryParams() {
    return {
      fullName:       this.filterName()           || undefined,
      email:          this.filterEmail()          || undefined,
      role:           this.filterRole()           || undefined,
      parentUserId:   this.filterParentUserId()   || undefined,
      identifier:     this.filterIdentifier()     || undefined,
      phone:          this.filterPhone()          || undefined,
      commissionName: this.filterCommissionName() || undefined,
    };
  }

  onDocumentClick(): void {
    this.openFilter.set(null);
  }

  toggleFilter(col: string, e: MouseEvent): void {
    e.stopPropagation();
    const next = this.openFilter() === col ? null : col;
    this.openFilter.set(next);
    if (next) {
      setTimeout(() => {
        (document.querySelector(`[data-col-filter="${col}"]`) as HTMLElement | null)?.focus();
      }, 30);
    }
  }

  closeFilter(): void {
    this.openFilter.set(null);
  }

  clearFilter(col: 'name' | 'email' | 'role' | 'parent' | 'identifier' | 'phone' | 'commission'): void {
    if (col === 'name')       this.filterName.set('');
    if (col === 'email')      this.filterEmail.set('');
    if (col === 'role')       this.filterRole.set('');
    if (col === 'parent')     this.filterParentUserId.set('');
    if (col === 'identifier') this.filterIdentifier.set('');
    if (col === 'phone')      this.filterPhone.set('');
    if (col === 'commission') this.filterCommissionName.set('');
    this.openFilter.set(null);
    this.search();
  }

  applyFilter(): void {
    this.openFilter.set(null);
    this.search();
  }

  onHeaderNameInput(e: Event): void {
    this.filterName.set((e.target as HTMLInputElement).value);
  }

  onHeaderEmailInput(e: Event): void {
    this.filterEmail.set((e.target as HTMLInputElement).value);
  }

  onHeaderRoleChange(e: Event): void {
    this.filterRole.set((e.target as HTMLSelectElement).value);
    this.openFilter.set(null);
    this.search();
  }

  onHeaderParentChange(e: Event): void {
    this.filterParentUserId.set((e.target as HTMLSelectElement).value);
    this.openFilter.set(null);
    this.search();
  }

  onHeaderIdentifierInput(e: Event): void {
    this.filterIdentifier.set((e.target as HTMLInputElement).value);
  }

  onHeaderPhoneInput(e: Event): void {
    this.filterPhone.set((e.target as HTMLInputElement).value);
  }

  onHeaderCommissionChange(e: Event): void {
    this.filterCommissionName.set((e.target as HTMLSelectElement).value);
    this.openFilter.set(null);
    this.search();
  }

  onSearch(): void {
    this.search();
  }

  onClearFilters(): void {
    this.filterName.set('');
    this.filterEmail.set('');
    this.filterRole.set('');
    this.filterParentUserId.set('');
    this.filterIdentifier.set('');
    this.filterPhone.set('');
    this.filterCommissionName.set('');
    this.search();
  }
}
