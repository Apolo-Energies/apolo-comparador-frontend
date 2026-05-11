import { ChangeDetectionStrategy, Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-period-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './period-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodEditorComponent {
  readonly period    = input.required<string>();
  readonly value     = input.required<number>();
  readonly isEditing = input.required<boolean>();
  readonly isSaving  = input.required<boolean>();
  readonly decimals  = input<number>(6);
  readonly step      = input<string>('0.00000001');

  readonly edit   = output<void>();
  readonly save   = output<number>();
  readonly cancel = output<void>();
  readonly delete = output<void>();

  readonly editValue = signal<number>(0);

  constructor() {
    effect(() => {
      if (this.isEditing()) {
        this.editValue.set(this.value());
      }
    });
  }

  readonly formattedValue = () => {
    return this.value().toFixed(this.decimals());
  };

  onEdit(): void {
    this.editValue.set(this.value());
    this.edit.emit();
  }

  onSave(): void {
    this.save.emit(this.editValue());
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onDelete(): void {
    this.delete.emit();
  }
}
