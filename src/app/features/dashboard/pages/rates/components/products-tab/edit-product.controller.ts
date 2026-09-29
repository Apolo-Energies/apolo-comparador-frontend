import { computed, signal, WritableSignal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { RatesService } from '../../../../../../core/services/rates.service';
import { Tariff, ProductType } from '../../../../../../core/models/provider.model';
import {
  EMPTY_SLOTS, expectedCount, tariffById, slotsFromPeriods,
  parsedSection, parsedPowerSection, ProductRow,
} from './products-tab.helpers';

export interface EditProductDeps {
  ratesService: RatesService;
  alertService: AlertService;
  getTariffs:   () => Tariff[];
  savingIds:    WritableSignal<Set<number>>;
  updateRow:    (id: number, patch: Partial<ProductRow>) => void;
}

/**
 * Owns the "edit product" dialog: prefilling energy/power period slots from
 * an existing row, bulk-fill and BOE prefill, validation and the update
 * request (plus an optional commission patch). Extracted from
 * ProductsTabComponent to keep it under the file-size guideline (R1). No
 * behavior change vs. the inline version. Shares the `savingIds` signal with
 * the delete/toggle controller so a row cannot be edited while another
 * mutation on it is in flight.
 */
export class EditProductController {
  constructor(private readonly deps: EditProductDeps) {}

  readonly editDialog        = signal(false);
  readonly editRow           = signal<ProductRow | null>(null);
  readonly editName          = signal('');
  readonly editType          = signal<ProductType>('Fixed');
  readonly editComm          = signal('');
  readonly editEnergyPeriods = signal<string[]>(EMPTY_SLOTS());
  readonly editPowerPeriods  = signal<string[]>(EMPTY_SLOTS());
  readonly editEnergyBulk    = signal('');
  readonly editPowerBulk     = signal('');

  readonly editTariff      = computed(() => tariffById(this.deps.getTariffs(), this.editRow()?.tariffId));
  readonly editPeriodCount = computed(() => expectedCount(this.editTariff()));
  readonly editPeriodIndexes = computed(() =>
    Array.from({ length: this.editPeriodCount() }, (_, i) => i)
  );

  updateEditEnergyPeriod(index: number, value: string) {
    const periods = [...this.editEnergyPeriods()];
    periods[index] = value;
    this.editEnergyPeriods.set(periods);
  }

  updateEditPowerPeriod(index: number, value: string) {
    const periods = [...this.editPowerPeriods()];
    periods[index] = value;
    this.editPowerPeriods.set(periods);
  }

  applyEditEnergyBulk() {
    const val = this.editEnergyBulk().trim();
    if (val === '') return;
    const count = this.editPeriodCount();
    this.editEnergyPeriods.set(EMPTY_SLOTS().map((_, i) => i < count ? val : ''));
  }

  applyEditPowerBulk() {
    const val = this.editPowerBulk().trim();
    if (val === '') return;
    const count = this.editPeriodCount();
    this.editPowerPeriods.set(EMPTY_SLOTS().map((_, i) => i < count ? val : ''));
  }

  loadEditPowerFromBoe() {
    const tariff = this.editTariff();
    const boe = tariff?.boePowers?.[0];
    if (!boe?.periods?.length) {
      this.deps.alertService.show('Esta tarifa no tiene potencia BOE configurada', 'error');
      return;
    }
    const slots = slotsFromPeriods(
      boe.periods.map(p => ({ period: p.period, value: p.value }))
    );
    this.editPowerPeriods.set(slots);
  }

  openEdit(row: ProductRow) {
    this.editRow.set(row);
    this.editName.set(row.name);
    this.editType.set(row.type);
    this.editComm.set(row.commissionPercentage !== null ? String(row.commissionPercentage) : '');
    this.editEnergyPeriods.set(slotsFromPeriods(row.energyPeriods));
    this.editPowerPeriods.set(slotsFromPeriods(row.powerPeriods));
    this.editEnergyBulk.set('');
    this.editPowerBulk.set('');
    this.editDialog.set(true);
  }

  submitEdit(row: ProductRow) {
    const name = this.editName().trim();
    if (!name || this.deps.savingIds().has(row.id)) return;

    const count = this.editPeriodCount();

    const energy = parsedSection(this.editEnergyPeriods(), count);
    if (!energy.ok) {
      this.deps.alertService.show(
        energy.reason === 'partial'
          ? `Completa los ${count} períodos de energía`
          : 'Los valores de energía deben ser números válidos (≥ 0)',
        'error'
      );
      return;
    }
    if (energy.periods.length === 0) {
      this.deps.alertService.show('Los precios de energía no pueden quedar vacíos', 'error');
      return;
    }

    const power = parsedPowerSection(this.editPowerPeriods(), count);
    if (!power.ok) {
      this.deps.alertService.show('Los valores de potencia deben ser números válidos (≥ 0)', 'error');
      return;
    }

    const commDraft  = this.editComm().trim();
    const commission = commDraft === '' ? null : parseFloat(commDraft);
    if (commDraft !== '' && (isNaN(commission!) || commission! < 0 || commission! > 100)) {
      this.deps.alertService.show('El porcentaje debe estar entre 0 y 100', 'error');
      return;
    }

    this.deps.savingIds.update(s => new Set(s).add(row.id));
    const removeSaving = () => this.deps.savingIds.update(s => { const n = new Set(s); n.delete(row.id); return n; });

    const commRequest$ = commission !== row.commissionPercentage
      ? this.deps.ratesService.patchCommission(row.id, commission)
      : null;

    const type = this.editType();

    const finish = () => {
      this.deps.updateRow(row.id, {
        name, type, commissionPercentage: commission,
        energyPeriods: energy.periods, powerPeriods: power.periods,
      });
      this.editDialog.set(false);
      removeSaving();
      this.deps.alertService.show('Producto actualizado', 'success');
    };

    this.deps.ratesService.updateProduct(row.id, {
      name,
      type,
      energyPeriods: energy.periods,
      powerPeriods:  power.periods.length ? power.periods : undefined,
    }).subscribe({
      next: () => {
        if (commRequest$) {
          commRequest$.subscribe({
            next:  finish,
            error: () => { removeSaving(); this.deps.alertService.show('Error al guardar la comisión', 'error'); },
          });
        } else {
          finish();
        }
      },
      error: () => { removeSaving(); this.deps.alertService.show('Error al guardar el producto', 'error'); },
    });
  }
}
