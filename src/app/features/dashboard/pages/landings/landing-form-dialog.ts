import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
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
import { LandingService } from '../../../../services/landing.service';
import { ProductService, ProductCatalogEntry } from '../../../../services/product.service';
import { LandingDetail, LandingPayload, LandingStats } from '../../../../entities/landing.model';

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
type Section = 'general' | 'images';

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

  readonly section    = signal<Section>('general');
  readonly editingId  = signal<string | null>(null);
  readonly isEdit     = computed(() => !!this.editingId());

  readonly loading    = signal(false);
  readonly saving     = signal(false);
  readonly uploading  = signal(false);

  readonly slug         = signal('');
  readonly name         = signal('');
  readonly productId    = signal<number | null>(null);
  readonly heroTitle    = signal('');
  readonly heroSubtitle = signal('');
  readonly formTitle    = signal('');
  readonly formSubtitle = signal('');
  readonly touched      = signal<Record<string, boolean>>({});

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

  readonly detail = signal<LandingDetail | null>(null);
  readonly stats  = signal<LandingStats | null>(null);

  readonly logoFile        = signal<File | null>(null);
  readonly logoPreview     = signal<string | null>(null);
  readonly heroImageFiles  = signal<File[]>([]);
  readonly heroPreviews    = signal<string[]>([]);

  readonly errors = computed(() => ({
    slug:         !SLUG_REGEX.test(this.slug().trim()) || this.slug().trim().length > 80,
    name:         this.name().trim().length === 0 || this.name().trim().length > 120,
    productId:    this.productId() == null,
    heroTitle:    this.heroTitle().trim().length === 0 || this.heroTitle().trim().length > 200,
    heroSubtitle: this.heroSubtitle().trim().length === 0 || this.heroSubtitle().trim().length > 500,
    formTitle:    this.formTitle().length > 200,
    formSubtitle: this.formSubtitle().length > 500,
  }));

  readonly formValid = computed(() => Object.values(this.errors()).every(v => !v));

  readonly hasPendingAssets = computed(() => this.logoFile() != null || this.heroImageFiles().length > 0);

  readonly copied = signal(false);
  readonly publicUrl = computed(() => {
    const slug = this.detail()?.slug ?? this.slug();
    if (!slug || !isPlatformBrowser(this.platformId)) return `/${slug}`;
    return `${window.location.origin}/${slug}`;
  });

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

  readonly isStep1 = computed(() => this.section() === 'general');
  readonly isStep2 = computed(() => this.section() === 'images');

  readonly step1Errors = computed(() => {
    const e = this.errors() as Record<string, boolean>;
    const step1Fields = ['slug', 'name', 'productId', 'heroTitle', 'heroSubtitle', 'formTitle', 'formSubtitle'];
    return step1Fields.some(f => e[f]);
  });

  readonly saveButtonLabel = computed(() => {
    if (this.uploading()) return 'Subiendo imágenes…';
    if (this.saving())    return 'Guardando…';
    if (this.isEdit())    return 'Guardar cambios';
    return this.hasPendingAssets() ? 'Crear landing y subir imágenes' : 'Crear landing';
  });

  goToStep2(): void {
    const step1Fields = ['slug', 'name', 'productId', 'heroTitle', 'heroSubtitle', 'formTitle', 'formSubtitle'];
    step1Fields.forEach(k => this.markTouched(k));
    if (this.step1Errors()) {
      this.alert.show('Revisa los campos antes de continuar.', 'error', 3500);
      return;
    }
    this.section.set('images');
  }

  goBackToStep1(): void {
    this.section.set('general');
  }

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    effect(() => {
      const isOpen = this.open();
      if (!isOpen) return;
      const id = this.landingId();
      this.reset(id);
      // Cargamos el catálogo PRIMERO para que el <select> tenga sus
      // <option>s renderizados cuando loadDetail asigne el productId.
      // Si los ponemos en paralelo, el detail llega antes y el browser
      // no reconcilia el value cuando las options aparecen después.
      this.loadCatalog(() => {
        if (id) this.loadDetail(id);
      });
    });
  }

  isFieldInvalid(field: string): boolean {
    const e = this.errors() as Record<string, boolean>;
    return !!this.touched()[field] && !!e[field];
  }

  markTouched(field: string): void {
    this.touched.update(t => ({ ...t, [field]: true }));
  }

  setSection(s: Section): void {
    if (s === 'images' && !this.isEdit()) return;
    this.section.set(s);
  }

  close(): void {
    if (this.saving() || this.uploading()) return;
    this.openChange.emit(false);
  }

  onProductChange(value: string): void {
    this.productId.set(value ? Number(value) : null);
    this.markTouched('productId');
  }

  save(): void {
    Object.keys(this.errors()).forEach(k => this.markTouched(k));
    if (!this.formValid()) {
      this.alert.show('Revisa los campos del formulario.', 'error', 3500);
      return;
    }

    const payload: LandingPayload = {
      slug:         this.slug().trim(),
      name:         this.name().trim(),
      productId:    this.productId() as number,
      heroTitle:    this.heroTitle().trim(),
      heroSubtitle: this.heroSubtitle().trim(),
      formTitle:    this.formTitle().trim() || undefined,
      formSubtitle: this.formSubtitle().trim() || undefined,
    };

    this.saving.set(true);
    const id = this.editingId();
    const obs = id ? this.landingService.update(id, payload) : this.landingService.create(payload);
    obs.subscribe({
      next: detail => {
        this.saving.set(false);
        this.detail.set(detail);
        this.editingId.set(detail.id);
        this.saved.emit();

        if (id) {
          this.logoPreview.set(detail.logoUrl ?? null);
          this.heroPreviews.set(detail.heroImageUrls ?? []);
          this.alert.show('Landing actualizada.', 'success', 3000);
          return;
        }

        if (this.hasPendingAssets()) {
          this.uploadAssetsForCreated(detail.id);
        } else {
          this.alert.show('Landing creada.', 'success', 3000);
          this.openChange.emit(false);
        }
      },
      error: err => {
        this.saving.set(false);
        const message = err?.error?.message ?? 'No se pudo guardar la landing.';
        this.alert.show(message, 'error', 4500);
      },
    });
  }

  private uploadAssetsForCreated(id: string): void {
    this.uploading.set(true);
    this.landingService.uploadAssets(id, this.logoFile(), this.heroImageFiles()).subscribe({
      next: detail => {
        this.uploading.set(false);
        this.detail.set(detail);
        this.logoFile.set(null);
        this.heroImageFiles.set([]);
        this.alert.show('Landing creada e imágenes subidas.', 'success', 3500);
        this.saved.emit();
        this.openChange.emit(false);
      },
      error: () => {
        this.uploading.set(false);
        this.alert.show('La landing se creó, pero las imágenes no se subieron. Inténtalo desde edición.', 'error', 5000);
        this.openChange.emit(false);
      },
    });
  }

  onLogoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      this.alert.show('El logo no puede superar 2 MB.', 'error', 3500);
      return;
    }
    this.logoFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.logoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  removeLogoFile(): void {
    this.logoFile.set(null);
    this.logoPreview.set(this.detail()?.logoUrl ?? null);
  }

  onHeroImagesSelected(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    if (files.length > 3) {
      this.alert.show('Máximo 3 imágenes hero.', 'error', 3500);
      return;
    }
    if (files.some(f => f.size > MAX_IMAGE_BYTES)) {
      this.alert.show('Cada imagen debe pesar 2 MB o menos.', 'error', 3500);
      return;
    }
    this.heroImageFiles.set(files);
    Promise.all(files.map(f => this.readAsDataUrl(f))).then(urls => this.heroPreviews.set(urls));
  }

  uploadAssets(): void {
    const id = this.editingId();
    if (!id) return;
    const logo = this.logoFile();
    const heroes = this.heroImageFiles();
    if (!logo && heroes.length === 0) {
      this.alert.show('Selecciona al menos una imagen.', 'error', 3000);
      return;
    }
    this.uploading.set(true);
    this.landingService.uploadAssets(id, logo, heroes).subscribe({
      next: detail => {
        this.uploading.set(false);
        this.detail.set(detail);
        this.logoPreview.set(detail.logoUrl ?? null);
        this.logoFile.set(null);
        this.heroPreviews.set(detail.heroImageUrls ?? []);
        this.heroImageFiles.set([]);
        this.alert.show('Imágenes guardadas.', 'success', 3000);
        this.saved.emit();
      },
      error: () => {
        this.uploading.set(false);
        this.alert.show('No se pudieron subir las imágenes.', 'error', 4000);
      },
    });
  }

  openPublic(): void {
    const slug = this.detail()?.slug ?? this.slug();
    if (!slug || !isPlatformBrowser(this.platformId)) return;
    window.open(`/${slug}`, '_blank');
  }

  private reset(id: string | null): void {
    this.section.set('general');
    this.editingId.set(id);
    this.detail.set(null);
    this.stats.set(null);
    this.slug.set('');
    this.name.set('');
    this.productId.set(null);
    this.heroTitle.set('');
    this.heroSubtitle.set('');
    this.formTitle.set('');
    this.formSubtitle.set('');
    this.touched.set({});
    this.logoFile.set(null);
    this.logoPreview.set(null);
    this.heroImageFiles.set([]);
    this.heroPreviews.set([]);
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

  private loadDetail(id: string): void {
    this.loading.set(true);
    this.landingService.getById(id).subscribe({
      next: detail => {
        this.detail.set(detail);
        this.slug.set(detail.slug);
        this.name.set(detail.name);
        this.productId.set(detail.productId);
        this.heroTitle.set(detail.heroTitle);
        this.heroSubtitle.set(detail.heroSubtitle);
        this.formTitle.set(detail.formTitle ?? '');
        this.formSubtitle.set(detail.formSubtitle ?? '');
        this.logoPreview.set(detail.logoUrl ?? null);
        this.heroPreviews.set(detail.heroImageUrls ?? []);
        this.loading.set(false);
        // Forzamos la sincronización del <select> nativo. Aunque el
        // signal productId esté correcto, el browser no aplica el value
        // a un <select> hasta que sus <option>s están renderizadas.
        setTimeout(() => {
          const sel = this.productSelect()?.nativeElement;
          if (sel && this.productId() != null) {
            sel.value = String(this.productId());
          }
        }, 0);
      },
      error: () => {
        this.loading.set(false);
        this.alert.show('No se pudo cargar la landing.', 'error', 4000);
        this.close();
      },
    });
    this.refreshStats(id);
  }

  private refreshStats(id: string): void {
    this.landingService.getStats(id).subscribe({
      next: s => this.stats.set(s),
    });
  }

  private readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
