import { computed, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AlertService } from '@apolo-energies/ui';
import { formatFileSize, isImageFile } from './comparator-multiple.helpers';

/**
 * Estado y handlers de la fase de carga de facturas (dropzone, lista de
 * pendientes, previsualización). Clase plana sin DI de Angular: recibe los
 * servicios que necesita por constructor, instanciada por el propio
 * componente `ComparatorMultiple`.
 */
export class UploadController {
  readonly pendingFiles = signal<File[]>([]);
  readonly previewIndex = signal(0);
  readonly isDragging   = signal(false);

  readonly previewFile = computed(() => this.pendingFiles()[this.previewIndex()] ?? null);
  readonly filledSlots = computed(() => Array.from({ length: this.pendingFiles().length }));
  readonly emptySlots  = computed(() => Array.from({ length: this.maxFiles - this.pendingFiles().length }));

  private readonly objectUrls = new Map<File, string>();

  constructor(
    private readonly alertService: AlertService,
    private readonly sanitizer: DomSanitizer,
    private readonly maxFiles: number,
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  removePending(file: File): void {
    this.revokeUrl(file);
    const newList = this.pendingFiles().filter(f => f !== file);
    this.pendingFiles.set(newList);
    if (this.previewIndex() >= newList.length) this.previewIndex.set(Math.max(0, newList.length - 1));
  }

  isImage(file: File): boolean {
    return isImageFile(file);
  }

  formatFileSize(file: File): string {
    return formatFileSize(file);
  }

  getPreviewUrl(file: File): SafeResourceUrl {
    if (!this.objectUrls.has(file)) this.objectUrls.set(file, URL.createObjectURL(file));
    return this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrls.get(file)!);
  }

  /** Libera todas las object URLs creadas para previsualización. */
  releaseAll(): void {
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();
  }

  /** Vuelve al estado inicial de la fase de carga (usado por "Nueva comparación"). */
  reset(): void {
    this.releaseAll();
    this.pendingFiles.set([]);
    this.previewIndex.set(0);
  }

  private addFiles(files: File[]): void {
    const remaining = this.maxFiles - this.pendingFiles().length;
    if (remaining <= 0) {
      this.alertService.show(`Límite de ${this.maxFiles} facturas alcanzado`, 'info');
      return;
    }
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) {
      this.alertService.show(
        `Solo se agregarán ${remaining} de las ${files.length} facturas (límite ${this.maxFiles})`,
        'info',
      );
    }
    const wasEmpty = this.pendingFiles().length === 0;
    this.pendingFiles.update(list => [...list, ...toAdd]);
    if (wasEmpty) this.previewIndex.set(0);
  }

  private revokeUrl(file: File): void {
    const url = this.objectUrls.get(file);
    if (url) {
      URL.revokeObjectURL(url);
      this.objectUrls.delete(file);
    }
  }
}
