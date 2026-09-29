import { signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { BrandService } from '../../../../core/services/brand.service';
import { BrandPreviewPdfRequest } from '../../../../core/models/brand.model';

const DEBOUNCE_MS = 500;

/**
 * Vista previa en vivo del PDF (POST /brand/{id}/preview-pdf, no toca la
 * BD): debounce de ~500ms tras cada cambio en el formulario, blob URL para
 * el <iframe>, con revoke() del objeto anterior antes de crear el nuevo.
 * Clase plana sin DI de Angular, instanciada por `BrandEditPageComponent`.
 */
export class BrandPreviewController {
  readonly url     = signal<SafeResourceUrl | null>(null);
  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  private brandId: string | null = null;
  private timer?: ReturnType<typeof setTimeout>;
  private rawUrl?: string;

  constructor(
    private readonly brandService: BrandService,
    private readonly sanitizer: DomSanitizer,
  ) {}

  reset(brandId: string | null): void {
    this.clearTimer();
    this.brandId = brandId;
    this.revokeUrl();
    this.url.set(null);
    this.error.set(null);
    this.loading.set(false);
  }

  /** Programa una regeneración del preview con debounce; cancela la anterior si aún no corrió. */
  schedule(getPayload: () => BrandPreviewPdfRequest): void {
    if (!this.brandId) return;
    this.clearTimer();
    this.timer = setTimeout(() => this.run(getPayload()), DEBOUNCE_MS);
  }

  /** Genera el preview inmediatamente, sin esperar el debounce (ej. carga inicial). */
  runNow(getPayload: () => BrandPreviewPdfRequest): void {
    this.clearTimer();
    this.run(getPayload());
  }

  private run(payload: BrandPreviewPdfRequest): void {
    const id = this.brandId;
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.brandService.previewPdf(id, payload).subscribe({
      next: blob => {
        this.loading.set(false);
        this.revokeUrl();
        this.rawUrl = URL.createObjectURL(blob);
        this.url.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.rawUrl));
      },
      error: () => {
        this.loading.set(false);
        this.error.set('No se pudo generar la vista previa.');
      },
    });
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private revokeUrl(): void {
    if (this.rawUrl) URL.revokeObjectURL(this.rawUrl);
    this.rawUrl = undefined;
  }
}
