import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { DialogComponent, ButtonComponent, AlertService } from '@apolo-energies/ui';
import { CustomerService } from '../../../../../../services/customer.service';
import { UserDetail } from '../../../../../../entities/user-detail.model';

const PHONE_COUNTRIES = [
  { code: '+34',  flag: '🇪🇸', name: 'España'        },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia'        },
  { code: '+52',  flag: '🇲🇽', name: 'México'         },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina'      },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia'       },
  { code: '+56',  flag: '🇨🇱', name: 'Chile'          },
  { code: '+51',  flag: '🇵🇪', name: 'Perú'           },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela'      },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador'        },
  { code: '+1',   flag: '🇺🇸', name: 'EE.UU.'         },
  { code: '+44',  flag: '🇬🇧', name: 'Reino Unido'    },
  { code: '+351', flag: '🇵🇹', name: 'Portugal'       },
  { code: '+212', flag: '🇲🇦', name: 'Marruecos'      },
];

function splitPhone(phone: string): { dialCode: string; local: string } {
  const match = PHONE_COUNTRIES
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find(c => phone.startsWith(c.code));
  return match
    ? { dialCode: match.code, local: phone.slice(match.code.length) }
    : { dialCode: '+34', local: phone };
}

// Dígitos exactos requeridos por país (Signaturit los exige)
const PHONE_DIGITS: Record<string, number> = {
  '+34': 9, '+351': 9, '+44': 10, '+1': 10,
};
const PHONE_DIGITS_DEFAULT = { min: 7, max: 12 };

function phoneLocalValidator(control: AbstractControl): ValidationErrors | null {
  const raw = ((control.value as string) ?? '').replace(/[\s\-().]/g, '');
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return { phoneFormat: true };
  const dialCode = (control.parent?.get('dialCode')?.value ?? '+34') as string;
  const exact = PHONE_DIGITS[dialCode];
  if (exact !== undefined) {
    return raw.length === exact ? null : { phoneLength: { required: exact, actual: raw.length } };
  }
  const { min, max } = PHONE_DIGITS_DEFAULT;
  return raw.length >= min && raw.length <= max ? null : { phoneLength: { required: `${min}-${max}`, actual: raw.length } };
}

function splitAddress(addr: string): { city: string; street: string; number: string } {
  const parts = addr.split(',').map(s => s.trim());
  return { city: parts[0] ?? '', street: parts[1] ?? '', number: parts[2] ?? '' };
}

const INPUT_CLS  = 'w-full px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
const SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
const NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

@Component({
  selector: 'app-customer-modal',
  standalone: true,
  imports: [DialogComponent, ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog [open]="open()" [closeable]="true" maxWidth="max-w-2xl" (openChange)="$event ? null : onClose()">
      <div class="flex flex-col" style="max-height: 90vh">

        <!-- Header + toggle -->
        <div class="shrink-0 space-y-4 border-b border-border px-6 py-4">
          <div>
            <p class="text-lg font-semibold text-foreground">
              {{ mode() === 'create' ? 'Agregar datos personales' : 'Editar datos personales' }}
            </p>
            <p class="text-sm text-muted-foreground">Completa o actualiza la información del cliente</p>
          </div>

          <div class="space-y-1.5">
            <p class="text-sm font-medium text-foreground">Tipo de persona</p>
            <div class="flex rounded-lg border border-border p-1 bg-muted gap-1">
              @for (opt of typeOptions; track opt.value) {
                <button type="button" (click)="setPersonType(opt.value)"
                  class="flex-1 text-sm py-1.5 rounded-md transition-all font-medium"
                  [class.bg-card]="personType() === opt.value"
                  [class.text-foreground]="personType() === opt.value"
                  [class.shadow-sm]="personType() === opt.value"
                  [class.text-muted-foreground]="personType() !== opt.value"
                  [disabled]="isEditMode()">
                  {{ opt.label }}
                </button>
              }
            </div>
            @if (isEditMode()) {
              <p class="text-xs text-muted-foreground">El tipo de persona no se puede modificar al editar.</p>
            }
          </div>
        </div>

        <!-- Form body -->
        <form [formGroup]="form" class="flex flex-col flex-1 min-h-0">
          <div class="flex-1 overflow-y-auto px-6 py-5">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">

              @if (personType() === 0) {
                <!-- Individual -->
                <div class="space-y-1">
                  <label class="text-sm font-medium text-muted-foreground">Nombre *</label>
                  <input formControlName="firstName" placeholder="Juan"
                    [class]="inputCls" [class.border-red-500]="err('firstName')" />
                  @if (err('firstName')) { <p class="text-xs text-red-500">{{ errMsg('firstName') }}</p> }
                </div>

                <div class="space-y-1">
                  <label class="text-sm font-medium text-muted-foreground">Apellidos *</label>
                  <input formControlName="lastName" placeholder="García López"
                    [class]="inputCls" [class.border-red-500]="err('lastName')" />
                  @if (err('lastName')) { <p class="text-xs text-red-500">{{ errMsg('lastName') }}</p> }
                </div>

                <div class="md:col-span-2 space-y-1">
                  <label class="text-sm font-medium text-muted-foreground">DNI / NIE *</label>
                  <input formControlName="dni" placeholder="12345678A"
                    [class]="inputCls" [class.border-red-500]="err('dni')" />
                  @if (err('dni')) { <p class="text-xs text-red-500">{{ errMsg('dni') }}</p> }
                </div>
              } @else {
                <!-- Company -->
                <div class="md:col-span-2 space-y-1">
                  <label class="text-sm font-medium text-muted-foreground">Razón social *</label>
                  <input formControlName="companyName" placeholder="Empresa S.L."
                    [class]="inputCls" [class.border-red-500]="err('companyName')" />
                  @if (err('companyName')) { <p class="text-xs text-red-500">{{ errMsg('companyName') }}</p> }
                </div>

                <div class="md:col-span-2 space-y-1">
                  <label class="text-sm font-medium text-muted-foreground">CIF *</label>
                  <input formControlName="cif" placeholder="B56263304"
                    [class]="inputCls" [class.border-red-500]="err('cif')" />
                  @if (err('cif')) { <p class="text-xs text-red-500">{{ errMsg('cif') }}</p> }
                </div>

                <div class="space-y-1">
                  <label class="text-sm font-medium text-muted-foreground">Nombre representante legal</label>
                  <input formControlName="firstName" placeholder="Juan"
                    [class]="inputCls" />
                </div>

                <div class="space-y-1">
                  <label class="text-sm font-medium text-muted-foreground">Apellidos representante legal</label>
                  <input formControlName="lastName" placeholder="García López"
                    [class]="inputCls" />
                </div>

                <div class="md:col-span-2 space-y-1">
                  <label class="text-sm font-medium text-muted-foreground">DNI representante legal</label>
                  <input formControlName="dni" placeholder="12345678A"
                    [class]="inputCls" />
                </div>
              }

              <!-- Common fields -->
              <div class="space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Correo <span class="text-red-500">*</span></label>
                <input formControlName="email" type="email" placeholder="usuario@email.com"
                  [class]="inputCls" [class.border-red-500]="err('email')" />
                @if (err('email')) { <p class="text-xs text-red-500">{{ errMsg('email') }}</p> }
              </div>

              <div class="space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Teléfono *</label>
                <div class="flex">
                  <select formControlName="dialCode" [class]="selectCls"
                    (change)="form.controls.phoneNumber.updateValueAndValidity()">
                    @for (c of phoneCountries; track c.code) {
                      <option [value]="c.code">{{ c.flag }} {{ c.code }}</option>
                    }
                  </select>
                  <input formControlName="phoneNumber" type="tel" placeholder="612 345 678"
                    [class]="numberCls" [class.border-red-500]="err('phoneNumber')" />
                </div>
                @if (err('phoneNumber')) { <p class="text-xs text-red-500">{{ errMsg('phoneNumber') }}</p> }
              </div>

              <!-- Dirección legal: ciudad + calle + número -->
              <div class="md:col-span-2 space-y-2">
                <label class="text-sm font-medium text-muted-foreground">Dirección legal *</label>
                <div class="grid grid-cols-3 gap-2">
                  <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Ciudad</p>
                    <input formControlName="legalCity" placeholder="Valencia"
                      [class]="inputCls" [class.border-red-500]="err('legalCity')" />
                    @if (err('legalCity')) { <p class="text-xs text-red-500">{{ errMsg('legalCity') }}</p> }
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Calle</p>
                    <input formControlName="legalStreet" placeholder="Calle Mayor"
                      [class]="inputCls" [class.border-red-500]="err('legalStreet')" />
                    @if (err('legalStreet')) { <p class="text-xs text-red-500">{{ errMsg('legalStreet') }}</p> }
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Número</p>
                    <input formControlName="legalNumber" placeholder="42"
                      [class]="inputCls" [class.border-red-500]="err('legalNumber')" />
                    @if (err('legalNumber')) { <p class="text-xs text-red-500">{{ errMsg('legalNumber') }}</p> }
                  </div>
                </div>
              </div>

              <!-- Dirección de notificación: ciudad + calle + número -->
              <div class="md:col-span-2 space-y-2">
                <label class="text-sm font-medium text-muted-foreground">Dirección de notificación *</label>
                <div class="grid grid-cols-3 gap-2">
                  <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Ciudad</p>
                    <input formControlName="notificationCity" placeholder="Valencia"
                      [class]="inputCls" [class.border-red-500]="err('notificationCity')" />
                    @if (err('notificationCity')) { <p class="text-xs text-red-500">{{ errMsg('notificationCity') }}</p> }
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Calle</p>
                    <input formControlName="notificationStreet" placeholder="Calle Mayor"
                      [class]="inputCls" [class.border-red-500]="err('notificationStreet')" />
                    @if (err('notificationStreet')) { <p class="text-xs text-red-500">{{ errMsg('notificationStreet') }}</p> }
                  </div>
                  <div class="space-y-1">
                    <p class="text-xs text-muted-foreground">Número</p>
                    <input formControlName="notificationNumber" placeholder="42"
                      [class]="inputCls" [class.border-red-500]="err('notificationNumber')" />
                    @if (err('notificationNumber')) { <p class="text-xs text-red-500">{{ errMsg('notificationNumber') }}</p> }
                  </div>
                </div>
              </div>

              <div class="md:col-span-2 space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Cuenta bancaria *</label>
                <input formControlName="bankAccount" placeholder="ES83 0182 6517 7302 0197 5760"
                  (input)="onIban($event)"
                  [class]="inputCls" [class.border-red-500]="err('bankAccount')" />
                @if (err('bankAccount')) { <p class="text-xs text-red-500">{{ errMsg('bankAccount') }}</p> }
              </div>

              <div class="space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Código postal</label>
                <input formControlName="postalCode" placeholder="28001"
                  [class]="inputCls" [class.border-red-500]="err('postalCode')" />
                @if (err('postalCode')) { <p class="text-xs text-red-500">{{ errMsg('postalCode') }}</p> }
              </div>

            </div>
          </div>

          <!-- Footer -->
          <div class="shrink-0 border-t border-border px-6 py-4 flex justify-between gap-2">
            <ui-button label="Cancelar" variant="outline" size="md" (click)="onClose()" />
            @if (saving()) {
              <button disabled class="inline-flex items-center justify-center min-w-32 rounded-md px-4 py-2 bg-primary-button text-white text-sm font-semibold cursor-not-allowed opacity-80">
                <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
                  <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="white"/>
                </svg>
              </button>
            } @else {
              <ui-button [label]="mode() === 'create' ? 'Guardar datos' : 'Actualizar datos'"
                variant="default" size="md" (click)="onSubmit()" />
            }
          </div>
        </form>

      </div>
    </ui-dialog>
  `,
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

  readonly typeOptions = [
    { value: 0, label: 'Persona Física' },
    { value: 1, label: 'Persona Jurídica' },
  ];

  readonly form = this.fb.nonNullable.group({
    firstName:            ['', [Validators.maxLength(50)]],
    lastName:             ['', [Validators.maxLength(100)]],
    dni:                  ['', [Validators.maxLength(20)]],
    companyName:          ['', [Validators.maxLength(150)]],
    cif:                  ['', [Validators.maxLength(30)]],
    email:                ['', [Validators.required, Validators.email]],
    dialCode:             ['+34'],
    phoneNumber:          ['', [Validators.required, phoneLocalValidator]],
    legalCity:            ['', [Validators.required, Validators.maxLength(100)]],
    legalStreet:          ['', [Validators.required, Validators.maxLength(150)]],
    legalNumber:          ['', [Validators.required, Validators.maxLength(20)]],
    notificationCity:     ['', [Validators.required, Validators.maxLength(100)]],
    notificationStreet:   ['', [Validators.required, Validators.maxLength(150)]],
    notificationNumber:   ['', [Validators.required, Validators.maxLength(20)]],
    bankAccount:          ['', [Validators.required, Validators.maxLength(50)]],
    postalCode:           ['', [Validators.maxLength(10)]],
  });

  constructor() {
    effect(() => {
      const u = this.user();
      if (!u || !this.open()) return;

      const c = u.customer;
      this.personType.set(c?.personType === 'Company' ? 1 : 0);

      const legal = splitAddress(c?.legalAddress ?? '');
      const notif = splitAddress(c?.notificationAddress ?? '');

      this.form.patchValue({
        firstName:            c?.firstName   ?? '',
        lastName:             c?.lastName    ?? '',
        dni:                  c?.dni         ?? '',
        companyName:          c?.companyName ?? (this.mode() === 'create' ? (u.fullName ?? '') : ''),
        cif:                  c?.cif         ?? '',
        email:                c?.email       ?? u.email ?? '',
        dialCode:             splitPhone(c?.phone ?? u.phone ?? '').dialCode,
        phoneNumber:          splitPhone(c?.phone ?? u.phone ?? '').local,
        legalCity:            legal.city,
        legalStreet:          legal.street,
        legalNumber:          legal.number,
        notificationCity:     notif.city,
        notificationStreet:   notif.street,
        notificationNumber:   notif.number,
        bankAccount:          c?.bankAccount  ?? '',
        postalCode:           c?.postalCode   ?? '',
      });
    });
  }

  setPersonType(v: number): void {
    if (this.isEditMode()) return;
    this.personType.set(v);
    if (v === 0) {
      this.form.patchValue({ companyName: '', cif: '' });
    } else {
      this.form.patchValue({ firstName: '', lastName: '', dni: '' });
    }
  }

  err(field: string): boolean {
    const c = this.form.get(field);
    return !!c && c.invalid && c.touched;
  }

  errMsg(field: string): string {
    const errors = this.form.get(field)?.errors;
    if (!errors) return '';
    if (errors['required'])     return 'Este campo es obligatorio';
    if (errors['email'])        return 'Email inválido';
    if (errors['maxlength'])    return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
    if (errors['phoneFormat'])  return 'Solo se permiten dígitos (sin espacios ni guiones)';
    if (errors['phoneLength']) {
      const e = errors['phoneLength'];
      return typeof e.required === 'number'
        ? `Necesita ${e.required} dígitos, tienes ${e.actual}`
        : `Debe tener entre ${e.required} dígitos`;
    }
    return 'Campo inválido';
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

    const raw  = this.form.getRawValue();
    const pt   = this.personType();
    const isIndividual = pt === 0;

    this.saving.set(true);

    const payload = {
      userId:              u.id,
      kind:                1,
      personType:          pt,
      firstName:           raw.firstName    || '',
      lastName:            raw.lastName     || '',
      dni:                 raw.dni          || '',
      companyName:         !isIndividual ? raw.companyName : '',
      cif:                 !isIndividual ? raw.cif         : '',
      email:               raw.email,
      phone:               raw.phoneNumber ? `${raw.dialCode}${raw.phoneNumber}` : '',
      legalAddress:        `${raw.legalCity}, ${raw.legalStreet}, ${raw.legalNumber}`,
      notificationAddress: `${raw.notificationCity}, ${raw.notificationStreet}, ${raw.notificationNumber}`,
      bankAccount:         raw.bankAccount,
      postalCode:          raw.postalCode || undefined,
    };

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
