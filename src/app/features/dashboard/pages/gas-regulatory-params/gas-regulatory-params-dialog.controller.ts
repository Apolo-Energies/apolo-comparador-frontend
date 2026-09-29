import { computed, signal } from '@angular/core';
import { GasRegulatoryParams } from '../../../../core/models/gas-regulatory-params.model';
import { GasRegulatoryParamsService } from '../../../../core/services/gas-regulatory-params.service';
import { DialogMode, FormState, emptyForm, errorMessageOf } from './gas-regulatory-params-page.helpers';

export interface GasRegulatoryParamsDialogDeps {
  service: GasRegulatoryParamsService;
  onSaved: () => void;
  onError: (message: string | null) => void;
}

/**
 * Create/close dialog for a regulatory-params version. Extracted from
 * GasRegulatoryParamsPageComponent to keep it under the file-size guideline (R1).
 */
export class GasRegulatoryParamsDialogController {
  readonly dialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly editingId  = signal<number | null>(null);
  readonly saving     = signal(false);
  readonly form       = signal<FormState>(emptyForm());

  readonly canSubmit = computed(() => {
    const f = this.form();
    if (this.dialogMode() === 'create') {
      return f.fnee != null && f.fnee >= 0
          && f.storage != null && f.storage >= 0
          && f.lossesPercentage != null && f.lossesPercentage >= 0 && f.lossesPercentage < 1
          && f.financialCostPercentage != null && f.financialCostPercentage >= 0 && f.financialCostPercentage < 1
          && f.deviation != null && f.deviation >= 0
          && f.marketTaxPercentage != null && f.marketTaxPercentage >= 0 && f.marketTaxPercentage < 1
          && f.managementCost != null && f.managementCost >= 0
          && !!f.validFrom;
    }
    return !!f.validTo;
  });

  constructor(private readonly deps: GasRegulatoryParamsDialogDeps) {}

  openCreate(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.form.set(emptyForm());
    this.dialogOpen.set(true);
  }

  openClose(row: GasRegulatoryParams): void {
    this.dialogMode.set('close');
    this.editingId.set(row.id);
    this.form.set({
      ...emptyForm(),
      validTo: new Date().toISOString().slice(0, 10),
    });
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
  }

  updateField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    this.form.update(f => ({ ...f, [key]: value }));
  }

  submit(): void {
    if (!this.canSubmit() || this.saving()) return;
    const f = this.form();
    this.saving.set(true);

    const done = () => { this.saving.set(false); this.dialogOpen.set(false); this.deps.onSaved(); };
    const fail = (err: unknown) => { this.saving.set(false); this.deps.onError(errorMessageOf(err)); };

    if (this.dialogMode() === 'create') {
      this.deps.service.create({
        fnee: f.fnee!,
        storage: f.storage!,
        lossesPercentage: f.lossesPercentage!,
        financialCostPercentage: f.financialCostPercentage!,
        deviation: f.deviation!,
        marketTaxPercentage: f.marketTaxPercentage!,
        managementCost: f.managementCost!,
        mibgasOverrideEurPerMwh: f.mibgasOverrideEurPerMwh,
        validFrom: f.validFrom,
        validTo: f.validTo || null,
      }).subscribe({ next: done, error: fail });
      return;
    }
    this.deps.service.close(this.editingId()!, { validTo: f.validTo }).subscribe({ next: done, error: fail });
  }
}
