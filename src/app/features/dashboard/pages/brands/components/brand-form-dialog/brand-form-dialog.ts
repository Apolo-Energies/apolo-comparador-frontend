import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, effect, inject, input, output, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AlertService, ButtonComponent, DialogComponent, InputFieldComponent } from '@apolo-energies/ui';
import { FileText, LucideAngularModule } from 'lucide-angular';
import { BrandService } from '../../../../../../core/services/brand.service';
import { BrandSummary, BRAND_IMAGE_KIND_DEFS, BRAND_MODULE_DEFS } from '../../../../../../core/models/brand.model';
import { BrandFormController, BrandFormSection } from '../../brand-form.controller';
import { BrandImagesController } from '../../brand-images.controller';
import { BrandModulesController } from '../../brand-modules.controller';
import { BrandLoaderComponent } from '../../../../../../shared/components/brand-loader/brand-loader.component';

/**
 * Modal de marcas blancas: alta (nombre + slug) y, una vez creada/
 * seleccionada, tabs Imágenes/Módulos. El botón de colores navega a
 * `BrandEditPageComponent` (página propia, por el preview en vivo del PDF).
 */
@Component({
  selector: 'app-brand-form-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, InputFieldComponent, LucideAngularModule, BrandLoaderComponent],
  templateUrl: './brand-form-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandFormDialogComponent {
  readonly open  = input(false);
  readonly brand = input<BrandSummary | null>(null);

  readonly openChange = output<boolean>();
  readonly saved      = output<void>();

  private readonly brandService = inject(BrandService);
  private readonly alert        = inject(AlertService);
  private readonly platformId   = inject(PLATFORM_ID);
  private readonly router       = inject(Router);

  private readonly imagesCtrl  = new BrandImagesController(this.brandService, this.alert);
  private readonly modulesCtrl = new BrandModulesController(this.brandService, this.alert);
  private readonly form        = new BrandFormController(this.brandService, this.alert, this.imagesCtrl, this.modulesCtrl);

  readonly imageKindDefs = BRAND_IMAGE_KIND_DEFS;
  readonly colorsIcon    = FileText;

  readonly moduleGroups = computed(() => {
    const groups = new Map<string, typeof BRAND_MODULE_DEFS>();
    for (const def of BRAND_MODULE_DEFS) {
      if (!groups.has(def.group)) groups.set(def.group, []);
      groups.get(def.group)!.push(def);
    }
    return Array.from(groups.entries()).map(([group, defs]) => ({ group, defs }));
  });

  readonly isEdit  = this.form.isEdit;
  readonly loading = this.form.loading;
  readonly section = this.form.section;

  readonly name      = this.form.name;
  readonly slug      = this.form.slug;
  readonly creating  = this.form.creating;
  readonly brandName = this.form.brandName;
  readonly brandSlug = this.form.brandSlug;

  readonly imageRows    = this.imagesCtrl.rows;
  readonly savingImages = this.imagesCtrl.saving;

  readonly modules       = this.modulesCtrl.modules;
  readonly savingModules = this.modulesCtrl.saving;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    effect(() => {
      const isOpen = this.open();
      const brand  = this.brand();
      if (!isOpen) return;
      // reset() reads/writes señales de los sub-controllers (ej. BrandImagesController.rows
      // vía revokeAllPreviews()); sin `untracked`, esos reads quedan como dependencia del
      // efecto y el write posterior lo vuelve a disparar — loop infinito que congela la pestaña.
      untracked(() => this.form.reset(brand));
    });
  }

  isFieldInvalid(field: string): boolean { return this.form.isFieldInvalid(field); }
  markTouched(field: string): void { this.form.markTouched(field); }
  setSection(s: BrandFormSection): void { this.form.setSection(s); }

  create(): void {
    this.form.create({ onSaved: () => this.saved.emit() });
  }

  addImageRow(kind: string): void { this.imagesCtrl.addRow(kind); }
  removeImageRow(i: number): void { this.imagesCtrl.removeRow(i); }
  setImageKind(i: number, kind: string): void { this.imagesCtrl.setKind(i, kind); }
  setImageSortOrder(i: number, value: string): void { this.imagesCtrl.setSortOrder(i, Number(value) || 0); }

  uploadImageFile(i: number, event: Event): void {
    const id = this.form.brandId();
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!id || !file) return;
    this.imagesCtrl.uploadFile(id, i, file);
  }

  saveImages(): void {
    const id = this.form.brandId();
    if (!id) return;
    this.imagesCtrl.save(id, { onSaved: () => this.saved.emit() });
  }

  isModuleEnabled(code: string): boolean {
    return this.modules().find(m => m.code === code)?.isEnabled ?? false;
  }

  toggleModule(code: string): void { this.modulesCtrl.toggle(code); }

  saveModules(): void {
    const id = this.form.brandId();
    if (!id) return;
    this.modulesCtrl.save(id, { onSaved: () => this.saved.emit() });
  }

  goToColors(): void {
    const id = this.form.brandId();
    if (!id) return;
    this.close();
    this.router.navigate(['/dashboard/brands', id]);
  }

  close(): void {
    this.openChange.emit(false);
  }
}
