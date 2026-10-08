import { computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import { BrandImage } from '../../../../core/models/brand.model';

export interface BrandLogoSelectorCallbacks {
  onSaved: () => void;
}

/**
 * Selector explícito de qué imagen subida usar como "logo del header" y cuál
 * como "logo para fondo claro" — reemplaza la asunción automática por `kind`,
 * que fallaba cuando había más de una imagen con el mismo kind (caso real:
 * Vibra con 2 imágenes `kind: "logo"`). El preview en vivo ya acepta cualquier
 * objectKey sin mirar su kind; solo al guardar hay que corregir el kind de
 * cada imagen según lo elegido (y degradar a "gallery" la que perdió su rol,
 * para no dejar kinds duplicados). Extraído de BrandEditPageComponent para
 * mantenerlo bajo el límite de líneas (R1).
 */
export class BrandLogoSelectorController {
  constructor(
    private readonly brandService: BrandService,
    private readonly alert: AlertService,
  ) {}

  private readonly images = signal<BrandImage[]>([]);
  readonly logoKey          = signal<string | null>(null);
  readonly logoSecondaryKey = signal<string | null>(null);
  readonly saving           = signal(false);

  /** Todas las imágenes con archivo subido — el admin puede usar cualquiera (incluida gallery) como logo. */
  readonly selectable = computed(() => this.images().filter(img => img.objectKey && img.url));

  reset(images: BrandImage[]): void {
    this.images.set(images);
    this.logoKey.set(images.find(i => i.kind === 'logo')?.objectKey ?? null);
    this.logoSecondaryKey.set(images.find(i => i.kind === 'logo_secondary')?.objectKey ?? null);
    this.saving.set(false);
  }

  selectLogo(objectKey: string): void {
    this.logoKey.set(this.logoKey() === objectKey ? null : objectKey);
  }

  selectLogoSecondary(objectKey: string): void {
    this.logoSecondaryKey.set(this.logoSecondaryKey() === objectKey ? null : objectKey);
  }

  save(brandId: string, callbacks: BrandLogoSelectorCallbacks): void {
    this.saving.set(true);
    const logoKey      = this.logoKey();
    const secondaryKey = this.logoSecondaryKey();

    const resolveKind = (img: BrandImage): string => {
      if (img.objectKey === logoKey)      return 'logo';
      if (img.objectKey === secondaryKey) return 'logo_secondary';
      // Perdió su rol de logo — se degrada a gallery para no dejar duplicados.
      if (img.kind === 'logo' || img.kind === 'logo_secondary') return 'gallery';
      return img.kind;
    };

    // Guarda localmente con url (para seguir mostrando las miniaturas) — el PUT
    // en sí solo manda kind/objectKey/sortOrder (url es de solo lectura, la
    // devuelve el GET, no se guarda).
    const updated = this.images().map(img => ({ ...img, kind: resolveKind(img) }));
    const payload: BrandImage[] = updated.map(({ kind, objectKey, sortOrder }) => ({ kind, objectKey, sortOrder }));

    this.brandService.updateImages(brandId, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.images.set(updated);
        this.alert.show('Logos guardados.', 'success', 3000);
        callbacks.onSaved();
      },
      error: () => {
        this.saving.set(false);
        this.alert.show('No se pudieron guardar los logos.', 'error', 4000);
      },
    });
  }
}
