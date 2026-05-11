import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Tariff, Product, ProductPeriod } from '../../../../../../entities/provider.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RatesService } from '../../../../../../services/rates.service';
import { PeriodEditorComponent } from '../period-editor/period-editor.component';
import { LucideAngularModule, Calculator } from 'lucide-angular';

@Component({
  selector: 'app-tariffs-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodEditorComponent, LucideAngularModule],
  templateUrl: './tariffs-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TariffsTabComponent {
  private ratesService = inject(RatesService);

  readonly CalculatorIcon = Calculator;

  readonly tariffs = input.required<Tariff[]>();
  readonly selectedTariffId = signal<number | null>(null);
  readonly selectedProductId = signal<number | null>(null);
  readonly editingPeriod = signal<number | null>(null);
  readonly isSaving = signal<boolean>(false);

  readonly filteredTariffs = computed(() => {
    const selectedId = this.selectedTariffId();
    if (selectedId === null) {
      return this.tariffs();
    }
    return this.tariffs().filter(t => t.id === selectedId);
  });

  readonly availableProducts = computed(() => {
    const selectedTariffId = this.selectedTariffId();

    if (selectedTariffId === null) {
      return [];
    }

    const products: Product[] = [];
    const tariffsToShow = this.filteredTariffs();

    tariffsToShow.forEach(tariff => {
      if (tariff.products) {
        products.push(...tariff.products);
      }
    });

    return products;
  });

  getFilteredProducts(tariff: Tariff): Product[] {
    const selectedProductId = this.selectedProductId();
    if (selectedProductId === null) {
      return tariff.products;
    }
    return tariff.products.filter(p => p.id === selectedProductId);
  }

  onTariffChange(value: any): void {
    const numValue = value === 'null' || value === null ? null : Number(value);
    this.selectedTariffId.set(numValue);
    this.selectedProductId.set(null);
  }

  onProductChange(value: any): void {
    const numValue = value === 'null' || value === null ? null : Number(value);
    this.selectedProductId.set(numValue);
  }

  sortedPeriods<T extends { period: string }>(periods: T[]): T[] {
    return [...periods].sort((a, b) => {
      const numA = parseInt(a.period.substring(1));
      const numB = parseInt(b.period.substring(1));
      return numA - numB;
    });
  }

  startEdit(period: ProductPeriod): void {
    this.editingPeriod.set(period.id);
  }

  saveEdit(product: Product, period: ProductPeriod, newValue: number): void {
    if (this.isSaving()) return;

    const originalValue = period.value;

    this.isSaving.set(true);

    period.value = newValue;

    const updateRequest = {
      period: period.period,
      value: newValue,
      productId: product.id
    };

    this.ratesService.updateProductPeriod(period.id, updateRequest).subscribe({
      next: () => {
        this.editingPeriod.set(null);
        this.isSaving.set(false);
      },
      error: () => {
        period.value = originalValue;
        alert('Error al guardar los cambios. Por favor, intente nuevamente.');
        this.isSaving.set(false);
      }
    });
  }

  cancelEdit(): void {
    this.editingPeriod.set(null);
  }

  deleteValue(product: Product, period: ProductPeriod): void {
    if (!confirm(`¿Está seguro de eliminar el período ${period.period}?`)) {
      return;
    }

    if (this.isSaving()) return;
    this.isSaving.set(true);

    const periodIndex = product.periods.findIndex(p => p.id === period.id);

    this.ratesService.deleteProductPeriod(period.id).subscribe({
      next: () => {
        if (periodIndex > -1) {
          product.periods.splice(periodIndex, 1);
        }
        this.editingPeriod.set(null);
        this.isSaving.set(false);
      },
      error: () => {
        alert('Error al eliminar el período. Por favor, intente nuevamente.');
        this.isSaving.set(false);
      }
    });
  }
}
