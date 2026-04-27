import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Tariff, OmieDistribution, OmieDistributionPeriod } from '../../../../../entities/provider.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RatesService } from '../../../../../services/rates.service';
import { PeriodEditorComponent } from './period-editor.component';
import { LucideAngularModule, TrendingUp } from 'lucide-angular';

@Component({
  selector: 'app-omie-distribution-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodEditorComponent, LucideAngularModule],
  template: `
    <div class="space-y-4">
      <!-- Selector de Tarifa -->
      <div class="bg-card rounded-lg border border-border p-5">
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

      <!-- Lista de distribuciones -->
      <div class="space-y-4">
        @for (item of filteredGroupedData(); track item.tariffCode) {
          @for (dist of item.distributions; track dist.id) {
            <div class="bg-card rounded-lg border border-border p-5">
              <!-- Header -->
              <div class="flex items-center gap-3 mb-4">
                <div class="p-2 bg-card rounded">
                  <lucide-icon [img]="TrendingUpIcon" [size]="20" class="text-white" />
                </div>
                <div>
                  <h3 class="text-lg font-semibold text-foreground">{{ item.tariffCode }}</h3>
                  <p class="text-sm text-muted-foreground">{{ dist.periodName }}</p>
                </div>
              </div>

              <!-- Factores de distribución -->
              <div>
                <p class="text-sm text-muted-foreground mb-3">Distribution Factors</p>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  @for (period of sortedPeriods(dist.periods); track period.id) {
                    <app-period-editor
                      [period]="period.period"
                      [value]="period.factor"
                      [isEditing]="editingPeriod() === period.id"
                      [isSaving]="isSaving()"
                      [decimals]="6"
                      step="0.00000001"
                      (edit)="startEdit(period)"
                      (save)="saveEdit(dist, period, $event)"
                      (cancel)="cancelEdit()"
                      (delete)="deleteValue(dist, period)"
                    />
                  }
                </div>
              </div>
            </div>
          }
        }
      </div>

      @if (filteredGroupedData().length === 0) {
        <div class="text-center py-12 bg-card rounded-lg border border-border">
          <p class="text-muted-foreground">No hay distribuciones OMIE para mostrar</p>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OmieDistributionTabComponent {
  private ratesService = inject(RatesService);
  
  readonly TrendingUpIcon = TrendingUp;
  
  readonly tariffs = input.required<Tariff[]>();
  readonly selectedTariffId = signal<number | null>(null);
  readonly editingPeriod = signal<number | null>(null);
  readonly isSaving = signal<boolean>(false);

  readonly allDistributions = computed(() => {
    const distributions: OmieDistribution[] = [];
    this.tariffs().forEach(tariff => {
      if (tariff.omieDistributions) {
        distributions.push(...tariff.omieDistributions);
      }
    });
    return distributions;
  });

  readonly groupedData = computed(() => {
    const grouped: { tariffCode: string; distributions: OmieDistribution[] }[] = [];
    
    this.tariffs().forEach(tariff => {
      if (tariff.omieDistributions && tariff.omieDistributions.length > 0) {
        grouped.push({
          tariffCode: tariff.code,
          distributions: tariff.omieDistributions,
        });
      }
    });

    return grouped;
  });

  readonly filteredGroupedData = computed(() => {
    const selectedId = this.selectedTariffId();
    if (selectedId === null) {
      return this.groupedData();
    }
    const selectedTariff = this.tariffs().find(t => t.id === selectedId);
    if (!selectedTariff) return [];
    
    return [{
      tariffCode: selectedTariff.code,
      distributions: selectedTariff.omieDistributions || [],
    }];
  });

  onTariffChange(value: any): void {
    // Convertir a número si no es null
    const numValue = value === 'null' || value === null ? null : Number(value);
    this.selectedTariffId.set(numValue);
  }

  sortedPeriods<T extends { period: string }>(periods: T[]): T[] {
    // Extraer el número del string "P1" -> 1, "P2" -> 2, etc.
    return [...periods].sort((a, b) => {
      const numA = parseInt(a.period.substring(1));
      const numB = parseInt(b.period.substring(1));
      return numA - numB;
    });
  }

  startEdit(period: OmieDistributionPeriod): void {
    this.editingPeriod.set(period.id);
  }

  saveEdit(distribution: OmieDistribution, period: OmieDistributionPeriod, newValue: number): void {
    if (this.isSaving()) return;
    
    const originalValue = period.factor;
    this.isSaving.set(true);
    period.factor = newValue;
    
    const updateRequest = {
      period: period.period,  // Ya viene como "P1", "P2", etc.
      factor: period.factor,
      omieDistributionId: distribution.id
    };
    
    this.ratesService.updateOmieDistributionPeriod(period.id, updateRequest).subscribe({
      next: () => {
        console.log('✅ Período OMIE actualizado correctamente');
        this.editingPeriod.set(null);
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('❌ Error al actualizar período OMIE:', err);
        period.factor = originalValue;
        alert('Error al guardar los cambios. Por favor, intente nuevamente.');
        this.isSaving.set(false);
      }
    });
  }

  cancelEdit(): void {
    this.editingPeriod.set(null);
  }

  deleteValue(distribution: OmieDistribution, period: OmieDistributionPeriod): void {
    if (!confirm(`¿Está seguro de eliminar el período ${period.period}?`)) {
      return;
    }
    
    if (this.isSaving()) return;
    this.isSaving.set(true);
    
    this.ratesService.deleteOmieDistributionPeriod(period.id).subscribe({
      next: () => {
        console.log('✅ Período OMIE eliminado correctamente');
        const periodIndex = distribution.periods.findIndex(p => p.id === period.id);
        if (periodIndex > -1) {
          distribution.periods.splice(periodIndex, 1);
        }
        this.editingPeriod.set(null);
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('❌ Error al eliminar período OMIE:', err);
        alert('Error al eliminar el período. Por favor, intente nuevamente.');
        this.isSaving.set(false);
      }
    });
  }
}
