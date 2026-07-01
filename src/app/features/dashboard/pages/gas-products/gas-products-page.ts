import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@apolo-energies/ui';
import { StarIcon, UiIconSource } from '@apolo-energies/icons';
import { GasProductService } from '../../../../services/gas-product.service';
import { GasProduct, GasProductType } from '../../../../entities/gas-product.model';

type DialogMode = 'create' | 'edit';

interface FormState {
  id:            number | null;
  tariffCode:    string;
  name:          string;
  type:          GasProductType;
  precioEnergia: number | null;
  precioFijoDia: number | null;
  isAvailable:   boolean;
  feeLocked:     boolean;
}

const TARIFF_CODES = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6'] as const;

@Component({
  selector: 'app-gas-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './gas-products-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GasProductsPageComponent {
  private readonly service = inject(GasProductService);

  readonly loading      = signal(false);
  readonly saving       = signal(false);
  readonly rows         = signal<GasProduct[]>([]);
  readonly filterTariff = signal<string>('');
  readonly errorMessage = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('create');
  readonly form       = signal<FormState>(this.emptyForm());

  readonly TARIFF_CODES = TARIFF_CODES;
  readonly PRODUCT_TYPES = [
    { value: GasProductType.Fixed, label: 'Fijo (Fixed)' },
    { value: GasProductType.Indexed, label: 'Indexado (Indexed)' },
  ];

  readonly starIcon: UiIconSource = { type: 'apolo', icon: StarIcon, size: 16 };

  readonly visibleRows = computed(() => {
    const t = this.filterTariff();
    return t ? this.rows().filter(r => r.tariffCode === t) : this.rows();
  });

  readonly canSubmit = computed(() => {
    const f = this.form();
    return !!f.tariffCode
      && !!f.name.trim()
      && f.precioEnergia != null && f.precioEnergia >= 0
      && f.precioFijoDia != null && f.precioFijoDia >= 0;
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

  onFilterTariff(value: string): void {
    this.filterTariff.set(value);
  }

  openCreate(): void {
    this.dialogMode.set('create');
    this.form.set(this.emptyForm());
    this.dialogOpen.set(true);
  }

  openEdit(row: GasProduct): void {
    this.dialogMode.set('edit');
    this.form.set({
      id:            row.id,
      tariffCode:    row.tariffCode,
      name:          row.name,
      type:          row.type,
      precioEnergia: row.precioEnergia,
      precioFijoDia: row.precioFijoDia,
      isAvailable:   row.isAvailable,
      feeLocked:     row.feeLocked,
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
        tariffCode:    f.tariffCode,
        name:          f.name.trim(),
        type:          f.type,
        precioEnergia: f.precioEnergia!,
        precioFijoDia: f.precioFijoDia!,
        isAvailable:   f.isAvailable,
        feeLocked:     f.feeLocked,
      }).subscribe({ next: done, error: fail });
    } else {
      this.service.update(f.id!, {
        name:          f.name.trim(),
        type:          f.type,
        precioEnergia: f.precioEnergia!,
        precioFijoDia: f.precioFijoDia!,
        isAvailable:   f.isAvailable,
        feeLocked:     f.feeLocked,
      }).subscribe({ next: done, error: fail });
    }
  }

  delete(row: GasProduct): void {
    if (!confirm(`¿Eliminar el producto "${row.name}" de la tarifa ${row.tariffCode}? Esta acción no se puede deshacer.`)) return;
    this.saving.set(true);
    this.service.delete(row.id).subscribe({
      next: () => { this.saving.set(false); this.reload(); },
      error: err => { this.saving.set(false); this.errorMessage.set(this.errorOf(err)); },
    });
  }

  typeLabel(t: GasProductType): string {
    return t === GasProductType.Indexed ? 'Indexado' : 'Fijo';
  }

  private emptyForm(): FormState {
    return {
      id:            null,
      tariffCode:    'R1',
      name:          '',
      type:          GasProductType.Fixed,
      precioEnergia: null,
      precioFijoDia: null,
      isAvailable:   true,
      feeLocked:     false,
    };
  }

  private errorOf(err: unknown): string {
    const anyErr = err as { error?: { error?: string }, message?: string };
    return anyErr?.error?.error ?? anyErr?.message ?? 'Error desconocido';
  }
}
