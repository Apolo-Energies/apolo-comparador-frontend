import { computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { LandingService } from '../../../../core/services/landing.service';
import { LandingDetail, LandingStats } from '../../../../core/models/landing.model';
import { FormController } from './landing-form.controller';
import { AssetsController } from './landing-assets.controller';

export interface LandingDataCallbacks {
  /** Notifica al padre que la landing (o sus imágenes) se guardó. */
  onSaved: () => void;
  /** Cierra el diálogo. */
  onClose: () => void;
}

/**
 * Carga y guardado de la landing (datos generales + orquestación de la
 * subida de imágenes al crear/editar). Compone `FormController` y
 * `AssetsController` para poblarlos/resetearlos según corresponda.
 * Clase plana sin DI de Angular, instanciada por `LandingFormDialogComponent`.
 */
export class LandingDataController {
  readonly editingId = signal<string | null>(null);
  readonly isEdit     = computed(() => !!this.editingId());

  readonly detail    = signal<LandingDetail | null>(null);
  readonly stats     = signal<LandingStats | null>(null);
  readonly loading   = signal(false);
  readonly saving    = signal(false);
  readonly uploading = signal(false);

  constructor(
    private readonly landingService: LandingService,
    private readonly alert: AlertService,
    private readonly form: FormController,
    private readonly assets: AssetsController,
  ) {}

  reset(id: string | null): void {
    this.editingId.set(id);
    this.detail.set(null);
    this.stats.set(null);
    this.form.reset();
    this.assets.reset();
  }

  loadDetail(id: string, onLoaded: () => void, onError: () => void): void {
    this.loading.set(true);
    this.landingService.getById(id).subscribe({
      next: detail => {
        this.detail.set(detail);
        this.form.populateFromDetail(detail);
        this.assets.populateFromDetail(detail);
        this.loading.set(false);
        onLoaded();
      },
      error: () => {
        this.loading.set(false);
        this.alert.show('No se pudo cargar la landing.', 'error', 4000);
        onError();
      },
    });
    this.refreshStats(id);
  }

  save(callbacks: LandingDataCallbacks): void {
    this.form.markAllTouched();
    if (!this.form.formValid()) {
      this.alert.show('Revisa los campos del formulario.', 'error', 3500);
      return;
    }

    const payload = this.form.buildPayload();
    this.saving.set(true);
    const id = this.editingId();
    const obs = id ? this.landingService.update(id, payload) : this.landingService.create(payload);
    obs.subscribe({
      next: detail => {
        this.saving.set(false);
        this.detail.set(detail);
        this.editingId.set(detail.id);
        callbacks.onSaved();

        if (id) {
          this.assets.populateFromDetail(detail);
          this.alert.show('Landing actualizada.', 'success', 3000);
          return;
        }

        if (this.assets.hasPendingAssets()) {
          this.uploadAssetsForCreated(detail.id, callbacks);
        } else {
          this.alert.show('Landing creada.', 'success', 3000);
          callbacks.onClose();
        }
      },
      error: err => {
        this.saving.set(false);
        const message = err?.error?.message ?? 'No se pudo guardar la landing.';
        this.alert.show(message, 'error', 4500);
      },
    });
  }

  uploadAssets(callbacks: LandingDataCallbacks): void {
    const id = this.editingId();
    if (!id) return;
    if (!this.assets.hasPendingAssets()) {
      this.alert.show('Selecciona al menos una imagen.', 'error', 3000);
      return;
    }
    this.uploading.set(true);
    this.assets.save(id, detail => {
      this.uploading.set(false);
      this.detail.set(detail);
      this.alert.show('Imágenes guardadas.', 'success', 3000);
      callbacks.onSaved();
    }, () => {
      this.uploading.set(false);
      this.alert.show('No se pudieron subir las imágenes.', 'error', 4000);
    });
  }

  private uploadAssetsForCreated(id: string, callbacks: LandingDataCallbacks): void {
    this.uploading.set(true);
    this.assets.uploadForCreated(id, detail => {
      this.uploading.set(false);
      this.detail.set(detail);
      this.alert.show('Landing creada e imágenes subidas.', 'success', 3500);
      callbacks.onSaved();
      callbacks.onClose();
    }, () => {
      this.uploading.set(false);
      this.alert.show('La landing se creó, pero las imágenes no se subieron. Inténtalo desde edición.', 'error', 5000);
      callbacks.onClose();
    });
  }

  private refreshStats(id: string): void {
    this.landingService.getStats(id).subscribe({
      next: s => this.stats.set(s),
    });
  }
}
