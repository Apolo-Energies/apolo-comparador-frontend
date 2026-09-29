import { computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { UserService } from '../../../../core/services/user.service';
import { PotentialParent } from '../../../../core/models/user.model';
import { UserRow } from './user-actions-menu/user-actions-menu.component';

export interface UsersBulkSelectionDeps {
  userService:         UserService;
  alertService:        AlertService;
  getRows:              () => UserRow[];
  getPotentialParents:  () => PotentialParent[];
  /** Called after a successful bulk assignment so the page can reload the table. */
  onAssigned:           () => void;
}

/**
 * Encapsulates bulk row selection and the "assign to" bulk action for the
 * users table. Extracted from UsersPageComponent to keep the page under the
 * file-size guideline (R1).
 */
export class UsersBulkSelectionController {
  constructor(private readonly deps: UsersBulkSelectionDeps) {}

  readonly selectedIds        = signal<ReadonlySet<string>>(new Set());
  readonly selectedCount      = computed(() => this.selectedIds().size);
  readonly hasSelection       = computed(() => this.selectedCount() > 0);
  readonly allCurrentSelected = computed(() => {
    const rows = this.deps.getRows();
    if (rows.length === 0) return false;
    const set = this.selectedIds();
    return rows.every(r => set.has(r.id));
  });

  isRowSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleRow(id: string): void {
    this.selectedIds.update(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  toggleAllInPage(): void {
    const rows = this.deps.getRows();
    this.selectedIds.update(current => {
      const next = new Set(current);
      const everySelected = rows.every(r => next.has(r.id));
      if (everySelected) rows.forEach(r => next.delete(r.id));
      else               rows.forEach(r => next.add(r.id));
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  onBulkComboboxChange(value: string | number): void {
    const raw = String(value ?? '');
    if (!raw) return;
    const parentId = raw === '__unassign__' ? null : raw;
    this.bulkAssignTo(parentId);
  }

  bulkAssignTo(parentId: string | null): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.deps.userService.bulkAssignParent(ids, parentId).subscribe({
      next: () => {
        const label = parentId
          ? this.deps.getPotentialParents().find(p => p.id === parentId)?.fullName ?? 'el seleccionado'
          : 'Sin asignar';
        this.deps.alertService.show(`${ids.length} usuario(s) asignados a ${label}`, 'success');
        this.clearSelection();
        this.deps.onAssigned();
      },
      error: (err) => {
        console.error('[bulk-assign-parent] error', err);
        const serverMsg =
          err?.error?.detail ||
          err?.error?.title ||
          err?.error?.message ||
          (typeof err?.error === 'string' ? err.error : null);
        const msg = serverMsg
          ? `Error ${err.status ?? ''}: ${serverMsg}`.trim()
          : `No se pudo completar la asignación masiva (HTTP ${err?.status ?? '?'})`;
        this.deps.alertService.show(msg, 'error');
      },
    });
  }
}
