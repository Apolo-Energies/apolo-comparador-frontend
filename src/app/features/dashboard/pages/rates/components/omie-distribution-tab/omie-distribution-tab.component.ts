import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Tariff, OmieDistribution, OmieDistributionPeriod } from '../../../../../../entities/provider.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RatesService } from '../../../../../../services/rates.service';
import { PeriodEditorComponent } from '../period-editor/period-editor.component';
import { LucideAngularModule, TrendingUp } from 'lucide-angular';

@Component({
  selector: 'app-omie-distribution-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodEditorComponent, LucideAngularModule],
  templateUrl: './omie-distribution-tab.component.html',
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
    const numValue = value === 'null' || value === null ? null : Number(value);
    this.selectedTariffId.set(numValue);
  }

  sortedPeriods<T extends { period: string }>(periods: T[]): T[] {
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
      period: period.period,
      factor: period.factor,
      omieDistributionId: distribution.id
    };

    this.ratesService.updateOmieDistributionPeriod(period.id, updateRequest).subscribe({
      next: () => {
        this.editingPeriod.set(null);
        this.isSaving.set(false);
      },
      error: () => {
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
        const periodIndex = distribution.periods.findIndex(p => p.id === period.id);
        if (periodIndex > -1) {
          distribution.periods.splice(periodIndex, 1);
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
