import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@apolo-energies/ui';
import { GasApoloProductService } from '../../../../services/gas-apolo-product.service';
import { GasApoloProduct } from '../../../../entities/gas-apolo-product.model';

type DialogMode = 'editMargin' | 'editName';

interface FormState {
  marginEurPerMwh: number | null;
  name: string;
}

@Component({
  selector: 'app-gas-apolo-products-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './gas-apolo-products-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GasApoloProductsPageComponent {
  private readonly service = inject(GasApoloProductService);

  readonly loading      = signal(false);
  readonly saving       = signal(false);
  readonly rows         = signal<GasApoloProduct[]>([]);
  readonly errorMessage = signal<string | null>(null);

  readonly dialogOpen = signal(false);
  readonly dialogMode = signal<DialogMode>('editMargin');
  readonly editingId  = signal<number | null>(null);

  readonly form = signal<FormState>({ marginEurPerMwh: null, name: '' });

  readonly canSubmit = computed(() => {
    const f = this.form();
    if (this.dialogMode() === 'editMargin') {
      return f.marginEurPerMwh != null && f.marginEurPerMwh >= 0;
    }
    return f.name.trim().length > 0;
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

  openEditMargin(row: GasApoloProduct): void {
    this.dialogMode.set('editMargin');
    this.editingId.set(row.productId);
    this.form.set({ marginEurPerMwh: row.marginEurPerMwh, name: row.productName });
    this.dialogOpen.set(true);
  }

  openEditName(row: GasApoloProduct): void {
    this.dialogMode.set('editName');
    this.editingId.set(row.productId);
    this.form.set({ marginEurPerMwh: row.marginEurPerMwh, name: row.productName });
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
    const f  = this.form();
    const id = this.editingId()!;
    this.saving.set(true);

    const done = () => { this.saving.set(false); this.dialogOpen.set(false); this.reload(); };
    const fail = (err: unknown) => { this.saving.set(false); this.errorMessage.set(this.errorOf(err)); };

    if (this.dialogMode() === 'editMargin') {
      this.service.updateMargin(id, f.marginEurPerMwh!).subscribe({ next: done, error: fail });
    } else {
      this.service.updateName(id, f.name.trim()).subscribe({ next: done, error: fail });
    }
  }

  private errorOf(err: unknown): string {
    const anyErr = err as { error?: { error?: string }, message?: string };
    return anyErr?.error?.error ?? anyErr?.message ?? 'Error desconocido';
  }
}
