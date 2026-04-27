import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent, ButtonComponent, AlertService } from '@apolo-energies/ui';
import { UserService } from '../../../../../services/user.service';
import { FormIndividualUserComponent } from './form-individual-user';
import { FormCompanyUserComponent } from './form-company-user';

type PersonView = 'Individual' | 'Company';

const INDIVIDUAL_REQUIRED = ['email', 'role', 'name', 'surnames'] as const;
const COMPANY_REQUIRED    = ['email', 'role', 'name', 'surnames', 'companyName', 'cif'] as const;

@Component({
  selector: 'app-add-user-modal',
  standalone: true,
  imports: [DialogComponent, ReactiveFormsModule, ButtonComponent, FormIndividualUserComponent, FormCompanyUserComponent],
  templateUrl: './add-user-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddUserModalComponent {
  readonly open = input<boolean>(false);

  readonly saved     = output<void>();
  readonly cancelled = output<void>();

  private readonly fb           = inject(FormBuilder);
  private readonly userService  = inject(UserService);
  private readonly alertService = inject(AlertService);

  readonly view      = signal<PersonView>('Individual');
  readonly submitted = signal(false);

  readonly viewOptions = [
    { value: 'Individual' as PersonView, label: 'Persona Física' },
    { value: 'Company'    as PersonView, label: 'Persona Jurídica' },
  ];

  private readonly sharedControls = {
    email:               ['', [Validators.required, Validators.email]],
    role:                ['', Validators.required],
    name:                ['', [Validators.required, Validators.maxLength(50)]],
    surnames:            ['', [Validators.required, Validators.maxLength(50)]],
    dni:                 ['', [Validators.pattern(/^[0-9]{8}[A-Za-z]$/)]],
    phone:               ['', [Validators.pattern(/^\+34[0-9]{9}$/)]],
    legalAddress:        ['', [Validators.minLength(5)]],
    notificationAddress: ['', [Validators.minLength(5)]],
    bankAccount:         ['', [Validators.pattern(/^ES\d{2}(?:\s?\d{4}){5}$/)]],
  };

  readonly individualForm = this.fb.nonNullable.group({ ...this.sharedControls });

  readonly companyForm = this.fb.nonNullable.group({
    ...this.sharedControls,
    companyName: ['', [Validators.required, Validators.maxLength(100)]],
    cif:         ['', [Validators.required, Validators.pattern(/^[A-Z]\d{7}[A-Z0-9]$/)]],
  });

  readonly activeForm = computed(() =>
    this.view() === 'Individual' ? this.individualForm : this.companyForm
  );

  readonly progress = computed(() => {
    const required = this.view() === 'Individual' ? INDIVIDUAL_REQUIRED : COMPANY_REQUIRED;
    const form = this.activeForm() as FormGroup;
    const valid = required.filter(k => form.get(k)?.valid).length;
    return Math.round((valid / required.length) * 100);
  });

  setView(v: PersonView): void {
    this.view.set(v);
    this.submitted.set(false);
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (this.activeForm().invalid) return;

    const raw = this.activeForm().getRawValue() as Record<string, string>;

    this.userService.create({
      personType:           this.view() === 'Individual' ? 0 : 1,
      email:               raw['email'].toLowerCase().trim(),
      role:                Number(raw['role']),
      name:                raw['name'],
      surnames:            raw['surnames'],
      dni:                 raw['dni']                 || undefined,
      phone:               raw['phone']               || undefined,
      legalAddress:        raw['legalAddress']        || undefined,
      notificationAddress: raw['notificationAddress'] || undefined,
      bankAccount:         raw['bankAccount']         || undefined,
      cif:                 raw['cif']                 || undefined,
      companyName:         raw['companyName']         || undefined,
    }).subscribe({
      next: () => {
        this.alertService.show('Usuario creado correctamente', 'success');
        this.individualForm.reset();
        this.companyForm.reset();
        this.submitted.set(false);
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

  onCancel(): void {
    this.individualForm.reset();
    this.companyForm.reset();
    this.submitted.set(false);
    this.cancelled.emit();
  }
}
