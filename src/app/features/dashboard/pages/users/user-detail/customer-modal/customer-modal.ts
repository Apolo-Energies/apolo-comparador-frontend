import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent, ButtonComponent, AlertService } from '@apolo-energies/ui';
import { CustomerService } from '../../../../../../core/services/customer.service';
import { UserDetail } from '../../../../../../core/models/user-detail.model';
import {
  INPUT_CLS, NUMBER_CLS, PERSON_TYPE_OPTIONS, PHONE_COUNTRIES, SELECT_CLS, STREET_TYPES,
  buildCustomerPayload, errorMessage, phoneLocalValidator, splitPhone, splitStreetAddress,
} from './customer-modal.helpers';

@Component({
  selector: 'app-customer-modal',
  standalone: true,
  imports: [DialogComponent, ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-modal.html',
})
export class CustomerModalComponent {
  readonly open   = input<boolean>(false);
  readonly user   = input<UserDetail | null>(null);
  readonly mode   = input<'create' | 'edit'>('create');
  readonly saved  = output<void>();
  readonly closed = output<void>();

  private readonly fb              = inject(FormBuilder);
  private readonly customerService = inject(CustomerService);
  private readonly alertService    = inject(AlertService);

  readonly saving      = signal(false);
  readonly personType  = signal<number>(0);
  readonly inputCls    = INPUT_CLS;
  readonly selectCls   = SELECT_CLS;
  readonly numberCls   = NUMBER_CLS;
  readonly phoneCountries = PHONE_COUNTRIES;
  readonly isEditMode  = computed(() => this.mode() === 'edit');

  readonly streetTypes = STREET_TYPES;
  readonly typeOptions = PERSON_TYPE_OPTIONS;

  readonly form = this.fb.nonNullable.group({
    firstName:              ['', [Validators.required, Validators.maxLength(50)]],
    lastName1:              ['', [Validators.required, Validators.maxLength(100)]],
    lastName2:              ['', [Validators.required, Validators.maxLength(100)]],
    dni:                    ['', [Validators.maxLength(20)]],
    companyName:            ['', [Validators.maxLength(150)]],
    cif:                    ['', [Validators.maxLength(30)]],
    email:                  ['', [Validators.required, Validators.email]],
    dialCode:               ['+34'],
    phoneNumber:            ['', [Validators.required, phoneLocalValidator]],
    legalStreetType:        ['Calle'],
    legalStreet:            ['', [Validators.required, Validators.maxLength(150)]],
    legalNumber:            ['', [Validators.required, Validators.maxLength(20)]],
    cityLegal:              ['', [Validators.required, Validators.maxLength(100)]],
    postalCodeLegal:        ['', [Validators.maxLength(10)]],
    notificationStreetType: ['Calle'],
    notificationStreet:     ['', [Validators.required, Validators.maxLength(150)]],
    notificationNumber:     ['', [Validators.required, Validators.maxLength(20)]],
    cityNotification:       ['', [Validators.required, Validators.maxLength(100)]],
    postalCodeNotification: ['', [Validators.maxLength(10)]],
    bankAccount:            ['', [Validators.required, Validators.maxLength(50)]],
  });

  constructor() {
    effect(() => {
      const u = this.user();
      if (!u || !this.open()) return;

      const c = u.customer;
      this.personType.set(c?.personType === 'Company' ? 1 : 0);

      const legalSt = splitStreetAddress(c?.legalAddress ?? '');
      const notifSt = splitStreetAddress(c?.notificationAddress ?? '');

      this.form.patchValue({
        firstName:              c?.firstName      ?? '',
        lastName1:              c?.lastName       ?? '',
        lastName2:              c?.secondLastName ?? '',
        dni:                    c?.dni         ?? '',
        companyName:            c?.companyName ?? (this.mode() === 'create' ? (u.fullName ?? '') : ''),
        cif:                    c?.cif         ?? '',
        email:                  c?.email       ?? u.email ?? '',
        dialCode:               splitPhone(c?.phone ?? u.phone ?? '').dialCode,
        phoneNumber:            splitPhone(c?.phone ?? u.phone ?? '').local,
        legalStreetType:        legalSt.type,
        legalStreet:            legalSt.name,
        legalNumber:            c?.legalNumber          ?? '',
        cityLegal:              c?.cityLegal            ?? '',
        postalCodeLegal:        c?.postalCodeLegal      ?? '',
        notificationStreetType: notifSt.type,
        notificationStreet:     notifSt.name,
        notificationNumber:     c?.notificationNumber  ?? '',
        cityNotification:       c?.cityNotification        ?? '',
        postalCodeNotification: c?.postalCodeNotification  ?? '',
        bankAccount:            c?.bankAccount ?? '',
      });
    });
  }

  setPersonType(v: number): void {
    if (this.isEditMode()) return;
    this.personType.set(v);
    if (v === 0) {
      this.form.patchValue({ companyName: '', cif: '' });
    } else {
      this.form.patchValue({ firstName: '', lastName1: '', lastName2: '', dni: '' });
    }
  }

  err(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && c.touched;
  }

  errMsg(field: string): string {
    return errorMessage(this.form.get(field)?.errors);
  }

  onIban(event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/\s/g, '').toUpperCase();
    const formatted = clean.match(/.{1,4}/g)?.join(' ') ?? clean;
    input.value = formatted;
    this.form.get('bankAccount')?.setValue(formatted, { emitEvent: true });
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const u = this.user();
    if (!u) return;

    const payload = buildCustomerPayload(u, this.personType(), this.form.getRawValue());

    this.saving.set(true);

    const request$ = this.mode() === 'create'
      ? this.customerService.create(payload)
      : this.customerService.update(u.customer!.id, { id: u.customer!.id, ...payload });

    const successMsg = this.mode() === 'create'
      ? 'Datos personales creados correctamente'
      : 'Datos personales actualizados correctamente';

    request$.subscribe({
      next: () => {
        this.alertService.show(successMsg, 'success');
        this.saving.set(false);
        this.saved.emit();
        this.onClose();
      },
      error: () => {
        this.alertService.show('Error al guardar los datos personales', 'error');
        this.saving.set(false);
      },
    });
  }

  onClose(): void {
    this.form.reset({ dialCode: '+34' });
    this.closed.emit();
  }
}
