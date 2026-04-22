import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Tariff, Product, ProductPeriod } from '../../../../../entities/provider.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RatesService } from '../../../../../services/rates.service';
import { PeriodEditorComponent } from './period-editor.component';
import { LucideAngularModule, Calculator } from 'lucide-angular';

@Component({
  selector: 'app-tariffs-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodEditorComponent, LucideAngularModule],
  template: `
    <div class="space-y-4">
      <!-- Selectores de Tarifa y Producto -->
      <div class="bg-card rounded-lg border border-border p-5">
        <div class="grid grid-cols-1 gap-4" [class.md:grid-cols-2]="selectedTariffId() !== null">
          <!-- Selector de Tarifa -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-3">Seleccionar Tarifa</label>
            <select 
              class="w-full px-4 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              [ngModel]="selectedTariffId()"
              (ngModelChange)="onTariffChange($event)"
            >
              <option [value]="null">Mostrar todos</option>
              @for (tariff of tariffs(); track tariff.id) {
                <option [value]="tariff.id">{{ tariff.code }}</option>
              }
            </select>
          </div>

          <!-- Selector de Producto (solo visible cuando hay tarifa seleccionada) -->
          @if (selectedTariffId() !== null) {
            <div>
              <label class="block text-sm font-medium text-foreground mb-3">Seleccionar Producto</label>
              <select 
                class="w-full px-4 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                [ngModel]="selectedProductId()"
                (ngModelChange)="onProductChange($event)"
              >
                <option [value]="null">Mostrar todos los productos</option>
                @for (product of availableProducts(); track product.id) {
                  <option [value]="product.id">{{ product.name }}</option>
                }
              </select>
            </div>
          }
        </div>
      </div>

      <!-- Lista de productos -->
      <div class="space-y-4">
        @for (tariff of filteredTariffs(); track tariff.id) {
          @for (product of getFilteredProducts(tariff); track product.id) {
            <div class="bg-card rounded-lg border border-border p-5">
              <!-- Header del producto -->
              <div class="flex items-center gap-3 mb-4">
                <div class="p-2 bg-card rounded">
                  <lucide-icon [img]="CalculatorIcon" [size]="20" class="text-white" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-foreground">{{ tariff.code }}</h3>
                  <p class="text-sm text-muted-foreground">{{ product.name }}</p>
                </div>
              </div>

              <!-- Períodos -->
              <div>
                <p class="text-sm text-muted-foreground mb-3">Periods (€/kWh)</p>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  @for (period of sortedPeriods(product.periods); track period.id) {
                    <app-period-editor
                      [period]="period.period"
                      [value]="period.value"
                      [isEditing]="editingPeriod() === period.id"
                      [isSaving]="isSaving()"
                      [decimals]="6"
                      step="0.000001"
                      (edit)="startEdit(period)"
                      (save)="saveEdit(product, period, $event)"
                      (cancel)="cancelEdit()"
                      (delete)="deleteValue(product, period)"
                    />
                  }
                </div>
              </div>
            </div>
          }
        }
      </div>

      @if (filteredTariffs().length === 0) {
        <div class="text-center py-12 bg-card rounded-lg border border-border">
          <p class="text-muted-foreground">No hay tarifas para mostrar</p>
        </div>
      } @else if (availableProducts().length === 0) {
        <div class="text-center py-12 bg-card rounded-lg border border-border">
          <p class="text-muted-foreground">No hay productos disponibles para la tarifa seleccionada</p>
        </div>
      }
    </div>
  `,
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
    
    // Solo mostrar productos si hay una tarifa específica seleccionada
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
    // Convertir a número si no es null
    const numValue = value === 'null' || value === null ? null : Number(value);
    this.selectedTariffId.set(numValue);
    // Resetear el producto seleccionado cuando cambia la tarifa
    this.selectedProductId.set(null);
  }

  onProductChange(value: any): void {
    // Convertir a número si no es null
    const numValue = value === 'null' || value === null ? null : Number(value);
    this.selectedProductId.set(numValue);
  }

  sortedPeriods<T extends { period: string }>(periods: T[]): T[] {
    // Extraer el número del string "P1" -> 1, "P2" -> 2, etc.
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
    
    // Guardar el valor original para revertir en caso de error
    const originalValue = period.value;
    
    this.isSaving.set(true);
    
    // Actualizar el valor localmente primero
    period.value = newValue;
    
    // Preparar el request para actualizar solo este período
    const updateRequest = {
      period: period.period,  // "P1", "P2", etc.
      value: newValue,
      productId: product.id
    };
    
    this.ratesService.updateProductPeriod(period.id, updateRequest).subscribe({
      next: () => {
        console.log('✅ Período actualizado correctamente');
        this.editingPeriod.set(null);
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('❌ Error al actualizar período:', err);
        // Revertir el cambio local en caso de error
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
    
    // Guardar el índice y el período para poder revertir si falla
    const periodIndex = product.periods.findIndex(p => p.id === period.id);
    
    // Eliminar el período del backend
    this.ratesService.deleteProductPeriod(period.id).subscribe({
      next: () => {
        console.log('✅ Período eliminado correctamente');
        // Eliminar el período del producto localmente
        if (periodIndex > -1) {
          product.periods.splice(periodIndex, 1);
        }
        this.editingPeriod.set(null);
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('❌ Error al eliminar período:', err);
        alert('Error al eliminar el período. Por favor, intente nuevamente.');
        this.isSaving.set(false);
      }
    });
  }
}
