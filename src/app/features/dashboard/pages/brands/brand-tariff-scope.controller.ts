import { signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AlertService } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import { ProviderService } from '../../../../core/services/provider.service';
import { Provider } from '../../../../core/models/provider.model';
import { BrandProduct, BrandTariff } from '../../../../core/models/brand.model';

export interface BrandTariffScopeCallbacks {
  onSaved: () => void;
}

/**
 * Restricción OPCIONAL por tarifa completa y/o producto puntual, sobre el
 * proveedor "principal" ya asignado (BrandProvidersController) — si la marca
 * no configura nada acá, sigue viendo el catálogo completo de su proveedor.
 * El árbol (GET /provider/providers/{id}) es del proveedor sin filtrar por
 * marca; acá solo se marca cuáles tarifas/productos habilitar. PUT
 * /brand/{id}/tariffs y /products reemplazan cada conjunto completo al
 * guardar (no son incrementales) — se guardan juntos con un solo botón.
 * Extraído de BrandFormDialogComponent para mantenerlo bajo el límite de
 * líneas (R1).
 */
export class BrandTariffScopeController {
  constructor(
    private readonly brandService: BrandService,
    private readonly providerService: ProviderService,
    private readonly alert: AlertService,
  ) {}

  readonly tree            = signal<Provider | null>(null);
  readonly loadingTree     = signal(false);
  readonly enabledTariffs  = signal<Set<number>>(new Set());
  readonly enabledProducts = signal<Set<number>>(new Set());
  readonly saving          = signal(false);

  reset(tariffs: BrandTariff[], products: BrandProduct[]): void {
    this.enabledTariffs.set(new Set(tariffs.map(t => t.tariffId)));
    this.enabledProducts.set(new Set(products.map(p => p.productId)));
    this.tree.set(null);
    this.saving.set(false);
  }

  loadTree(providerId: number): void {
    this.loadingTree.set(true);
    this.providerService.getTree(providerId).subscribe({
      next: tree => { this.tree.set(tree); this.loadingTree.set(false); },
      error: () => { this.tree.set(null); this.loadingTree.set(false); },
    });
  }

  isTariffEnabled(id: number):  boolean { return this.enabledTariffs().has(id); }
  isProductEnabled(id: number): boolean { return this.enabledProducts().has(id); }

  toggleTariff(id: number): void {
    const next = new Set(this.enabledTariffs());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.enabledTariffs.set(next);
  }

  toggleProduct(id: number): void {
    const next = new Set(this.enabledProducts());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.enabledProducts.set(next);
  }

  save(brandId: string, callbacks: BrandTariffScopeCallbacks): void {
    this.saving.set(true);
    const tariffIds  = Array.from(this.enabledTariffs());
    const productIds = Array.from(this.enabledProducts());
    forkJoin([
      this.brandService.updateTariffs(brandId, tariffIds),
      this.brandService.updateProducts(brandId, productIds),
    ]).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.show('Restricciones guardadas.', 'success', 3000);
        callbacks.onSaved();
      },
      error: () => {
        this.saving.set(false);
        this.alert.show('No se pudieron guardar las restricciones.', 'error', 4000);
      },
    });
  }
}
