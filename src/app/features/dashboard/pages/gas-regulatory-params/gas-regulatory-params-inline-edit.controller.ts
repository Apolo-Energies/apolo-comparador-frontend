import { computed, signal } from '@angular/core';
import { GasRegulatoryParams } from '../../../../core/models/gas-regulatory-params.model';
import { GasRegulatoryParamsService } from '../../../../core/services/gas-regulatory-params.service';
import {
  InlineEditForm, emptyInlineForm, errorMessageOf, fromPercent, isActiveParams, toPercent,
} from './gas-regulatory-params-page.helpers';

export interface GasRegulatoryParamsInlineEditDeps {
  service: GasRegulatoryParamsService;
  onSaved: () => void;
  onError: (message: string | null) => void;
}

/**
 * Inline row editing (percentages shown as 0-100, converted to 0-1 fractions
 * on save) for the regulatory-params table. Extracted from
 * GasRegulatoryParamsPageComponent to keep it under the file-size guideline (R1).
 */
export class GasRegulatoryParamsInlineEditController {
  readonly editingRowId = signal<number | null>(null);
  readonly form         = signal<InlineEditForm>(emptyInlineForm());
  readonly saving       = signal(false);

  readonly canSave = computed(() => {
    const f = this.form();
    return f.fnee != null && f.fnee >= 0
        && f.storage != null && f.storage >= 0
        && f.deviation != null && f.deviation >= 0
        && f.managementCost != null && f.managementCost >= 0
        && f.lossesPercent != null && f.lossesPercent >= 0 && f.lossesPercent < 100
        && f.financialCostPercent != null && f.financialCostPercent >= 0 && f.financialCostPercent < 100
        && f.marketTaxPercent != null && f.marketTaxPercent >= 0 && f.marketTaxPercent < 100
        && (f.mibgasOverrideEurPerMwh == null || f.mibgasOverrideEurPerMwh >= 0);
  });

  constructor(private readonly deps: GasRegulatoryParamsInlineEditDeps) {}

  isEditing(row: GasRegulatoryParams): boolean {
    return this.editingRowId() === row.id;
  }

  start(row: GasRegulatoryParams): void {
    if (!isActiveParams(row)) return;
    this.deps.onError(null);
    this.editingRowId.set(row.id);
    this.form.set({
      fnee: row.fnee,
      storage: row.storage,
      lossesPercent: toPercent(row.lossesPercentage),
      financialCostPercent: toPercent(row.financialCostPercentage),
      deviation: row.deviation,
      marketTaxPercent: toPercent(row.marketTaxPercentage),
      managementCost: row.managementCost,
      mibgasOverrideEurPerMwh: row.mibgasOverrideEurPerMwh,
    });
  }

  cancel(): void {
    if (this.saving()) return;
    this.editingRowId.set(null);
    this.form.set(emptyInlineForm());
  }

  updateField<K extends keyof InlineEditForm>(key: K, value: InlineEditForm[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  save(): void {
    const id = this.editingRowId();
    if (id == null || !this.canSave() || this.saving()) return;
    const f = this.form();
    this.saving.set(true);
    this.deps.onError(null);

    this.deps.service.update(id, {
      fnee: f.fnee!,
      storage: f.storage!,
      lossesPercentage: fromPercent(f.lossesPercent!),
      financialCostPercentage: fromPercent(f.financialCostPercent!),
      deviation: f.deviation!,
      marketTaxPercentage: fromPercent(f.marketTaxPercent!),
      managementCost: f.managementCost!,
      mibgasOverrideEurPerMwh: f.mibgasOverrideEurPerMwh,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingRowId.set(null);
        this.form.set(emptyInlineForm());
        this.deps.onSaved();
      },
      error: err => {
        this.saving.set(false);
        this.deps.onError(errorMessageOf(err));
      },
    });
  }
}
