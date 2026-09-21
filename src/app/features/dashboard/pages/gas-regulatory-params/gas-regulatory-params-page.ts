import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '@apolo-energies/ui';
import { StarIcon, UiIconSource } from '@apolo-energies/icons';
import { GasRegulatoryParamsService } from '../../../../core/services/gas-regulatory-params.service';
import { GasRegulatoryParams } from '../../../../core/models/gas-regulatory-params.model';
import { GasRegulatoryParamsDialogController } from './gas-regulatory-params-dialog.controller';
import { GasRegulatoryParamsInlineEditController } from './gas-regulatory-params-inline-edit.controller';
import { errorMessageOf, FormState, InlineEditForm, isActiveParams } from './gas-regulatory-params-page.helpers';

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
  readonly rows         = signal<GasRegulatoryParams[]>([]);
  readonly errorMessage = signal<string | null>(null);

  readonly starIcon: UiIconSource = { type: 'apolo', icon: StarIcon, size: 16 };

  // Clase compartida por los inputs numéricos inline. Foco anillado en primary,
  // spinners nativos ocultos (feos y confunden en tablas densas), tabular-nums.
  readonly cellInputCls =
    'rounded-md border border-border/60 bg-background/60 px-2 py-1 text-sm text-right ' +
    'text-foreground tabular-nums transition-colors placeholder:text-muted-foreground/60 ' +
    'focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/25 ' +
    '[appearance:textfield] ' +
    '[&::-webkit-outer-spin-button]:appearance-none ' +
    '[&::-webkit-inner-spin-button]:appearance-none';

  // Create/close dialog flow — extracted controller (R1). Signals exposed by
  // direct reference so the existing template bindings keep working unchanged.
  private readonly dialog = new GasRegulatoryParamsDialogController({
    service: this.service,
    onSaved: () => this.reload(),
    onError: msg => this.errorMessage.set(msg),
  });
  readonly dialogOpen = this.dialog.dialogOpen;
  readonly dialogMode = this.dialog.dialogMode;
  readonly saving     = this.dialog.saving;
  readonly form       = this.dialog.form;
  readonly canSubmit  = this.dialog.canSubmit;

  // Inline row editing — extracted controller (R1).
  private readonly inline = new GasRegulatoryParamsInlineEditController({
    service: this.service,
    onSaved: () => this.reload(),
    onError: msg => this.errorMessage.set(msg),
  });
  readonly inlineEditingRowId = this.inline.editingRowId;
  readonly inlineForm         = this.inline.form;
  readonly inlineSaving       = this.inline.saving;
  readonly canSaveInline      = this.inline.canSave;

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.service.list().subscribe({
      next: rows => { this.rows.set(rows); this.loading.set(false); },
      error: err => { this.errorMessage.set(errorMessageOf(err)); this.loading.set(false); },
    });
  }

  // ── Create/close dialog (delegates to GasRegulatoryParamsDialogController) ──

  openCreate(): void { this.dialog.openCreate(); }
  openClose(row: GasRegulatoryParams): void { this.dialog.openClose(row); }
  closeDialog(): void { this.dialog.closeDialog(); }
  updateField<K extends keyof FormState>(key: K, value: FormState[K]): void { this.dialog.updateField(key, value); }
  submit(): void { this.dialog.submit(); }

  // ── Inline edit (delegates to GasRegulatoryParamsInlineEditController) ──────

  isActive(row: GasRegulatoryParams): boolean { return isActiveParams(row); }
  isEditingInline(row: GasRegulatoryParams): boolean { return this.inline.isEditing(row); }
  startInlineEdit(row: GasRegulatoryParams): void { this.inline.start(row); }
  cancelInlineEdit(): void { this.inline.cancel(); }
  updateInlineField<K extends keyof InlineEditForm>(key: K, value: InlineEditForm[K]): void { this.inline.updateField(key, value); }
  saveInlineEdit(): void { this.inline.save(); }
}
