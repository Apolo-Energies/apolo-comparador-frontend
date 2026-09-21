import { signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ProviderService } from '../../../../core/services/provider.service';

export interface TariffPreviewDeps {
  readonly providerService: ProviderService;
  readonly sanitizer:       DomSanitizer;
}

/**
 * Encapsulates the "Tarifas De Luz" PDF/Excel preview flow (loading state,
 * blob URLs, error handling) for the support page. Extracted from
 * SupportPageComponent to keep the page under the file-size guideline (R1).
 * No Angular DI here: the page owns the instance and injects its services.
 */
export class TariffPreviewController {
  constructor(private readonly deps: TariffPreviewDeps) {}

  readonly previewLoading = signal(false);
  readonly previewError   = signal<string | null>(null);
  readonly pdfUrl         = signal<SafeResourceUrl | null>(null);

  private excelBlob: Blob | null = null;
  private pdfObjectUrl: string | null = null;

  load(providerId: number): void {
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.excelBlob = null;

    // PDF for inline preview
    this.deps.providerService.downloadTariffPdf(providerId).subscribe({
      next: pdfBlob => {
        const url = URL.createObjectURL(pdfBlob);
        this.pdfObjectUrl = url;
        this.pdfUrl.set(this.deps.sanitizer.bypassSecurityTrustResourceUrl(url));
        this.previewLoading.set(false);
      },
      error: err => {
        console.error('Tariff PDF preview error:', err);
        this.previewError.set('No se pudo cargar la vista previa.');
        this.previewLoading.set(false);
      },
    });

    // Excel blob in parallel for the download button (doesn't gate the loader)
    this.deps.providerService.downloadExcel(providerId).subscribe({
      next: blob => { this.excelBlob = blob; },
      error: err => { console.warn('Excel prefetch failed:', err); },
    });
  }

  downloadExcel(): void {
    if (!this.excelBlob) return;
    const url = URL.createObjectURL(this.excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tarifarios-luz.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }

  revoke(): void {
    if (this.pdfObjectUrl) {
      URL.revokeObjectURL(this.pdfObjectUrl);
      this.pdfObjectUrl = null;
    }
    this.pdfUrl.set(null);
  }

  clearError(): void {
    this.previewError.set(null);
  }

  clearExcelBlob(): void {
    this.excelBlob = null;
  }
}
