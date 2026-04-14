import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { DialogComponent, ButtonComponent, InputFieldComponent, SelectFieldComponent, SelectOption, SliderComponent, AlertService } from '@apolo-energies/ui';
import { UserService } from '../../../../../services/user.service';

@Component({
  selector: 'app-add-user-modal',
  standalone: true,
  imports: [DialogComponent, ReactiveFormsModule, ButtonComponent, InputFieldComponent, SelectFieldComponent, SliderComponent],
  templateUrl: './add-user-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddUserModalComponent {
  readonly open = input<boolean>(false);

  readonly saved     = output<void>();
  readonly cancelled = output<void>();

  private fb            = inject(FormBuilder);
  private userService   = inject(UserService);
  private alertService  = inject(AlertService);

  readonly roleOptions: SelectOption[] = [
    { value: 'Master',      label: 'Master' },
    { value: 'Colaborador', label: 'Colaborador' },
  ];

  readonly form = this.fb.group({
    fullName: ['', [Validators.required]],
    email:    ['', [Validators.required, Validators.email]],
    role:     ['', [Validators.required]],
    phone:    [''],
  });

  private readonly formValues = toSignal(this.form.valueChanges, { initialValue: this.form.value });

  readonly progress = computed(() => {
    this.formValues();
    const required = ['fullName', 'email', 'role'] as const;
    const valid    = required.filter(k => this.form.controls[k].valid).length;
    return Math.round((valid / required.length) * 100);
  });

  onSubmit() {
    if (this.form.invalid) return;

    const { fullName, email, role, phone } = this.form.getRawValue();

    this.userService.create({
      fullName: fullName!,
      email:    email!,
      password: '00000000',
      role:     role!,
      phone:    phone || undefined,
    }).subscribe({
      next: () => {
        this.alertService.show('Usuario creado correctamente', 'success');
        this.form.reset();
        this.saved.emit();
      },
      error: (err) => {
        if (err.status === 409) {
          this.alertService.show('Ya existe un usuario con ese email', 'error');
        } else {
          this.alertService.show('Error al crear el usuario', 'error');
        }
      },
    });
  }

  onCancel() {
    this.form.reset();
    this.cancelled.emit();
  }
}