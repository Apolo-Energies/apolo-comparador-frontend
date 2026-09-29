import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AlertComponent, AlertService, ButtonComponent } from '@apolo-energies/ui';
import { BrandService } from '../../../../core/services/brand.service';
import { BrandSummary } from '../../../../core/models/brand.model';
import { BrandFormDialogComponent } from './components/brand-form-dialog/brand-form-dialog';
import { BrandLoaderComponent } from '../../../../shared/components/brand-loader/brand-loader.component';

@Component({
  selector: 'app-brands-page',
  standalone: true,
  imports: [AlertComponent, ButtonComponent, BrandFormDialogComponent, BrandLoaderComponent],
  templateUrl: './brands-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandsPageComponent {
  private readonly brandService = inject(BrandService);
  private readonly alert        = inject(AlertService);
  private readonly platformId   = inject(PLATFORM_ID);

  readonly loading   = signal(false);
  readonly loadError = signal(false);
  readonly data      = signal<BrandSummary[]>([]);

  readonly formOpen  = signal(false);
  readonly formBrand = signal<BrandSummary | null>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.brandService.list().subscribe({
      next: list => {
        this.data.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
        this.alert.show('No se pudo cargar el listado de marcas.', 'error', 4000);
      },
    });
  }

  openCreate(): void {
    this.formBrand.set(null);
    this.formOpen.set(true);
  }

  openEdit(brand: BrandSummary): void {
    this.formBrand.set(brand);
    this.formOpen.set(true);
  }

  onFormOpenChange(open: boolean): void {
    this.formOpen.set(open);
    if (!open) this.formBrand.set(null);
  }

  onFormSaved(): void {
    this.load();
  }
}
