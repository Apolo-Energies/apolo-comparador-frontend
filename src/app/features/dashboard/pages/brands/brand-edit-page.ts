import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AlertComponent, AlertService, ButtonComponent } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import {
  BrandImage, BrandPreviewPdfRequest, BrandSummary,
  BRAND_SETTINGS_COLOR_KEYS, BRAND_SETTINGS_GROUP_HINTS, BRAND_SETTINGS_SIZE_KEYS,
} from '../../../../core/models/brand.model';
import { BrandSettingsController } from './brand-settings.controller';
import { BrandPreviewController } from './brand-preview.controller';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';

/**
 * Página propia (no modal) para colores + tamaños: necesita el espacio para
 * mostrar el formulario y la vista previa en vivo del PDF lado a lado.
 * Imágenes y módulos se editan desde el modal del listado
 * (`BrandFormDialogComponent`) — acá solo se leen (read-only) para armar el
 * payload del preview (logo/logo_secondary).
 */
@Component({
  selector: 'app-brand-edit-page',
  standalone: true,
  imports: [AlertComponent, ButtonComponent, RouterLink, BrandLoaderComponent],
  templateUrl: './brand-edit-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandEditPageComponent {
  private readonly route        = inject(ActivatedRoute);
  private readonly brandService = inject(BrandService);
  private readonly alert        = inject(AlertService);
  private readonly platformId   = inject(PLATFORM_ID);
  private readonly sanitizer    = inject(DomSanitizer);

  private readonly brandId = this.route.snapshot.paramMap.get('id')!;
  private readonly images  = signal<BrandImage[]>([]);

  private readonly settingsCtrl = new BrandSettingsController(this.brandService, this.alert);
  private readonly previewCtrl  = new BrandPreviewController(this.brandService, this.sanitizer);

  readonly settingsColorKeys = BRAND_SETTINGS_COLOR_KEYS;
  readonly settingsSizeKeys  = BRAND_SETTINGS_SIZE_KEYS;

  readonly loading   = signal(true);
  readonly loadError = signal(false);
  readonly brand     = signal<BrandSummary | null>(null);

  readonly colorGroups = computed(() => {
    const groups = new Map<string, typeof BRAND_SETTINGS_COLOR_KEYS>();
    for (const k of BRAND_SETTINGS_COLOR_KEYS) {
      if (!groups.has(k.group)) groups.set(k.group, []);
      groups.get(k.group)!.push(k);
    }
    return Array.from(groups.entries()).map(([group, keys]) => ({
      group,
      hint: BRAND_SETTINGS_GROUP_HINTS[group] ?? '',
      keys,
    }));
  });

  readonly settingsFields     = this.settingsCtrl.fields;
  readonly settingsSizeFields = this.settingsCtrl.sizeFields;
  readonly settingsRawMode    = this.settingsCtrl.rawMode;
  readonly settingsRawJson    = this.settingsCtrl.rawJson;
  readonly settingsError      = this.settingsCtrl.error;
  readonly savingSettings     = this.settingsCtrl.saving;

  readonly previewUrl     = this.previewCtrl.url;
  readonly previewLoading = this.previewCtrl.loading;
  readonly previewError   = this.previewCtrl.error;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadBrand();

    // Cualquier cambio en colores/tamaños reprograma el preview (debounce interno).
    effect(() => {
      this.settingsFields();
      this.settingsSizeFields();
      this.settingsRawJson();
      this.settingsRawMode();
      if (!this.loading()) this.previewCtrl.schedule(() => this.buildPreviewPayload());
    });
  }

  private loadBrand(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.brandService.list().subscribe({
      next: list => {
        const found = list.find(b => b.id === this.brandId) ?? null;
        if (!found) {
          this.loading.set(false);
          this.loadError.set(true);
          return;
        }
        this.brand.set(found);
        this.brandService.getConfig(found.slug).subscribe({
          next: config => {
            this.images.set(config.images);
            this.settingsCtrl.reset(config.settingsJson);
            this.previewCtrl.reset(this.brandId);
            this.loading.set(false);
          },
          error: () => {
            this.loading.set(false);
            this.loadError.set(true);
            this.alert.show('No se pudo cargar la configuración de la marca.', 'error', 4000);
          },
        });
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
        this.alert.show('No se pudo cargar el listado de marcas.', 'error', 4000);
      },
    });
  }

  private buildPreviewPayload(): BrandPreviewPdfRequest {
    const logo          = this.images().find(r => r.kind === 'logo' && r.objectKey);
    const logoSecondary = this.images().find(r => r.kind === 'logo_secondary' && r.objectKey);
    return {
      settingsJson:           this.settingsCtrl.snapshotJson(),
      logoObjectKey:          logo?.objectKey || undefined,
      logoSecondaryObjectKey: logoSecondary?.objectKey || undefined,
    };
  }

  setSettingsField(key: string, value: string): void { this.settingsCtrl.setField(key, value); }
  setSettingsSizeField(key: string, value: string): void { this.settingsCtrl.setSizeField(key, value); }
  setSettingsRawJson(value: string): void { this.settingsCtrl.setRawJson(value); }
  toggleSettingsRawMode(): void { this.settingsCtrl.toggleRawMode(); }
  saveSettings(): void { this.settingsCtrl.save(this.brandId, { onSaved: () => {} }); }

  refreshPreviewNow(): void {
    this.previewCtrl.runNow(() => this.buildPreviewPayload());
  }
}
