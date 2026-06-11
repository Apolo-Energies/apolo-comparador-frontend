import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent, ButtonComponent, AlertService, ComboboxComponent, ComboboxOption } from '@apolo-energies/ui';
import { UserService } from '../../../../../services/user.service';
import { PotentialParent } from '../../../../../entities/user.model';
import { FormIndividualUserComponent } from './form-individual-user';
import { FormCompanyUserComponent } from './form-company-user';
import { environment } from '../../../../../../environments/environment';

type PersonView = 'Individual' | 'Company';

const INDIVIDUAL_REQUIRED = ['email', 'role', 'name', 'surnames'] as const;
const COMPANY_REQUIRED    = ['email', 'role', 'companyName'] as const;

@Component({
  selector: 'app-add-user-modal',
  standalone: true,
  imports: [DialogComponent, ReactiveFormsModule, ButtonComponent, ComboboxComponent, FormIndividualUserComponent, FormCompanyUserComponent],
  templateUrl: './add-user-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddUserModalComponent {
  readonly open             = input<boolean>(false);
  readonly potentialParents = input<PotentialParent[]>([]);
  readonly canChooseParent  = input<boolean>(false);

  readonly saved     = output<void>();
  readonly cancelled = output<void>();

  private readonly fb           = inject(FormBuilder);
  private readonly userService  = inject(UserService);
  private readonly alertService = inject(AlertService);

  readonly isApolo   = environment.features.userDetail;
  readonly view      = signal<PersonView>('Individual');
  readonly submitted = signal(false);
  readonly saving    = signal(false);

  readonly parentControlId = signal('');

  readonly viewOptions = [
    { value: 'Individual' as PersonView, label: 'Persona Física' },
    { value: 'Company'    as PersonView, label: 'Persona Jurídica' },
  ];

  readonly simpleForm = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    role:     ['', Validators.required],
    name:     ['', [Validators.required, Validators.maxLength(50)]],
    surnames: ['', [Validators.required, Validators.maxLength(50)]],
  });

  readonly individualForm = this.fb.nonNullable.group({
    email:    ['', [Validators.required, Validators.email]],
    role:     ['', Validators.required],
    name:     ['', [Validators.required, Validators.maxLength(50)]],
    surnames: ['', [Validators.required, Validators.maxLength(50)]],
  });

  readonly companyForm = this.fb.nonNullable.group({
    email:       ['', [Validators.required, Validators.email]],
    role:        ['', Validators.required],
    companyName: ['', [Validators.required, Validators.maxLength(100)]],
  });

  readonly simpleRoleOptions = [
    { value: '1', label: 'Master' },
    { value: '2', label: 'Colaborador' },
    { value: '4', label: 'Referenciador' },
    { value: '8', label: 'Tester' },
  ];

  simpleErr(field: string): boolean {
    const c = this.simpleForm.get(field);
    return !!c && c.invalid && (c.touched || this.submitted());
  }

  simpleErrMsg(field: string): string {
    const errors = this.simpleForm.get(field)?.errors;
    if (!errors) return '';
    if (errors['required']) return 'Este campo es obligatorio';
    if (errors['email']) return 'Email inválido';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    return 'Campo inválido';
  }

  readonly activeForm = computed(() =>
    this.view() === 'Individual' ? this.individualForm : this.companyForm
  );

  readonly progress = computed(() => {
    const required = this.view() === 'Individual' ? INDIVIDUAL_REQUIRED : COMPANY_REQUIRED;
    const form = this.activeForm() as FormGroup;
    const valid = required.filter(k => form.get(k)?.valid).length;
    return Math.round((valid / required.length) * 100);
  });

  readonly parentComboboxOptions = computed<ComboboxOption[]>(() =>
    this.potentialParents().map(p => ({ id: p.id, name: p.fullName }))
  );

  onParentComboboxChange(value: string | number): void {
    this.parentControlId.set(String(value ?? ''));
  }

  setView(v: PersonView): void {
    this.view.set(v);
    this.submitted.set(false);
  }

  onParentSelected(value: string): void {
    this.parentControlId.set(value);
  }

  onSubmit(): void {
    this.submitted.set(true);
    const form = this.isApolo ? this.activeForm() : this.simpleForm;
    if (form.invalid) return;

    this.saving.set(true);
    const raw        = form.getRawValue() as Record<string, string>;
    const isCompany  = this.isApolo && this.view() === 'Company';
    const parentId   = this.canChooseParent() && this.parentControlId() ? this.parentControlId() : undefined;

    this.userService.create({
      personType:   this.isApolo ? (isCompany ? 1 : 0) : 0,
      email:        raw['email'].toLowerCase().trim(),
      role:         Number(raw['role']),
      name:         isCompany ? raw['companyName'] : raw['name'],
      surnames:     isCompany ? ''                 : raw['surnames'],
      companyName:  isCompany ? raw['companyName'] : undefined,
      parentUserId: parentId,
    }).subscribe({
      next: () => {
        this.alertService.show('Usuario creado correctamente', 'success');
        this.simpleForm.reset();
        this.individualForm.reset();
        this.companyForm.reset();
        this.parentControlId.set('');
        this.submitted.set(false);
        this.saving.set(false);
        this.saved.emit();
      },
      error: (err) => {
        this.saving.set(false);
        if (err.status === 409) {
          this.alertService.show('Ya existe un usuario con ese email', 'error');
        } else {
          this.alertService.show('Error al crear el usuario', 'error');
        }
      },
    });
  }

  onCancel(): void {
    this.simpleForm.reset();
    this.individualForm.reset();
    this.companyForm.reset();
    this.parentControlId.set('');
    this.submitted.set(false);
    this.cancelled.emit();
  }
}
