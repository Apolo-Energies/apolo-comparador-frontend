import { signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import { BrandFormCallbacks } from './brand-form-callbacks';

/**
 * Estado y handlers de `settingsJson` de una marca: un formulario de
 * colores + tamaños (las claves que hoy consume el backend para los PDFs,
 * ver BRAND_SETTINGS_COLOR_KEYS/BRAND_SETTINGS_SIZE_KEYS) con un modo "JSON
 * crudo" como vía de escape para claves no listadas. Clase plana sin DI de
 * Angular, instanciada por `BrandEditPageComponent`.
 */
export class BrandSettingsController {
  readonly fields     = signal<Record<string, string>>({});
  readonly sizeFields = signal<Record<string, string>>({});
  readonly rawMode    = signal(false);
  readonly rawJson    = signal('');
  readonly error      = signal<string | null>(null);
  readonly saving     = signal(false);

  constructor(
    private readonly brandService: BrandService,
    private readonly alert: AlertService,
  ) {}

  reset(settingsJson: string | null): void {
    this.rawMode.set(false);
    this.error.set(null);
    this.saving.set(false);
    const parsed = this.tryParse(settingsJson) ?? {};
    const { colors, sizes } = this.splitFields(parsed);
    this.fields.set(colors);
    this.sizeFields.set(sizes);
    this.rawJson.set(settingsJson ?? '');
  }

  setField(key: string, value: string): void {
    this.fields.update(f => ({ ...f, [key]: value }));
  }

  setSizeField(key: string, value: string): void {
    this.sizeFields.update(f => ({ ...f, [key]: value }));
  }

  setRawJson(value: string): void {
    this.rawJson.set(value);
  }

  toggleRawMode(): void {
    if (this.rawMode()) {
      const parsed = this.tryParse(this.rawJson());
      if (!parsed) {
        this.error.set('El JSON no es válido, corrígelo antes de volver al formulario.');
        return;
      }
      const { colors, sizes } = this.splitFields(parsed);
      this.fields.set(colors);
      this.sizeFields.set(sizes);
      this.error.set(null);
      this.rawMode.set(false);
    } else {
      this.rawJson.set(JSON.stringify(this.buildJsonObject(), null, 2));
      this.rawMode.set(true);
    }
  }

  /** JSON que se mandaría AHORA MISMO (para el preview en vivo), sin guardar nada. */
  snapshotJson(): string {
    if (this.rawMode()) return this.rawJson();
    return JSON.stringify(this.buildJsonObject());
  }

  save(brandId: string, callbacks: BrandFormCallbacks): void {
    let raw: string;
    if (this.rawMode()) {
      if (this.rawJson().trim() && !this.tryParse(this.rawJson())) {
        this.error.set('El JSON no es válido.');
        return;
      }
      raw = this.rawJson();
    } else {
      raw = JSON.stringify(this.buildJsonObject());
    }
    this.error.set(null);
    this.saving.set(true);
    this.brandService.updateSettings(brandId, raw).subscribe({
      next: () => {
        this.saving.set(false);
        this.alert.show('Settings guardados.', 'success', 3000);
        callbacks.onSaved();
      },
      error: () => {
        this.saving.set(false);
        this.alert.show('No se pudieron guardar los settings.', 'error', 4000);
      },
    });
  }

  private buildJsonObject(): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(this.fields())) {
      if (value.trim()) out[key] = value;
    }
    for (const [key, value] of Object.entries(this.sizeFields())) {
      const n = Number(value);
      if (value.trim() && !Number.isNaN(n)) out[key] = n;
    }
    return out;
  }

  private splitFields(parsed: Record<string, unknown>): { colors: Record<string, string>; sizes: Record<string, string> } {
    const colors: Record<string, string> = {};
    const sizes: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value == null) continue;
      if (typeof value === 'number') sizes[key] = String(value);
      else colors[key] = String(value);
    }
    return { colors, sizes };
  }

  private tryParse(raw: string | null): Record<string, unknown> | null {
    if (!raw || !raw.trim()) return {};
    try {
      const obj = JSON.parse(raw);
      return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : null;
    } catch {
      return null;
    }
  }
}
