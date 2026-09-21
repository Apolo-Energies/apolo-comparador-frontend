import { signal, WritableSignal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { RatesService } from '../../../../../../core/services/rates.service';
import { ProductRow } from './products-tab.helpers';

export interface ProductStatusDeps {
  ratesService:         RatesService;
  alertService:         AlertService;
  savingIds:            WritableSignal<Set<number>>;
  removeRow:            (id: number) => void;
  patchRowAvailability: (id: number, isAvailable: boolean) => void;
}

/**
 * Owns the delete-confirmation and availability-toggle-confirmation dialogs
 * for a product row. Extracted from ProductsTabComponent to keep it under
 * the file-size guideline (R1). No behavior change vs. the inline version.
 * Shares the `savingIds` signal with the edit controller so a row cannot be
 * deleted/toggled while another mutation on it is in flight.
 */
export class ProductStatusController {
  constructor(private readonly deps: ProductStatusDeps) {}

  // ── Delete ─────────────────────────────────────────────────────
  readonly deleteDialog = signal(false);
  readonly deleteRow    = signal<ProductRow | null>(null);

  requestDelete(row: ProductRow) {
    this.deleteRow.set(row);
    this.deleteDialog.set(true);
  }

  deleteProduct(row: ProductRow) {
    if (this.deps.savingIds().has(row.id)) return;
    this.deps.savingIds.update(s => new Set(s).add(row.id));
    this.deps.ratesService.deleteProduct(row.id).subscribe({
      next: () => {
        this.deps.removeRow(row.id);
        this.deleteDialog.set(false);
        this.deps.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });
        this.deps.alertService.show('Producto eliminado', 'success');
      },
      error: () => {
        this.deps.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });
        this.deps.alertService.show('Error al eliminar el producto', 'error');
      },
    });
  }

  // ── Toggle availability ────────────────────────────────────────
  readonly confirmDialog    = signal(false);
  readonly pendingToggleRow = signal<ProductRow | null>(null);

  requestToggle(row: ProductRow) {
    this.pendingToggleRow.set(row);
    this.confirmDialog.set(true);
  }

  confirmToggle(row: ProductRow) {
    if (this.deps.savingIds().has(row.id)) return;
    const isAvailable = !row.isAvailable;
    this.deps.savingIds.update(s => new Set(s).add(row.id));
    this.deps.ratesService.patchAvailability(row.id, isAvailable).subscribe({
      next: () => {
        this.deps.patchRowAvailability(row.id, isAvailable);
        this.confirmDialog.set(false);
        this.deps.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });
        this.deps.alertService.show(isAvailable ? 'Producto activado' : 'Producto desactivado', 'success');
      },
      error: () => {
        this.deps.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });
        this.deps.alertService.show('Error al cambiar la disponibilidad', 'error');
      },
    });
  }
}
