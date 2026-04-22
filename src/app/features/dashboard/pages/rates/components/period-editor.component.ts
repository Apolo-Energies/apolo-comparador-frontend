import { ChangeDetectionStrategy, Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-period-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-background rounded-lg border border-border p-3 flex flex-col items-center">
      <!-- Badge del período -->
      <div 
        class="inline-block px-2.5 py-1 rounded-lg text-xs font-bold mb-3 border"
        [class.bg-red-100]="period() === 'P1'"
        [class.text-red-800]="period() === 'P1'"
        [class.border-red-200]="period() === 'P1'"
        [class.bg-orange-100]="period() === 'P2'"
        [class.text-orange-800]="period() === 'P2'"
        [class.border-orange-200]="period() === 'P2'"
        [class.bg-yellow-100]="period() === 'P3'"
        [class.text-yellow-800]="period() === 'P3'"
        [class.border-yellow-200]="period() === 'P3'"
        [class.bg-green-100]="period() === 'P4'"
        [class.text-green-800]="period() === 'P4'"
        [class.border-green-200]="period() === 'P4'"
        [class.bg-blue-100]="period() === 'P5'"
        [class.text-blue-800]="period() === 'P5'"
        [class.border-blue-200]="period() === 'P5'"
        [class.bg-purple-100]="period() === 'P6'"
        [class.text-purple-800]="period() === 'P6'"
        [class.border-purple-200]="period() === 'P6'"
      >
        {{ period() }}
      </div>

      <!-- Modo edición -->
      @if (isEditing()) {
        <div class="w-full space-y-2">
          <div class="bg-card/50 rounded-lg p-3 border border-border">
            <input
              #inputElement
              type="number"
              [step]="step()"
              class="w-full px-2 py-1 bg-transparent border-2 border-primary rounded text-sm text-foreground text-center focus:outline-none"
              [ngModel]="editValue()"
              (ngModelChange)="editValue.set($event)"
              (keyup.enter)="onSave()"
              (keyup.escape)="onCancel()"
            />
          </div>
          <div class="flex gap-1">
            <button
              class="flex-1 p-1 bg-green-500 hover:bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              (click)="onSave()"
              [disabled]="isSaving()"
            >
              @if (isSaving()) {
                <span>⏳</span>
              } @else {
                <span>✓</span>
              }
            </button>
            <button
              class="flex-1 p-1 bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              (click)="onCancel()"
              [disabled]="isSaving()"
            >
              ✗
            </button>
            <button
              class="flex-1 p-1 bg-gray-500 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              (click)="onDelete()"
              [disabled]="isSaving()"
            >
              🗑
            </button>
          </div>
        </div>
      } @else {
        <!-- Modo visualización -->
        <div class="w-full bg-card/50 rounded-lg p-3 border border-border">
          <div 
            class="text-base font-bold text-foreground text-center cursor-pointer hover:text-primary"
            (click)="onEdit()"
          >
            {{ formattedValue() }}
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeriodEditorComponent {
  // Inputs
  readonly period = input.required<string>();  // "P1", "P2", etc.
  readonly value = input.required<number>();
  readonly isEditing = input.required<boolean>();
  readonly isSaving = input.required<boolean>();
  readonly decimals = input<number>(6);
  readonly step = input<string>('0.00000001');

  // Outputs
  readonly edit = output<void>();
  readonly save = output<number>();
  readonly cancel = output<void>();
  readonly delete = output<void>();

  // Estado interno
  readonly editValue = signal<number>(0);

  constructor() {
    // Sincronizar editValue cuando cambia value o isEditing
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
