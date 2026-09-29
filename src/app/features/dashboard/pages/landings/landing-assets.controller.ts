import { computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { LandingService } from '../../../../core/services/landing.service';
import { LandingDetail } from '../../../../core/models/landing.model';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Estado y handlers de las imágenes de una landing (logo + hasta 3 imágenes
 * hero): selección, previsualización y subida. Clase plana sin DI de
 * Angular, instanciada por `LandingFormDialogComponent`.
 */
export class AssetsController {
  readonly logoFile       = signal<File | null>(null);
  readonly logoPreview    = signal<string | null>(null);
  readonly heroImageFiles = signal<File[]>([]);
  readonly heroPreviews   = signal<string[]>([]);

  readonly hasPendingAssets = computed(() => this.logoFile() != null || this.heroImageFiles().length > 0);

  constructor(
    private readonly landingService: LandingService,
    private readonly alert: AlertService,
  ) {}

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

  removeLogoFile(fallbackUrl: string | null): void {
    this.logoFile.set(null);
    this.logoPreview.set(fallbackUrl);
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

  /** Sube las imágenes seleccionadas para una landing recién creada. */
  uploadForCreated(id: string, onSuccess: (detail: LandingDetail) => void, onError: () => void): void {
    this.landingService.uploadAssets(id, this.logoFile(), this.heroImageFiles()).subscribe({
      next: detail => {
        this.logoFile.set(null);
        this.heroImageFiles.set([]);
        onSuccess(detail);
      },
      error: () => onError(),
    });
  }

  /** Sube las imágenes seleccionadas para una landing existente (botón "Guardar imágenes"). */
  save(id: string, onSuccess: (detail: LandingDetail) => void, onError: () => void): void {
    this.landingService.uploadAssets(id, this.logoFile(), this.heroImageFiles()).subscribe({
      next: detail => {
        this.logoPreview.set(detail.logoUrl ?? null);
        this.logoFile.set(null);
        this.heroPreviews.set(detail.heroImageUrls ?? []);
        this.heroImageFiles.set([]);
        onSuccess(detail);
      },
      error: () => onError(),
    });
  }

  reset(): void {
    this.logoFile.set(null);
    this.logoPreview.set(null);
    this.heroImageFiles.set([]);
    this.heroPreviews.set([]);
  }

  populateFromDetail(detail: LandingDetail): void {
    this.logoPreview.set(detail.logoUrl ?? null);
    this.heroPreviews.set(detail.heroImageUrls ?? []);
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
