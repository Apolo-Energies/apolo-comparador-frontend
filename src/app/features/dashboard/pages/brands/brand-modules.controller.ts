import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import { BrandModule, BRAND_MODULE_DEFS } from '../../../../core/models/brand.model';
import { BrandFormCallbacks } from './brand-form-callbacks';

/**
 * Estado y handlers de los módulos habilitados de una marca: switches sobre
 * el catálogo fijo BRAND_MODULE_DEFS y guardado (reemplaza todo el set).
 * Clase plana sin DI de Angular, instanciada por `BrandEditPageComponent`.
 */
export class BrandModulesController {
  readonly modules = signal<BrandModule[]>(this.defaults());
  readonly saving  = signal(false);

  constructor(
    private readonly brandService: BrandService,
    private readonly alert: AlertService,
  ) {}

  reset(existing: BrandModule[]): void {
    const byCode = new Map(existing.map(m => [m.code, m.isEnabled]));
    // Mantiene el catálogo conocido siempre visible aunque el backend no lo tenga
    // guardado todavía, y agrega al final cualquier código adicional ya configurado.
    const known = BRAND_MODULE_DEFS.map(def => ({ code: def.code, isEnabled: byCode.get(def.code) ?? false }));
    const extra = existing.filter(m => !BRAND_MODULE_DEFS.some(def => def.code === m.code));
    this.modules.set([...known, ...extra]);
    this.saving.set(false);
  }

  toggle(code: string): void {
    this.modules.update(list => list.map(m => (m.code === code ? { ...m, isEnabled: !m.isEnabled } : m)));
  }

  save(brandId: string, callbacks: BrandFormCallbacks): void {
    this.saving.set(true);
    this.brandService.updateModules(brandId, this.modules()).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.show('Módulos guardados.', 'success', 3000);
        callbacks.onSaved();
      },
      error: () => {
        this.saving.set(false);
        this.alert.show('No se pudieron guardar los módulos.', 'error', 4000);
      },
    });
  }

  private defaults(): BrandModule[] {
    return BRAND_MODULE_DEFS.map(def => ({ code: def.code, isEnabled: false }));
  }
}
