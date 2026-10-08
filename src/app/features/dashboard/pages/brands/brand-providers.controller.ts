import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import { ProviderService, ProviderRow } from '../../../../core/services/provider.service';
import { BrandProvider } from '../../../../core/models/brand.model';

export interface BrandProvidersCallbacks {
  onSaved: () => void;
}

/**
 * Qué proveedor(es) ve la marca al llamar /provider/tariffs — el de menor
 * sortOrder es el "principal", el que usan hoy las pantallas de un solo
 * proveedor. PUT /brand/{id}/providers reemplaza el conjunto completo, no es
 * incremental: siempre se manda la lista entera. En la práctica alcanza con
 * un selector simple + "agregar otro" (así lo pidió backend), sin drag —
 * reordenar es con los botones ↑/↓, que renumeran sortOrder según la
 * posición final. Extraído de BrandEditPageComponent para mantenerlo bajo el
 * límite de líneas (R1).
 */
export class BrandProvidersController {
  constructor(
    private readonly brandService: BrandService,
    private readonly providerService: ProviderService,
    private readonly alert: AlertService,
  ) {}

  readonly catalog  = signal<ProviderRow[]>([]);
  readonly selected = signal<BrandProvider[]>([]);
  readonly saving   = signal(false);

  loadCatalog(): void {
    this.providerService.getAll().subscribe({
      next: rows => this.catalog.set(rows),
      error: () => {},
    });
  }

  reset(providers: BrandProvider[]): void {
    this.selected.set([...providers].sort((a, b) => a.sortOrder - b.sortOrder));
    this.saving.set(false);
  }

  addRow(): void {
    const used = new Set(this.selected().map(p => p.providerId));
    const next = this.catalog().find(p => !used.has(p.id)) ?? this.catalog()[0];
    if (!next) return;
    this.selected.update(list => [...list, { providerId: next.id, providerName: next.name, sortOrder: list.length }]);
  }

  removeRow(index: number): void {
    this.selected.update(list => list.filter((_, i) => i !== index).map((p, i) => ({ ...p, sortOrder: i })));
  }

  setProviderId(index: number, providerId: number): void {
    const name = this.catalog().find(p => p.id === providerId)?.name;
    this.selected.update(list => list.map((p, i) => i === index ? { ...p, providerId, providerName: name } : p));
  }

  moveUp(index: number): void {
    if (index <= 0) return;
    this.selected.update(list => {
      const next = [...list];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((p, i) => ({ ...p, sortOrder: i }));
    });
  }

  moveDown(index: number): void {
    this.selected.update(list => {
      if (index >= list.length - 1) return list;
      const next = [...list];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next.map((p, i) => ({ ...p, sortOrder: i }));
    });
  }

  save(brandId: string, callbacks: BrandProvidersCallbacks): void {
    this.saving.set(true);
    const payload = this.selected().map(({ providerId, sortOrder }) => ({ providerId, sortOrder }));
    this.brandService.updateProviders(brandId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.show('Proveedores guardados.', 'success', 3000);
        callbacks.onSaved();
      },
      error: err => {
        this.saving.set(false);
        const message = err?.status === 404 ? 'Alguno de los proveedores elegidos no existe.' : 'No se pudieron guardar los proveedores.';
        this.alert.show(message, 'error', 4000);
      },
    });
  }
}
