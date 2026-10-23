import { signal } from '@angular/core';
import { EnergyExpertCatalogsService } from '../../../../../../core/services/energy-expert-catalogs.service';
import { EnergyExpertCatalogs } from '../../../../../../core/models/energy-expert-catalogs.model';
import { AutoconsumoFormValue } from './autoconsumo-form/autoconsumo-form.helpers';

/**
 * Pide GET /energy-expert/catalogs la primera vez que el colaborador activa
 * el switch "Autoconsumo" en select-product (no en cada carga de la página).
 * Extraído de SelectProductPage para mantenerlo bajo el límite de líneas (R1).
 */
export class AutoconsumoController {
  constructor(private readonly catalogsService: EnergyExpertCatalogsService) {}

  readonly catalogs   = signal<EnergyExpertCatalogs | null>(null);
  readonly formValue  = signal<AutoconsumoFormValue | null>(null);

  maybeLoadCatalogs(): void {
    if (this.catalogs()) return;
    this.catalogsService.getCatalogs().subscribe({
      next: catalogs => {
        this.catalogs.set(catalogs);
        console.log('[Autoconsumo] catálogos EE:', catalogs);
      },
      error: err => console.error('[Autoconsumo] error al pedir catálogos EE:', err),
    });
  }

  // TODO: todavía no hay endpoint de backend para enviar estos datos — por
  // ahora solo se guardan localmente hasta que se defina el contrato.
  setFormValue(value: AutoconsumoFormValue): void {
    this.formValue.set(value);
    console.log('[Autoconsumo] datos del formulario:', value);
  }
}
