import { computed, signal } from '@angular/core';
import { AlertService } from '@apolo-energies/ui';
import { RatesService } from '../../../../../../core/services/rates.service';
import { Tariff, ProductType } from '../../../../../../core/models/provider.model';
import {
  EMPTY_SLOTS, expectedCount, tariffById, slotsFromPeriods,
  parsedSection, parsedPowerSection, ProductRow,
} from './products-tab.helpers';

export interface CreateProductDeps {
  ratesService:      RatesService;
  alertService:      AlertService;
  getTariffs:        () => Tariff[];
  getFilterTariffId: () => number | null;
  appendRow:         (row: ProductRow) => void;
  markForCheck:      () => void;
}

/**
 * Owns the "create product" dialog: tariff/type/name selection, energy and
 * power period inputs (with bulk-fill and BOE prefill), validation and the
 * create request (plus an optional commission patch). Extracted from
 * ProductsTabComponent to keep it under the file-size guideline (R1). No
 * behavior change vs. the inline version.
 */
export class CreateProductController {
  constructor(private readonly deps: CreateProductDeps) {}

  readonly createDialog        = signal(false);
  readonly createTariffId      = signal('');
  readonly createName          = signal('');
  readonly createType          = signal<ProductType>('Fixed');
  readonly createComm          = signal('');
  readonly creating            = signal(false);
  readonly createEnergyPeriods = signal<string[]>(EMPTY_SLOTS());
  readonly createPowerPeriods  = signal<string[]>(EMPTY_SLOTS());
  readonly createEnergyBulk    = signal('');
  readonly createPowerBulk     = signal('');

  readonly createTariff      = computed(() => tariffById(this.deps.getTariffs(), Number(this.createTariffId())));
  readonly createPeriodCount = computed(() => expectedCount(this.createTariff()));
  readonly createPeriodIndexes = computed(() =>
    Array.from({ length: this.createPeriodCount() }, (_, i) => i)
  );

  onCreateTariffChange(val: string) {
    this.createTariffId.set(val);
    this.createEnergyPeriods.set(EMPTY_SLOTS());
    this.createPowerPeriods.set(EMPTY_SLOTS());
    this.createEnergyBulk.set('');
    this.createPowerBulk.set('');
  }

  updateCreateEnergyPeriod(index: number, value: string) {
    const periods = [...this.createEnergyPeriods()];
    periods[index] = value;
    this.createEnergyPeriods.set(periods);
  }

  updateCreatePowerPeriod(index: number, value: string) {
    const periods = [...this.createPowerPeriods()];
    periods[index] = value;
    this.createPowerPeriods.set(periods);
  }

  applyCreateEnergyBulk() {
    const val = this.createEnergyBulk().trim();
    if (val === '') return;
    const count = this.createPeriodCount();
    this.createEnergyPeriods.set(EMPTY_SLOTS().map((_, i) => i < count ? val : ''));
  }

  applyCreatePowerBulk() {
    const val = this.createPowerBulk().trim();
    if (val === '') return;
    const count = this.createPeriodCount();
    this.createPowerPeriods.set(EMPTY_SLOTS().map((_, i) => i < count ? val : ''));
  }

  loadCreatePowerFromBoe() {
    const tariff = this.createTariff();
    const boe = tariff?.boePowers?.[0];
    if (!boe?.periods?.length) {
      this.deps.alertService.show('Esta tarifa no tiene potencia BOE configurada', 'error');
      return;
    }
    const slots = slotsFromPeriods(
      boe.periods.map(p => ({ period: p.period, value: p.value }))
    );
    this.createPowerPeriods.set(slots);
  }

  openCreate() {
    const active = this.deps.getFilterTariffId();
    this.createTariffId.set(active ? String(active) : '');
    this.createName.set('');
    this.createType.set('Fixed');
    this.createComm.set('');
    this.createEnergyPeriods.set(EMPTY_SLOTS());
    this.createPowerPeriods.set(EMPTY_SLOTS());
    this.createEnergyBulk.set('');
    this.createPowerBulk.set('');
    this.createDialog.set(true);
  }

  submitCreate() {
    const name     = this.createName().trim();
    const tariffId = Number(this.createTariffId());
    if (!name || !tariffId || this.creating()) return;

    const count = this.createPeriodCount();

    const energy = parsedSection(this.createEnergyPeriods(), count);
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
      this.deps.alertService.show('Debes indicar los precios de energía', 'error');
      return;
    }

    const power = parsedPowerSection(this.createPowerPeriods(), count);
    if (!power.ok) {
      this.deps.alertService.show('Los valores de potencia deben ser números válidos (≥ 0)', 'error');
      return;
    }

    const commDraft  = this.createComm().trim();
    const commission = commDraft === '' ? null : parseFloat(commDraft);
    if (commDraft !== '' && (isNaN(commission!) || commission! < 0 || commission! > 100)) {
      this.deps.alertService.show('El porcentaje debe estar entre 0 y 100', 'error');
      return;
    }

    const type = this.createType();

    this.creating.set(true);
    this.deps.ratesService.createProduct({
      name,
      tariffId,
      type,
      energyPeriods: energy.periods,
      powerPeriods:  power.periods.length ? power.periods : undefined,
    }).subscribe({
      next: product => {
        const tariff = this.deps.getTariffs().find(t => t.id === product.tariffId);
        const newRow: ProductRow = {
          id:                   product.id,
          name:                 product.name,
          tariffId:             product.tariffId,
          tariffCode:           this.deps.getTariffs().find(t => t.id === product.tariffId)?.code ?? '',
          type:                 product.type ?? type,
          isAvailable:          product.isAvailable ?? true,
          commissionPercentage: product.commissionPercentage ?? null,
          energyPeriods:        energy.periods,
          powerPeriods:         power.periods,
        };
        if (commission !== null) {
          this.deps.ratesService.patchCommission(newRow.id, commission).subscribe({
            next: () => { newRow.commissionPercentage = commission; this.deps.markForCheck(); },
          });
        }
        this.deps.appendRow(newRow);
        this.createDialog.set(false);
        this.creating.set(false);
        this.deps.alertService.show('Producto creado correctamente', 'success');
      },
      error: () => {
        this.creating.set(false);
        this.deps.alertService.show('Error al crear el producto', 'error');
      },
    });
  }
}
