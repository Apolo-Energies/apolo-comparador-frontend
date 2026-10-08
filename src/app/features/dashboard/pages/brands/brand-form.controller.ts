import { computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import { BrandSummary } from '../../../../core/models/brand.model';
import { slugify, sanitizeSlugChars } from '../../../../core/helpers/slug.utils';
import { BrandImagesController } from './brand-images.controller';
import { BrandModulesController } from './brand-modules.controller';
import { BrandUserController } from './brand-user.controller';
import { BrandProvidersController } from './brand-providers.controller';
import { BrandTariffScopeController } from './brand-tariff-scope.controller';
import { BrandFormCallbacks } from './brand-form-callbacks';

export type BrandFormSection = 'images' | 'modules' | 'user' | 'providers';

/**
 * Estado y handlers del modal de marcas blancas: alta (nombre + slug) y,
 * una vez creada/seleccionada, edición de imágenes y módulos. Colores vive
 * en su propia página (BrandEditPageComponent) por el preview en vivo.
 * Compone `BrandImagesController`/`BrandModulesController` para poblarlos
 * al abrir. Clase plana sin DI de Angular, instanciada por
 * `BrandFormDialogComponent`.
 */
export class BrandFormController {
  // ── Alta ──────────────────────────────────────────────────────────────
  readonly name     = signal('');
  readonly slug     = signal('');
  readonly touched  = signal<Record<string, boolean>>({});
  readonly creating = signal(false);

  /** Mientras no se toque el slug a mano, se autogenera a partir del nombre. */
  private slugManuallyEdited = false;

  readonly slugValid   = computed(() => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(this.slug()));
  readonly nameValid   = computed(() => this.name().trim().length > 0);
  readonly createValid = computed(() => this.nameValid() && this.slugValid());

  // ── Marca activa (recién creada o pasada desde la lista) ─────────────────
  readonly brandId   = signal<string | null>(null);
  readonly brandSlug = signal<string | null>(null);
  readonly brandName = signal<string | null>(null);
  readonly isEdit    = computed(() => this.brandId() !== null);

  readonly section = signal<BrandFormSection>('images');
  readonly loading = signal(false);

  constructor(
    private readonly brandService: BrandService,
    private readonly alert: AlertService,
    private readonly images: BrandImagesController,
    private readonly modules: BrandModulesController,
    private readonly user: BrandUserController,
    private readonly providers: BrandProvidersController,
    private readonly tariffScope: BrandTariffScopeController,
  ) {}

  reset(existing: BrandSummary | null): void {
    this.name.set('');
    this.slug.set('');
    this.touched.set({});
    this.creating.set(false);
    this.slugManuallyEdited = false;
    this.section.set('images');
    this.loading.set(false);
    this.images.reset([]);
    this.modules.reset([]);
    this.user.reset();
    this.providers.loadCatalog();
    this.tariffScope.reset([], []);

    if (existing) {
      this.brandId.set(existing.id);
      this.brandSlug.set(existing.slug);
      this.brandName.set(existing.name);
      this.loadConfig(existing.slug);
      this.user.load(existing.id);
    } else {
      this.providers.reset([]);
      this.brandId.set(null);
      this.brandSlug.set(null);
      this.brandName.set(null);
    }
  }

  /** El slug se autogenera del nombre hasta que el usuario lo edite a mano. */
  setName(value: string): void {
    this.name.set(value);
    if (!this.slugManuallyEdited) this.slug.set(slugify(value));
  }

  setSlug(value: string): void {
    this.slugManuallyEdited = true;
    this.slug.set(sanitizeSlugChars(value));
  }

  markTouched(field: string): void {
    this.touched.update(t => ({ ...t, [field]: true }));
  }

  isFieldInvalid(field: string): boolean {
    if (!this.touched()[field]) return false;
    if (field === 'name') return !this.nameValid();
    if (field === 'slug') return !this.slugValid();
    return false;
  }

  loadConfig(slug: string): void {
    this.loading.set(true);
    this.brandService.getConfig(slug).subscribe({
      next: config => {
        this.loading.set(false);
        this.images.reset(config.images);
        this.modules.reset(config.modules);
        const providers = [...(config.providers ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
        this.providers.reset(providers);
        this.tariffScope.reset(config.tariffs ?? [], config.products ?? []);
        if (providers[0]) this.tariffScope.loadTree(providers[0].providerId);
      },
      error: () => {
        this.loading.set(false);
        this.alert.show('No se pudo cargar la configuración de la marca.', 'error', 4000);
      },
    });
  }

  create(callbacks: BrandFormCallbacks): void {
    this.touched.set({ name: true, slug: true });
    if (!this.createValid()) {
      this.alert.show('Revisa el nombre y el slug.', 'error', 3500);
      return;
    }
    this.creating.set(true);
    this.brandService.create({ name: this.name().trim(), slug: this.slug() }).subscribe({
      next: res => {
        this.creating.set(false);
        this.brandId.set(res.id);
        this.brandSlug.set(res.slug);
        this.brandName.set(res.name);
        this.alert.show('Marca creada. Ahora configura imágenes y módulos.', 'success', 3500);
        callbacks.onSaved();
      },
      error: err => {
        this.creating.set(false);
        const message = err?.status === 409 ? 'Ya existe una marca con ese slug.' : 'No se pudo crear la marca.';
        this.alert.show(message, 'error', 4000);
      },
    });
  }

  setSection(section: BrandFormSection): void {
    this.section.set(section);
  }
}
