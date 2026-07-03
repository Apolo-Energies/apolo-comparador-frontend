import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Tariff, OmieDistribution, OmieDistributionPeriod } from '../../../../../../entities/provider.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AlertService } from '@apolo-energies/ui';
import { RatesService } from '../../../../../../services/rates.service';
import { PeriodEditorComponent } from '../period-editor/period-editor.component';
import { LucideAngularModule, TrendingUp } from 'lucide-angular';

interface OmieSlot {
  cellId:  string;
  isEmpty: boolean;
  period:  OmieDistributionPeriod;
}

@Component({
  selector: 'app-omie-distribution-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, PeriodEditorComponent, LucideAngularModule],
  templateUrl: './omie-distribution-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OmieDistributionTabComponent {
  private readonly ratesService  = inject(RatesService);
  private readonly alertService  = inject(AlertService);

  readonly TrendingUpIcon = TrendingUp;

  readonly tariffs          = input.required<Tariff[]>();
  readonly selectedTariffId = signal<number | null>(null);
  readonly editingCell      = signal<string | null>(null);
  readonly isSaving         = signal<boolean>(false);

  readonly groupedData = computed(() =>
    this.tariffs()
      .filter(t => t.omieDistributions?.length)
      .map(t => ({ tariffCode: t.code, distributions: t.omieDistributions }))
  );

  readonly filteredGroupedData = computed(() => {
    const id = this.selectedTariffId();
    if (id === null) return this.groupedData();
    const t = this.tariffs().find(t => t.id === id);
    return t ? [{ tariffCode: t.code, distributions: t.omieDistributions ?? [] }] : [];
  });

  onTariffChange(value: any): void {
    this.selectedTariffId.set(value === 'null' || value === null ? null : Number(value));
  }

  prepareSlots(dist: OmieDistribution, tariffCode: string): OmieSlot[] {
    const count = tariffCode.startsWith('2.') ? 3 : 6;
    const map = new Map(dist.periods.map(p => [p.period, p]));
    return Array.from({ length: count }, (_, i) => {
      const num    = i + 1;
      const key    = `P${num}`;
      const found  = map.get(key as any);
      return {
        cellId:  `omie-${dist.id}-${num}`,
        isEmpty: !found,
        period:  found ?? ({
          id: -1,
          period: key,
          factor: 0,
          omieDistributionId: dist.id,
          omieDistribution: null,
        } as any),
      };
    });
  }

  startEdit(period: OmieDistributionPeriod, cellId: string): void {
    this.editingCell.set(cellId);
  }

  saveEdit(distribution: OmieDistribution, period: OmieDistributionPeriod, newValue: number): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    if (period.id === -1) {
      this.ratesService.createOmieDistributionPeriod({
        period: period.period,
        factor: newValue,
        omieDistributionId: distribution.id,
      }).subscribe({
        next: created => {
          distribution.periods.push(created);
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
      const originalValue = period.factor;
      period.factor = newValue;
      this.ratesService.updateOmieDistributionPeriod(period.id, {
        period: period.period,
        factor: newValue,
        omieDistributionId: distribution.id,
      }).subscribe({
        next: () => {
          this.editingCell.set(null);
          this.isSaving.set(false);
          this.alertService.show('Cambios guardados correctamente', 'success');
        },
        error: () => {
          period.factor = originalValue;
          this.isSaving.set(false);
          this.alertService.show('Error al guardar los cambios', 'error');
        },
      });
    }
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  deleteValue(distribution: OmieDistribution, period: OmieDistributionPeriod): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    this.ratesService.deleteOmieDistributionPeriod(period.id).subscribe({
      next: () => {
        distribution.periods = distribution.periods.filter(p => p.id !== period.id);
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
