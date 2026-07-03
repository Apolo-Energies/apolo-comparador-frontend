import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Tariff, BoePower, BoePowerPeriod } from '../../../../../../entities/provider.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService } from '@apolo-energies/ui';
import { RatesService } from '../../../../../../services/rates.service';
import { PeriodEditorComponent } from '../period-editor/period-editor.component';
import { LucideAngularModule, Zap } from 'lucide-angular';

interface BoeSlot {
  cellId:  string;
  isEmpty: boolean;
  period:  BoePowerPeriod;
}

@Component({
  selector: 'app-boe-power-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodEditorComponent, LucideAngularModule],
  templateUrl: './boe-power-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoePowerTabComponent {
  private readonly ratesService = inject(RatesService);
  private readonly alertService = inject(AlertService);

  readonly ZapIcon = Zap;

  readonly tariffs          = input.required<Tariff[]>();
  readonly selectedTariffId = signal<number | null>(null);
  readonly editingCell      = signal<string | null>(null);
  readonly isSaving         = signal<boolean>(false);

  readonly groupedData = computed(() =>
    this.tariffs()
      .filter(t => t.boePowers?.length)
      .map(t => ({ tariffCode: t.code, powers: t.boePowers }))
  );

  readonly filteredGroupedData = computed(() => {
    const id = this.selectedTariffId();
    if (id === null) return this.groupedData();
    const t = this.tariffs().find(t => t.id === id);
    return t ? [{ tariffCode: t.code, powers: t.boePowers ?? [] }] : [];
  });

  onTariffChange(value: any): void {
    this.selectedTariffId.set(value === 'null' || value === null ? null : Number(value));
  }

  prepareSlots(power: BoePower, tariffCode: string): BoeSlot[] {
    const count = tariffCode.startsWith('2.') ? 3 : 6;
    const map = new Map(power.periods.map(p => [p.period, p]));
    return Array.from({ length: count }, (_, i) => {
      const num   = i + 1;
      const key   = `P${num}`;
      const found = map.get(key as any);
      return {
        cellId:  `boe-${power.id}-${num}`,
        isEmpty: !found,
        period:  found ?? ({
          id: -1,
          period: key,
          value: 0,
          boePowerId: power.id,
          boePower: null,
        } as any),
      };
    });
  }

  startEdit(period: BoePowerPeriod, cellId: string): void {
    this.editingCell.set(cellId);
  }

  saveEdit(boePower: BoePower, period: BoePowerPeriod, newValue: number): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    if (period.id === -1) {
      this.ratesService.createBoePowerPeriod({
        period: period.period,
        value: newValue,
        boePowerId: boePower.id,
      }).subscribe({
        next: created => {
          boePower.periods.push(created);
          this.editingCell.set(null);
          this.isSaving.set(false);
          this.alertService.show(`${period.period} agregado correctamente`, 'success');
        },
        error: () => {
          this.isSaving.set(false);
          this.alertService.show(`Error al agregar ${period.period}`, 'error');
        },
      });
    } else {
      const originalValue = period.value;
      period.value = newValue;
      this.ratesService.updateBoePowerPeriod(period.id, {
        period: period.period,
        value: newValue,
        boePowerId: boePower.id,
      }).subscribe({
        next: () => {
          this.editingCell.set(null);
          this.isSaving.set(false);
          this.alertService.show('Cambios guardados correctamente', 'success');
        },
        error: () => {
          period.value = originalValue;
          this.isSaving.set(false);
          this.alertService.show('Error al guardar los cambios', 'error');
        },
      });
    }
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  deleteValue(boePower: BoePower, period: BoePowerPeriod): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    this.ratesService.deleteBoePowerPeriod(period.id).subscribe({
      next: () => {
        boePower.periods = boePower.periods.filter(p => p.id !== period.id);
        this.editingCell.set(null);
        this.isSaving.set(false);
        this.alertService.show(`${period.period} eliminado`, 'success');
      },
      error: () => {
        this.isSaving.set(false);
        this.alertService.show('Error al eliminar el período', 'error');
      },
    });
  }
}
