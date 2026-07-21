import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertComponent, ButtonComponent, DialogComponent } from '@apolo-energies/ui';

export interface CommercialParent {
  id:       string;
  fullName: string;
}

export interface CommercialFormValue {
  email:                string;
  name:                 string;
  surnames:             string;
  commissionPercentage: number | null;
}

@Component({
  selector: 'app-add-commercial-modal',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, ReactiveFormsModule, AlertComponent],
  templateUrl: './add-commercial-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddCommercialModalComponent {
  readonly open       = input<boolean>(false);
  readonly parentUser = input<CommercialParent | null>(null);
  readonly saving     = input<boolean>(false);

  readonly saveRequested = output<CommercialFormValue>();
  readonly cancelled     = output<void>();

  private readonly fb = inject(FormBuilder);

  readonly submitted = signal(false);

  // Commission % is only shown when the master is creating a commercial for another collaborator.
  // In the collaborator's own "my-commercials" flow the parent is implicit and the field stays hidden.
  readonly askCommission = computed(() => !!this.parentUser());

  readonly form = this.fb.nonNullable.group({
    email:                ['', [Validators.required, Validators.email]],
    name:                 ['', [Validators.required, Validators.maxLength(50)]],
    surnames:             ['', [Validators.required, Validators.maxLength(50)]],
    commissionPercentage: [null as number | null],
  });

  readonly subtitle = computed(() => {
    const p = this.parentUser();
    return p
      ? `Se creará como Comercial bajo ${p.fullName}.`
      : 'Se creará como un Comercial bajo tu cuenta.';
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.form.reset();
        this.submitted.set(false);
      }
    });

    // Toggle validators reactively so the field is only required when visible.
    effect(() => {
      const ctrl = this.form.controls.commissionPercentage;
      if (this.askCommission()) {
        ctrl.setValidators([Validators.required, Validators.min(0), Validators.max(100)]);
      } else {
        ctrl.clearValidators();
      }
      ctrl.updateValueAndValidity({ emitEvent: false });
    });
  }

  hasErr(field: 'email' | 'name' | 'surnames' | 'commissionPercentage'): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && (c.touched || this.submitted());
  }

  errMsg(field: 'email' | 'name' | 'surnames' | 'commissionPercentage'): string {
    const errors = this.form.get(field)?.errors;
    if (!errors) return '';
    if (errors['required'])  return 'Este campo es obligatorio';
    if (errors['email'])     return 'Email inválido';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['min'])       return 'Debe ser 0 o mayor';
    if (errors['max'])       return 'Debe ser 100 o menor';
    return 'Campo inválido';
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.form.invalid) return;

    const raw = this.form.getRawValue();
    this.saveRequested.emit({
      email:                raw.email.toLowerCase().trim(),
      name:                 raw.name.trim(),
      surnames:             raw.surnames.trim(),
      commissionPercentage: this.askCommission() ? Number(raw.commissionPercentage) : null,
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
