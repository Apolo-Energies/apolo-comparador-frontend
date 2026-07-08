import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@apolo-energies/ui';
import { StarIcon, UiIconSource } from '@apolo-energies/icons';
import { GasAccessTariffService } from '../../../../services/gas-access-tariff.service';
import { GasAccessTariff } from '../../../../entities/gas-access-tariff.model';

type DialogMode = 'create' | 'updatePrices' | 'updateMargin' | 'close';

interface FormState {
  code: string;
  minAnnualKwh: number | null;
  maxAnnualKwh: number | null;
  fixedTermPerYear: number | null;
  atrVariable: number | null;
  /** FEE margen comercial - guardado como porcentaje en UI (40 = 40%). Se convierte a decimal (0.40) al enviar al API. */
  commercialMarginPercent: number | null;
  validFrom: string;
  validTo: string;
}

@Component({
  selector: 'app-gas-access-tariffs-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './gas-access-tariffs-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GasAccessTariffsPageComponent {
  private readonly service = inject(GasAccessTariffService);

  readonly loading       = signal(false);
  readonly saving        = signal(false);
  readonly rows          = signal<GasAccessTariff[]>([]);
  readonly onlyActive    = signal(false);
  readonly errorMessage  = signal<string | null>(null);

  readonly dialogOpen   = signal(false);
  readonly dialogMode   = signal<DialogMode>('create');
  readonly editingId    = signal<number | null>(null);
  readonly form         = signal<FormState>(this.emptyForm());

  readonly starIcon: UiIconSource = { type: 'apolo', icon: StarIcon, size: 16 };

  readonly visibleRows = computed(() => this.rows());

  readonly canSubmit = computed(() => {
    const mode = this.dialogMode();
    const f = this.form();
    if (mode === 'create') {
      return !!f.code.trim()
        && f.minAnnualKwh != null && f.minAnnualKwh >= 0
        && f.fixedTermPerYear != null && f.fixedTermPerYear >= 0
        && f.atrVariable != null && f.atrVariable >= 0
        && f.commercialMarginPercent != null && f.commercialMarginPercent >= 0
        && !!f.validFrom;
    }
    if (mode === 'updatePrices') {
      return f.fixedTermPerYear != null && f.fixedTermPerYear >= 0
          && f.atrVariable != null && f.atrVariable >= 0;
    }
    if (mode === 'updateMargin') {
      return f.commercialMarginPercent != null && f.commercialMarginPercent >= 0;
    }
    return !!f.validTo;
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service.list(this.onlyActive()).subscribe({
      next: rows => { this.rows.set(rows); this.loading.set(false); },
      error: err => { this.errorMessage.set(this.errorOf(err)); this.loading.set(false); },
    });
  }

  toggleActiveOnly(): void {
    this.onlyActive.update(v => !v);
    this.reload();
  }

  openCreate(): void {
    this.dialogMode.set('create');
    this.editingId.set(null);
    this.form.set(this.emptyForm());
    this.dialogOpen.set(true);
  }

  openUpdatePrices(row: GasAccessTariff): void {
    this.dialogMode.set('updatePrices');
    this.editingId.set(row.id);
    this.form.set({
      ...this.emptyForm(),
      code: row.code,
      fixedTermPerYear: row.fixedTermPerYear,
      atrVariable: row.atrVariable,
    });
    this.dialogOpen.set(true);
  }

  openUpdateMargin(row: GasAccessTariff): void {
    this.dialogMode.set('updateMargin');
    this.editingId.set(row.id);
    this.form.set({
      ...this.emptyForm(),
      code: row.code,
      commercialMarginPercent: this.toPercent(row.commercialMarginPercentage),
    });
    this.dialogOpen.set(true);
  }

  openClose(row: GasAccessTariff): void {
    this.dialogMode.set('close');
    this.editingId.set(row.id);
    this.form.set({
      ...this.emptyForm(),
      code: row.code,
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
    const mode = this.dialogMode();
    this.saving.set(true);

    const done = () => { this.saving.set(false); this.dialogOpen.set(false); this.reload(); };
    const fail = (err: unknown) => { this.saving.set(false); this.errorMessage.set(this.errorOf(err)); };

    if (mode === 'create') {
      this.service.create({
        code: f.code.trim(),
        minAnnualKwh: f.minAnnualKwh!,
        maxAnnualKwh: f.maxAnnualKwh,
        fixedTermPerYear: f.fixedTermPerYear!,
        atrVariable: f.atrVariable!,
        commercialMarginPercentage: this.toDecimal(f.commercialMarginPercent!),
        validFrom: f.validFrom,
        validTo: f.validTo || null,
      }).subscribe({ next: done, error: fail });
      return;
    }
    if (mode === 'updatePrices') {
      this.service.updatePrices(this.editingId()!, {
        fixedTermPerYear: f.fixedTermPerYear!,
        atrVariable: f.atrVariable!,
      }).subscribe({ next: done, error: fail });
      return;
    }
    if (mode === 'updateMargin') {
      this.service.updateMargin(this.editingId()!, {
        commercialMarginPercentage: this.toDecimal(f.commercialMarginPercent!),
      }).subscribe({ next: done, error: fail });
      return;
    }
    this.service.close(this.editingId()!, { validTo: f.validTo }).subscribe({ next: done, error: fail });
  }

  isActive(row: GasAccessTariff): boolean {
    return row.validTo == null;
  }

  /** decimal (0.40) -> percent (40) para mostrar/editar en UI */
  private toPercent(decimal: number): number {
    return Math.round(decimal * 10000) / 100;
  }

  /** percent (40) -> decimal (0.40) para enviar al API */
  private toDecimal(percent: number): number {
    return Math.round(percent * 100) / 10000;
  }

  private emptyForm(): FormState {
    return {
      code: '',
      minAnnualKwh: null,
      maxAnnualKwh: null,
      fixedTermPerYear: null,
      atrVariable: null,
      commercialMarginPercent: null,
      validFrom: new Date().toISOString().slice(0, 10),
      validTo: '',
    };
  }

  private errorOf(err: unknown): string {
    const anyErr = err as { error?: { error?: string }, message?: string };
    return anyErr?.error?.error ?? anyErr?.message ?? 'Error desconocido';
  }
}
