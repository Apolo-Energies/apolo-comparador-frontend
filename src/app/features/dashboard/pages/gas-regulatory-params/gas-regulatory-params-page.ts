import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@apolo-energies/ui';
import { StarIcon, UiIconSource } from '@apolo-energies/icons';
import { GasRegulatoryParamsService } from '../../../../services/gas-regulatory-params.service';
import { GasRegulatoryParams } from '../../../../entities/gas-regulatory-params.model';

type DialogMode = 'create' | 'close';

interface FormState {
  fnee: number | null;
  storage: number | null;
  lossesPercentage: number | null;
  financialCostPercentage: number | null;
  deviation: number | null;
  marketTaxPercentage: number | null;
  managementCost: number | null;
  mibgasOverrideEurPerMwh: number | null;
  validFrom: string;
  validTo: string;
}

// Inline edit shows percentages as 0-100 (matches column headers) instead of
// the 0-1 fractions stored in the domain — we convert on save.
interface InlineEditForm {
  fnee: number | null;
  storage: number | null;
  lossesPercent: number | null;
  financialCostPercent: number | null;
  deviation: number | null;
  marketTaxPercent: number | null;
  managementCost: number | null;
  mibgasOverrideEurPerMwh: number | null;
}

@Component({
  selector: 'app-gas-regulatory-params-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './gas-regulatory-params-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GasRegulatoryParamsPageComponent {
  private readonly service = inject(GasRegulatoryParamsService);

  readonly loading      = signal(false);
  readonly saving       = signal(false);
  readonly rows         = signal<GasRegulatoryParams[]>([]);
  readonly errorMessage = signal<string | null>(null);

  readonly dialogOpen   = signal(false);
  readonly dialogMode   = signal<DialogMode>('create');
  readonly editingId    = signal<number | null>(null);

  readonly starIcon: UiIconSource = { type: 'apolo', icon: StarIcon, size: 16 };
  readonly form         = signal<FormState>(this.emptyForm());

  readonly inlineEditingRowId = signal<number | null>(null);
  readonly inlineForm         = signal<InlineEditForm>(this.emptyInlineForm());
  readonly inlineSaving       = signal(false);

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

  readonly canSaveInline = computed(() => {
    const f = this.inlineForm();
    return f.fnee != null && f.fnee >= 0
        && f.storage != null && f.storage >= 0
        && f.deviation != null && f.deviation >= 0
        && f.managementCost != null && f.managementCost >= 0
        && f.lossesPercent != null && f.lossesPercent >= 0 && f.lossesPercent < 100
        && f.financialCostPercent != null && f.financialCostPercent >= 0 && f.financialCostPercent < 100
        && f.marketTaxPercent != null && f.marketTaxPercent >= 0 && f.marketTaxPercent < 100
        && (f.mibgasOverrideEurPerMwh == null || f.mibgasOverrideEurPerMwh >= 0);
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service.list().subscribe({
      next: rows => { this.rows.set(rows); this.loading.set(false); },
      error: err => { this.errorMessage.set(this.errorOf(err)); this.loading.set(false); },
    });
  }

  openCreate(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.form.set(this.emptyForm());
    this.dialogOpen.set(true);
  }

  openClose(row: GasRegulatoryParams): void {
    this.dialogMode.set('close');
    this.editingId.set(row.id);
    this.form.set({
      ...this.emptyForm(),
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

    const done = () => { this.saving.set(false); this.dialogOpen.set(false); this.reload(); };
    const fail = (err: unknown) => { this.saving.set(false); this.errorMessage.set(this.errorOf(err)); };

    if (this.dialogMode() === 'create') {
      this.service.create({
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
    this.service.close(this.editingId()!, { validTo: f.validTo }).subscribe({ next: done, error: fail });
  }

  isActive(row: GasRegulatoryParams): boolean {
    return row.validTo == null;
  }

  isEditingInline(row: GasRegulatoryParams): boolean {
    return this.inlineEditingRowId() === row.id;
  }

  startInlineEdit(row: GasRegulatoryParams): void {
    if (!this.isActive(row)) return;
    this.errorMessage.set(null);
    this.inlineEditingRowId.set(row.id);
    this.inlineForm.set({
      fnee: row.fnee,
      storage: row.storage,
      lossesPercent: this.toPercent(row.lossesPercentage),
      financialCostPercent: this.toPercent(row.financialCostPercentage),
      deviation: row.deviation,
      marketTaxPercent: this.toPercent(row.marketTaxPercentage),
      managementCost: row.managementCost,
      mibgasOverrideEurPerMwh: row.mibgasOverrideEurPerMwh,
    });
  }

  cancelInlineEdit(): void {
    if (this.inlineSaving()) return;
    this.inlineEditingRowId.set(null);
    this.inlineForm.set(this.emptyInlineForm());
  }

  updateInlineField<K extends keyof InlineEditForm>(key: K, value: InlineEditForm[K]): void {
    this.inlineForm.update(f => ({ ...f, [key]: value }));
  }

  saveInlineEdit(): void {
    const id = this.inlineEditingRowId();
    if (id == null || !this.canSaveInline() || this.inlineSaving()) return;
    const f = this.inlineForm();
    this.inlineSaving.set(true);
    this.errorMessage.set(null);

    this.service.update(id, {
      fnee: f.fnee!,
      storage: f.storage!,
      lossesPercentage: this.fromPercent(f.lossesPercent!),
      financialCostPercentage: this.fromPercent(f.financialCostPercent!),
      deviation: f.deviation!,
      marketTaxPercentage: this.fromPercent(f.marketTaxPercent!),
      managementCost: f.managementCost!,
      mibgasOverrideEurPerMwh: f.mibgasOverrideEurPerMwh,
    }).subscribe({
      next: () => {
        this.inlineSaving.set(false);
        this.inlineEditingRowId.set(null);
        this.inlineForm.set(this.emptyInlineForm());
        this.reload();
      },
      error: err => {
        this.inlineSaving.set(false);
        this.errorMessage.set(this.errorOf(err));
      },
    });
  }

  private toPercent(fraction: number): number {
    return Math.round(fraction * 100 * 10000) / 10000;
  }

  private fromPercent(percent: number): number {
    return Math.round(percent / 100 * 1_000_000) / 1_000_000;
  }

  private emptyInlineForm(): InlineEditForm {
    return {
      fnee: null,
      storage: null,
      lossesPercent: null,
      financialCostPercent: null,
      deviation: null,
      marketTaxPercent: null,
      managementCost: null,
      mibgasOverrideEurPerMwh: null,
    };
  }

  private emptyForm(): FormState {
    return {
      fnee: null,
      storage: null,
      lossesPercentage: null,
      financialCostPercentage: null,
      deviation: null,
      marketTaxPercentage: null,
      managementCost: null,
      mibgasOverrideEurPerMwh: null,
      validFrom: new Date().toISOString().slice(0, 10),
      validTo: '',
    };
  }

  private errorOf(err: unknown): string {
    const anyErr = err as { error?: { error?: string }, message?: string };
    return anyErr?.error?.error ?? anyErr?.message ?? 'Error desconocido';
  }
}
