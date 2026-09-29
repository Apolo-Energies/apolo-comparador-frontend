import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  Signal,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AlertService, ButtonComponent, DialogComponent, InputFieldComponent } from '@apolo-energies/ui';
import { LandingService } from '../../../../core/services/landing.service';
import { ProductService, ProductCatalogEntry } from '../../../../core/services/product.service';
import { FormController } from './landing-form.controller';
import { AssetsController } from './landing-assets.controller';
import { LandingDataController } from './landing-data.controller';

interface ProductGroup {
  providerName: string;
  options: { value: number; label: string }[];
}

@Component({
  selector: 'app-landing-form-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, InputFieldComponent],
  templateUrl: './landing-form-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingFormDialogComponent {
  readonly open       = input(false);
  readonly landingId  = input<string | null>(null);

  readonly openChange = output<boolean>();
  readonly saved      = output<void>();

  private readonly landingService = inject(LandingService);
  private readonly productService = inject(ProductService);
  private readonly alert          = inject(AlertService);
  private readonly platformId     = inject(PLATFORM_ID);

  // ── controllers: formulario, imágenes y carga/guardado de la landing ──────
  private readonly form: FormController = new FormController(this.alert, { isEdit: () => this.isEdit() });
  private readonly assets = new AssetsController(this.landingService, this.alert);
  private readonly data   = new LandingDataController(this.landingService, this.alert, this.form, this.assets);

  // Signals expuestos por referencia directa (mismo objeto) para no tocar el .html existente.
  readonly editingId = this.data.editingId;
  readonly isEdit: Signal<boolean> = this.data.isEdit;
  readonly detail    = this.data.detail;
  readonly stats     = this.data.stats;
  readonly loading   = this.data.loading;
  readonly saving    = this.data.saving;
  readonly uploading = this.data.uploading;

  readonly section      = this.form.section;
  readonly slug         = this.form.slug;
  readonly name         = this.form.name;
  readonly heroTitle    = this.form.heroTitle;
  readonly heroSubtitle = this.form.heroSubtitle;
  readonly formTitle    = this.form.formTitle;
  readonly formSubtitle = this.form.formSubtitle;
  readonly touched      = this.form.touched;
  readonly productId    = this.form.productId;

  readonly isStep1     = this.form.isStep1;
  readonly isStep2     = this.form.isStep2;
  readonly formValid   = this.form.formValid;

  readonly logoFile         = this.assets.logoFile;
  readonly logoPreview      = this.assets.logoPreview;
  readonly heroImageFiles   = this.assets.heroImageFiles;
  readonly heroPreviews     = this.assets.heroPreviews;
  readonly hasPendingAssets = this.assets.hasPendingAssets;

  readonly catalog = signal<ProductCatalogEntry[]>([]);
  private readonly productSelect = viewChild<ElementRef<HTMLSelectElement>>('productSelect');

  readonly productGroups = computed<ProductGroup[]>(() => {
    const selected = this.productId();
    const grouped = new Map<string, ProductGroup>();
    for (const p of this.catalog()) {
      // Filtramos los no disponibles, salvo que sea el ya seleccionado
      // (al editar una landing con un producto que ahora está oculto).
      if (!p.isAvailable && p.id !== selected) continue;
      const key = p.providerName;
      let g = grouped.get(key);
      if (!g) {
        g = { providerName: key, options: [] };
        grouped.set(key, g);
      }
      const suffix = p.isAvailable ? '' : ' (no disponible)';
      g.options.push({ value: p.id, label: `${p.tariffCode} · ${p.name}${suffix}` });
    }
    return Array.from(grouped.values());
  });

  readonly selectedProduct = computed<ProductCatalogEntry | null>(() => {
    const id = this.productId();
    return id == null ? null : this.catalog().find(p => p.id === id) ?? null;
  });

  readonly copied = signal(false);
  readonly publicUrl = computed(() => {
    const slug = this.detail()?.slug ?? this.slug();
    if (!slug || !isPlatformBrowser(this.platformId)) return `/${slug}`;
    return `${window.location.origin}/${slug}`;
  });

  readonly saveButtonLabel = computed(() => {
    if (this.uploading()) return 'Subiendo imágenes…';
    if (this.saving())    return 'Guardando…';
    if (this.isEdit())    return 'Guardar cambios';
    return this.hasPendingAssets() ? 'Crear landing y subir imágenes' : 'Crear landing';
  });

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    effect(() => {
      const isOpen = this.open();
      if (!isOpen) return;
      const id = this.landingId();
      this.data.reset(id);
      // Cargamos el catálogo PRIMERO para que el <select> tenga sus
      // <option>s renderizados cuando loadDetail asigne el productId.
      // Si los ponemos en paralelo, el detail llega antes y el browser
      // no reconcilia el value cuando las options aparecen después.
      this.loadCatalog(() => {
        if (id) this.data.loadDetail(id, () => this.syncProductSelect(), () => this.close());
      });
    });
  }

  isFieldInvalid(field: string): boolean { return this.form.isFieldInvalid(field); }
  markTouched(field: string): void { this.form.markTouched(field); }
  setSection(s: 'general' | 'images'): void { this.form.setSection(s); }
  onProductChange(value: string): void { this.form.onProductChange(value); }
  goToStep2(): void { this.form.goToStep2(); }
  goBackToStep1(): void { this.form.goBackToStep1(); }

  onLogoSelected(event: Event): void { this.assets.onLogoSelected(event); }
  onHeroImagesSelected(event: Event): void { this.assets.onHeroImagesSelected(event); }
  removeLogoFile(): void { this.assets.removeLogoFile(this.detail()?.logoUrl ?? null); }

  close(): void {
    if (this.saving() || this.uploading()) return;
    this.openChange.emit(false);
  }

  save(): void {
    this.data.save({ onSaved: () => this.saved.emit(), onClose: () => this.openChange.emit(false) });
  }

  uploadAssets(): void {
    this.data.uploadAssets({ onSaved: () => this.saved.emit(), onClose: () => this.openChange.emit(false) });
  }

  copyPublicUrl(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = this.publicUrl();
    navigator.clipboard?.writeText(url).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    }).catch(() => {
      this.alert.show('No se pudo copiar al portapapeles.', 'error', 3000);
    });
  }

  openPublic(): void {
    const slug = this.detail()?.slug ?? this.slug();
    if (!slug || !isPlatformBrowser(this.platformId)) return;
    window.open(`/${slug}`, '_blank');
  }

  private loadCatalog(then?: () => void): void {
    if (this.catalog().length > 0) {
      then?.();
      return;
    }
    this.productService.getCatalog().subscribe({
      next: list => {
        this.catalog.set(list);
        then?.();
      },
      error: () => then?.(),
    });
  }

  /**
   * Fuerza la sincronización del <select> nativo. Aunque el signal
   * productId esté correcto, el browser no aplica el value a un <select>
   * hasta que sus <option>s están renderizadas.
   */
  private syncProductSelect(): void {
    setTimeout(() => {
      const sel = this.productSelect()?.nativeElement;
      if (sel && this.productId() != null) {
        sel.value = String(this.productId());
      }
    }, 0);
  }
}
