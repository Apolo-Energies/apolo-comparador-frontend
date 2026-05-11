import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Tariff, BoePower, BoePowerPeriod } from '../../../../../../entities/provider.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RatesService } from '../../../../../../services/rates.service';
import { PeriodEditorComponent } from '../period-editor/period-editor.component';
import { LucideAngularModule, Zap } from 'lucide-angular';

@Component({
  selector: 'app-boe-power-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodEditorComponent, LucideAngularModule],
  templateUrl: './boe-power-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoePowerTabComponent {
  private ratesService = inject(RatesService);

  readonly ZapIcon = Zap;

  readonly tariffs = input.required<Tariff[]>();
  readonly selectedTariffId = signal<number | null>(null);
  readonly editingPeriod = signal<number | null>(null);
  readonly isSaving = signal<boolean>(false);

  readonly allBoePowers = computed(() => {
    const powers: BoePower[] = [];
    this.tariffs().forEach(tariff => {
      if (tariff.boePowers) {
        powers.push(...tariff.boePowers);
      }
    });
    return powers;
  });

  readonly groupedData = computed(() => {
    const grouped: { tariffCode: string; powers: BoePower[] }[] = [];

    this.tariffs().forEach(tariff => {
      if (tariff.boePowers && tariff.boePowers.length > 0) {
        grouped.push({
          tariffCode: tariff.code,
          powers: tariff.boePowers,
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
      powers: selectedTariff.boePowers || [],
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

  startEdit(period: BoePowerPeriod): void {
    this.editingPeriod.set(period.id);
  }

  saveEdit(boePower: BoePower, period: BoePowerPeriod, newValue: number): void {
    if (this.isSaving()) return;

    const originalValue = period.value;
    this.isSaving.set(true);
    period.value = newValue;

    const updateRequest = {
      period: period.period,
      value: period.value,
      boePowerId: boePower.id
    };

    this.ratesService.updateBoePowerPeriod(period.id, updateRequest).subscribe({
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

  deleteValue(boePower: BoePower, period: BoePowerPeriod): void {
    if (!confirm(`¿Está seguro de eliminar el período ${period.period}?`)) {
      return;
    }

    if (this.isSaving()) return;
    this.isSaving.set(true);

    this.ratesService.deleteBoePowerPeriod(period.id).subscribe({
      next: () => {
        const periodIndex = boePower.periods.findIndex(p => p.id === period.id);
        if (periodIndex > -1) {
          boePower.periods.splice(periodIndex, 1);
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
