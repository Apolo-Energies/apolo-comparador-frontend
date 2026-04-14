import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogComponent, ButtonComponent, InputFieldComponent, SliderComponent, AlertService } from '@apolo-energies/ui';
import { CommissionService, CommissionRow } from '../../../../../services/commission.service';

@Component({
  selector: 'app-add-commission-modal',
  standalone: true,
  imports: [DialogComponent, ReactiveFormsModule, ButtonComponent, InputFieldComponent, SliderComponent],
  templateUrl: './add-commission-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCommissionModalComponent {
  readonly open     = input<boolean>(false);
  readonly editData = input<CommissionRow | null>(null);

  readonly saved     = output<void>();
  readonly cancelled = output<void>();

  private fb                = inject(FormBuilder);
  private commissionService = inject(CommissionService);
  private alertService      = inject(AlertService);

  readonly isEditMode = computed(() => this.editData() !== null);

  readonly form = this.fb.group({
    name:       ['', [Validators.required]],
    percentage: [0,  [Validators.required, Validators.min(1), Validators.max(100)]],
  });

  private readonly formValues = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  readonly progress = computed(() => {
    this.formValues();
    const controls = Object.values(this.form.controls);
    const valid    = controls.filter(c => c.valid).length;
    return Math.round((valid / controls.length) * 100);
  });

  constructor() {
    effect(() => {
      const data = this.editData();
      if (data) {
        this.form.setValue({ name: data.name, percentage: data.percentage });
      } else {
        this.form.reset({ name: '', percentage: 0 });
      }
    });
  }

  onPercentageInput(value: string) {
    const num = Math.min(100, Math.max(0, Number(value)));
    this.form.controls.percentage.setValue(num);
  }

  onSubmit() {
    if (this.form.invalid) return;

    const { name, percentage } = this.form.getRawValue();
    const payload = { name: name!, percentage: percentage! };
    const edit    = this.editData();

    const request$ = edit
      ? this.commissionService.update(edit.id, payload)
      : this.commissionService.create(payload);

    request$.subscribe({
      next: () => {
        const msg = edit ? 'Comisión actualizada correctamente' : 'Comisión creada correctamente';
        this.alertService.show(msg, 'success');
        this.form.reset({ name: '', percentage: 0 });
        this.saved.emit();
      },
      error: () => {
        const msg = edit ? 'Error al actualizar la comisión' : 'Error al crear la comisión';
        this.alertService.show(msg, 'error');
      },
    });
  }

  onCancel() {
    this.form.reset({ name: '', percentage: 0 });
    this.cancelled.emit();
  }
}