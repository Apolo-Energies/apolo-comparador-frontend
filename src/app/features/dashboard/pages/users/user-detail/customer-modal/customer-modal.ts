import {
  ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
              }

              <!-- Common fields -->
              <div class="space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Correo</label>
                <input formControlName="email" type="email" readonly
                  class="w-full px-4 py-2.5 text-sm rounded-lg border bg-muted border-border text-muted-foreground cursor-not-allowed" />
              </div>

              <div class="space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Teléfono *</label>
                <div class="flex">
                  <select formControlName="dialCode" [class]="selectCls">
                    @for (c of phoneCountries; track c.code) {
                      <option [value]="c.code">{{ c.flag }} {{ c.code }}</option>
                    }
                  </select>
                  <input formControlName="phoneNumber" type="tel" placeholder="612 345 678"
                    [class]="numberCls" [class.border-red-500]="err('phoneNumber')" />
                </div>
                @if (err('phoneNumber')) { <p class="text-xs text-red-500">{{ errMsg('phoneNumber') }}</p> }
              </div>

              <div class="md:col-span-2 space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Dirección legal *</label>
                <input formControlName="legalAddress" placeholder="Calle Mayor 1, 28001 Madrid"
                  [class]="inputCls" [class.border-red-500]="err('legalAddress')" />
                @if (err('legalAddress')) { <p class="text-xs text-red-500">{{ errMsg('legalAddress') }}</p> }
              </div>

              <div class="md:col-span-2 space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Dirección de notificación *</label>
                <input formControlName="notificationAddress" placeholder="Calle Mayor 1, 28001 Madrid"
                  [class]="inputCls" [class.border-red-500]="err('notificationAddress')" />
                @if (err('notificationAddress')) { <p class="text-xs text-red-500">{{ errMsg('notificationAddress') }}</p> }
              </div>

              <div class="md:col-span-2 space-y-1">
                <label class="text-sm font-medium text-muted-foreground">Cuenta bancaria *</label>
                <input formControlName="bankAccount" placeholder="ES83 0182 6517 7302 0197 5760"
                  (input)="onIban($event)"
                  [class]="inputCls" [class.border-red-500]="err('bankAccount')" />
                @if (err('bankAccount')) { <p class="text-xs text-red-500">{{ errMsg('bankAccount') }}</p> }
              </div>

            </div>
          </div>

          <!-- Footer -->
          <div class="shrink-0 border-t border-border px-6 py-4 flex justify-end gap-2">
            <ui-button label="Cancelar" variant="outline" size="md" (click)="onClose()" />
            <ui-button [label]="mode() === 'create' ? 'Guardar datos' : 'Actualizar datos'"
              variant="default" size="md" [disabled]="saving()" (click)="onSubmit()" />
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
    firstName:           ['', [Validators.maxLength(50)]],
    lastName:            ['', [Validators.maxLength(100)]],
    dni:                 ['', [Validators.maxLength(20)]],
    companyName:         ['', [Validators.maxLength(150)]],
    cif:                 ['', [Validators.maxLength(30)]],
    email:               [{ value: '', disabled: true }],
    dialCode:            ['+34'],
    phoneNumber:         ['', [Validators.required, Validators.maxLength(20)]],
    legalAddress:        ['', [Validators.required, Validators.maxLength(200)]],
    notificationAddress: ['', [Validators.required, Validators.maxLength(200)]],
    bankAccount:         ['', [Validators.required, Validators.maxLength(50)]],
  });

  constructor() {
    effect(() => {
      const u = this.user();
      if (!u || !this.open()) return;

      const c = u.customer;
      this.personType.set(c?.personType === 'Company' ? 1 : 0);

      this.form.patchValue({
        firstName:           c?.firstName           ?? '',
        lastName:            c?.lastName            ?? '',
        dni:                 c?.dni                 ?? '',
        companyName:         c?.companyName         ?? '',
        cif:                 c?.cif                 ?? '',
        email:               c?.email               ?? u.email ?? '',
        dialCode:            splitPhone(c?.phone ?? u.phone ?? '').dialCode,
        phoneNumber:         splitPhone(c?.phone ?? u.phone ?? '').local,
        legalAddress:        c?.legalAddress        ?? '',
        notificationAddress: c?.notificationAddress ?? '',
        bankAccount:         c?.bankAccount         ?? '',
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
    if (errors['required'])  return 'Este campo es obligatorio';
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
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
      firstName:           isIndividual ? raw.firstName    : '',
      lastName:            isIndividual ? raw.lastName     : '',
      dni:                 isIndividual ? raw.dni          : '',
      companyName:         !isIndividual ? raw.companyName : '',
      cif:                 !isIndividual ? raw.cif         : '',
      email:               raw.email,
      phone:               raw.phoneNumber ? `${raw.dialCode}${raw.phoneNumber}` : '',
      legalAddress:        raw.legalAddress,
      notificationAddress: raw.notificationAddress,
      bankAccount:         raw.bankAccount,
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
