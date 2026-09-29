import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import { BrandImage } from '../../../../core/models/brand.model';
import { BrandFormCallbacks } from './brand-form-callbacks';

export interface BrandImageRow extends BrandImage {
  uploading: boolean;
  /**
   * Preview local (blob URL) mientras se sube un archivo recién elegido en
   * esta sesión — se usa hasta que llega la `url` firmada real del backend
   * (GET config / POST upload), que reemplaza y libera este blob.
   */
  previewUrl: string | null;
}

/**
 * Estado y handlers de las imágenes de una marca: filas (kind/objectKey/
 * orden), subida de archivo por fila (POST .../images/upload, agrega sin
 * borrar) y guardado del set final (PUT .../images, reemplaza todo).
 * Clase plana sin DI de Angular, instanciada por `BrandFormDialogComponent`.
 */
export class BrandImagesController {
  readonly rows   = signal<BrandImageRow[]>([]);
  readonly saving = signal(false);

  constructor(
    private readonly brandService: BrandService,
    private readonly alert: AlertService,
  ) {}

  reset(images: BrandImage[]): void {
    this.revokeAllPreviews();
    this.rows.set(images.map(img => ({ ...img, uploading: false, previewUrl: null })));
    this.saving.set(false);
  }

  addRow(kind: string): void {
    this.rows.update(list => [...list, { kind, objectKey: '', sortOrder: list.length, uploading: false, previewUrl: null }]);
  }

  removeRow(index: number): void {
    const row = this.rows()[index];
    if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
    this.rows.update(list => list.filter((_, i) => i !== index));
  }

  setKind(index: number, kind: string): void {
    this.rows.update(list => list.map((r, i) => (i === index ? { ...r, kind } : r)));
  }

  setSortOrder(index: number, sortOrder: number): void {
    this.rows.update(list => list.map((r, i) => (i === index ? { ...r, sortOrder } : r)));
  }

  uploadFile(brandId: string, index: number, file: File): void {
    const row = this.rows()[index];
    if (!row) return;
    if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    this.rows.update(list => list.map((r, i) => (i === index ? { ...r, uploading: true, previewUrl } : r)));
    this.brandService.uploadImage(brandId, file, row.kind, row.sortOrder).subscribe({
      next: res => {
        this.rows.update(list => list.map((r, i) => {
          if (i !== index) return r;
          // Ya tenemos la url firmada real del backend: soltamos el blob local.
          if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
          return { ...r, objectKey: res.objectKey, url: res.url, uploading: false, previewUrl: null };
        }));
        this.alert.show('Imagen subida.', 'success', 2500);
      },
      error: () => {
        this.rows.update(list => list.map((r, i) => (i === index ? { ...r, uploading: false } : r)));
        this.alert.show('No se pudo subir la imagen.', 'error', 4000);
      },
    });
  }

  save(brandId: string, callbacks: BrandFormCallbacks): void {
    this.saving.set(true);
    const images: BrandImage[] = this.rows().map(({ kind, objectKey, sortOrder }) => ({ kind, objectKey, sortOrder }));
    this.brandService.updateImages(brandId, images).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.show('Imágenes guardadas.', 'success', 3000);
        callbacks.onSaved();
      },
      error: () => {
        this.saving.set(false);
        this.alert.show('No se pudieron guardar las imágenes.', 'error', 4000);
      },
    });
  }

  private revokeAllPreviews(): void {
    for (const row of this.rows()) {
      if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
    }
  }
}
