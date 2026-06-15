import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GasRegulatoryParamsService } from '../../../../services/gas-regulatory-params.service';
import { GasRegulatoryParams } from '../../../../entities/gas-regulatory-params.model';

type DialogMode = 'create' | 'close';

interface FormState {
  fnee: number | null;
  storage: number | null;
  lossesPercentage: number | null;
  financialCostPercentage: number | null;
  validFrom: string;
  validTo: string;
}

@Component({
  selector: 'app-gas-regulatory-params-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
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
  readonly form         = signal<FormState>(this.emptyForm());

  readonly canSubmit = computed(() => {
    const f = this.form();
    if (this.dialogMode() === 'create') {
      return f.fnee != null && f.fnee >= 0
          && f.storage != null && f.storage >= 0
          && f.lossesPercentage != null && f.lossesPercentage >= 0 && f.lossesPercentage < 1
          && f.financialCostPercentage != null && f.financialCostPercentage >= 0 && f.financialCostPercentage < 1
          && !!f.validFrom;
    }
    return !!f.validTo;
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

  private emptyForm(): FormState {
    return {
      fnee: null,
      storage: null,
      lossesPercentage: null,
      financialCostPercentage: null,
      validFrom: new Date().toISOString().slice(0, 10),
      validTo: '',
    };
  }

  private errorOf(err: unknown): string {
    const anyErr = err as { error?: { error?: string }, message?: string };
    return anyErr?.error?.error ?? anyErr?.message ?? 'Error desconocido';
  }
}
