import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { Editor } from 'ngx-editor';
import { convertDocxToHtml, convertHtmlDocument, convertPdfToHtml } from './document-import-parsers';
import { renderDocxPreview, renderHtmlPreview, renderPdfPreview } from './document-preview-renderer';

type PendingFileType = 'docx' | 'pdf' | 'html';

export interface DocumentImportDeps {
  alertService: AlertService;
  getEditor: () => Editor;
  markForCheck: () => void;
  clearContentError: () => void;
}

/**
 * Encapsulates the "import an external document into the editor" flow: file
 * pick, iframe preview (docx / pdf / html) and confirm-to-import. Extracted
 * from ContractTemplateFormComponent to keep it under the file-size
 * guideline (R1). The actual iframe rendering and HTML conversion live in
 * document-preview-renderer.ts / document-import-parsers.ts respectively.
 */
export class DocumentImportController {
  constructor(private readonly deps: DocumentImportDeps) {}

  readonly importing   = signal(false);
  readonly confirming  = signal(false);
  readonly previewOpen = signal(false);

  private pendingBuffer?: ArrayBuffer;
  private pendingFileType?: PendingFileType;
  private pendingHtml?: string;
  private pendingBlobUrl?: string;

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    (event.target as HTMLInputElement).value = '';

    this.importing.set(true);
    this.deps.markForCheck();

    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      this.pendingFileType = ext === 'pdf' ? 'pdf' : (ext === 'html' || ext === 'htm') ? 'html' : 'docx';
      this.pendingBuffer   = await file.arrayBuffer();
      if (this.pendingFileType === 'html') this.pendingHtml = await file.text();
      this.previewOpen.set(true);  // ViewChild setter triggers renderPreview
    } catch {
      this.deps.alertService.show('Error al abrir el documento', 'error');
    } finally {
      this.importing.set(false);
      this.deps.markForCheck();
    }
  }

  async renderPreview(frame: HTMLIFrameElement): Promise<void> {
    if (!this.pendingBuffer || !this.pendingFileType) return;
    try {
      if (this.pendingFileType === 'docx') {
        await renderDocxPreview(frame, this.pendingBuffer);
        this.deps.markForCheck();
      } else if (this.pendingFileType === 'pdf') {
        if (this.pendingBlobUrl) URL.revokeObjectURL(this.pendingBlobUrl);
        this.pendingBlobUrl = renderPdfPreview(frame, this.pendingBuffer);
      } else {
        renderHtmlPreview(frame, this.pendingHtml ?? '');
      }
    } catch {
      this.deps.alertService.show('Error al renderizar la vista previa', 'error');
    }
  }

  onCancelPreview(): void {
    this.previewOpen.set(false);
    this.clearPending();
  }

  async onConfirmImport(): Promise<void> {
    if (!this.pendingFileType) return;
    this.confirming.set(true);
    this.deps.markForCheck();

    try {
      if (this.pendingFileType === 'docx') {
        await this.importDocx();
      } else if (this.pendingFileType === 'pdf') {
        await this.importPdf();
      } else {
        this.importHtml();
      }
      this.previewOpen.set(false);
      this.clearPending();
    } catch {
      this.deps.alertService.show('Error al importar el documento', 'error');
    } finally {
      this.confirming.set(false);
      this.deps.markForCheck();
    }
  }

  private async importDocx(): Promise<void> {
    if (!this.pendingBuffer) return;
    const html = await convertDocxToHtml(this.pendingBuffer);
    this.deps.getEditor().setContent(html);
    this.deps.clearContentError();
    this.deps.alertService.show('Word importado correctamente', 'success');
  }

  private async importPdf(): Promise<void> {
    if (!this.pendingBuffer) return;
    const { html, pageCount } = await convertPdfToHtml(this.pendingBuffer);
    this.deps.getEditor().setContent(html);
    this.deps.clearContentError();
    this.deps.alertService.show(`PDF importado como texto editable (${pageCount} páginas)`, 'success');
  }

  private importHtml(): void {
    if (!this.pendingHtml) return;
    this.deps.getEditor().setContent(convertHtmlDocument(this.pendingHtml));
    this.deps.clearContentError();
    this.deps.alertService.show('HTML importado correctamente', 'success');
  }

  private clearPending(): void {
    this.pendingBuffer   = undefined;
    this.pendingFileType = undefined;
    this.pendingHtml     = undefined;
    if (this.pendingBlobUrl) {
      URL.revokeObjectURL(this.pendingBlobUrl);
      this.pendingBlobUrl = undefined;
    }
  }

  /** Releases the preview blob URL. Call from the host component's ngOnDestroy. */
  destroy(): void {
    if (this.pendingBlobUrl) URL.revokeObjectURL(this.pendingBlobUrl);
  }
}
