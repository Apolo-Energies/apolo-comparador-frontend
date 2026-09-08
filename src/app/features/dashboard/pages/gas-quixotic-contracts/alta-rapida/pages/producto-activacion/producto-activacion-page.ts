import { ChangeDetectionStrategy, Component, computed, inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { AltaRapidaGasStore } from '../../store/alta-rapida-gas.store';
import { QuixoticProductService } from '../../../../../../../services/quixotic-product.service';
import { QuixoticProduct } from '../../../../../../../entities/quixotic-product.model';

const INPUT_CLS = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
const SELECT_CLS = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
const TEXTAREA_CLS = `${INPUT_CLS} font-mono text-xs`;

@Component({
  selector: 'app-arg-producto-activacion-page',
  imports: [ButtonComponent],
  templateUrl: './producto-activacion-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductoActivacionPage {
  private readonly router         = inject(Router);
  private readonly store          = inject(AltaRapidaGasStore);
  private readonly productService = inject(QuixoticProductService);
  private readonly platformId     = inject(PLATFORM_ID);

  readonly draft = this.store.draft;
  readonly inputCls    = INPUT_CLS;
  readonly selectCls   = SELECT_CLS;
  readonly textareaCls = TEXTAREA_CLS;

  readonly products        = signal<QuixoticProduct[]>([]);
  readonly loadingProducts = signal(false);
  readonly productsError   = signal(false);

  // Grupos tarifarios de acceso de gas (CNMC): R1 = residencial/pequeño ... R8 = industrial alto.
  readonly atrRateOptions = ['R1', 'R3', 'R4', 'R8'];

  // "A" (cuanto antes) es el único valor usado en la práctica; F/L existen en el manual pero no se usan.
  readonly activationTypeOptions = [
    { value: 'A', label: 'A — Cuanto antes (recomendado)' },
    { value: 'F', label: 'F' },
    { value: 'L', label: 'L' },
  ];

  readonly contractParamsError = computed(() => {
    const raw = this.draft().contractParamsJson.trim();
    if (!raw) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return 'JSON inválido';
    }
    if (!Array.isArray(parsed)) return 'Debe ser un array de objetos {code, name, value}';
    const invalid = parsed.some(item =>
      typeof item !== 'object' || item === null ||
      typeof (item as Record<string, unknown>)['code']  !== 'string' ||
      typeof (item as Record<string, unknown>)['name']  !== 'string' ||
      typeof (item as Record<string, unknown>)['value'] !== 'string'
    );
    return invalid ? 'Cada elemento debe tener code, name y value (texto)' : null;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) this.loadProducts();
  }

  private loadProducts(): void {
    this.loadingProducts.set(true);
    this.productsError.set(false);
    this.productService.getProducts('Gas').subscribe({
      next: products => {
        this.products.set(products);
        this.loadingProducts.set(false);
      },
      error: () => {
        this.products.set([]);
        this.productsError.set(true);
        this.loadingProducts.set(false);
      },
    });
  }

  updateField<K extends keyof ReturnType<typeof this.store.draft>>(key: K, value: string): void {
    this.store.update({ [key]: value } as never);
  }

  next(): void {
    if (this.contractParamsError()) return;
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/revision']);
  }

  back(): void {
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/suministro-contrato']);
  }
}
