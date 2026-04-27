import {
  ChangeDetectionStrategy, Component, effect, inject, input, output, signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogComponent, ButtonComponent, AlertService } from '@apolo-energies/ui';
import { UserService } from '../../../../../../services/user.service';
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

const INPUT_CLS  = 'w-full px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
const SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
const NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

@Component({
  selector: 'app-edit-user-modal',
  standalone: true,
  imports: [DialogComponent, ReactiveFormsModule, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-dialog [open]="open()" [closeable]="true" maxWidth="max-w-xl" (openChange)="$event ? null : onClose()">
      <div class="flex flex-col">

        <div class="shrink-0 border-b border-border px-6 py-4">
          <p class="text-lg font-semibold text-foreground">Editar usuario</p>
          <p class="text-sm text-muted-foreground">Actualiza los datos básicos del usuario</p>
        </div>

        <form [formGroup]="form" class="flex flex-col">
          <div class="space-y-4 px-6 py-5">

            <div class="space-y-1">
              <label class="text-sm font-medium text-muted-foreground">Nombre completo *</label>
              <input formControlName="fullName" placeholder="Juan García"
                [class]="inputCls" [class.border-red-500]="err('fullName')" />
              @if (err('fullName')) {
                <p class="text-xs text-red-500">{{ errMsg('fullName') }}</p>
              }
            </div>

            <div class="space-y-1">
              <label class="text-sm font-medium text-muted-foreground">Correo</label>
              <input formControlName="email" type="email" readonly
                class="w-full px-4 py-2.5 text-sm rounded-lg border bg-muted border-border text-muted-foreground cursor-not-allowed" />
            </div>

            <div class="space-y-1">
              <label class="text-sm font-medium text-muted-foreground">Teléfono</label>
              <div class="flex">
                <select formControlName="dialCode" [class]="selectCls">
                  @for (c of phoneCountries; track c.code) {
                    <option [value]="c.code">{{ c.flag }} {{ c.code }}</option>
                  }
                </select>
                <input formControlName="phoneNumber" type="tel" placeholder="612 345 678"
                  [class]="numberCls" />
              </div>
            </div>

          </div>

          <div class="shrink-0 border-t border-border px-6 py-4 flex justify-end gap-2">
            <ui-button label="Cancelar" variant="outline" size="md" (click)="onClose()" />
            <ui-button label="Guardar cambios" variant="default" size="md"
              [disabled]="saving()" (click)="onSubmit()" />
          </div>
        </form>

      </div>
    </ui-dialog>
  `,
})
export class EditUserModalComponent {
  readonly open   = input<boolean>(false);
  readonly user   = input<UserDetail | null>(null);
  readonly saved  = output<void>();
  readonly closed = output<void>();

  private readonly fb           = inject(FormBuilder);
  private readonly userService  = inject(UserService);
  private readonly alertService = inject(AlertService);

  readonly saving = signal(false);

  readonly inputCls  = INPUT_CLS;
  readonly selectCls = SELECT_CLS;
  readonly numberCls = NUMBER_CLS;
  readonly phoneCountries = PHONE_COUNTRIES;

  readonly form = this.fb.nonNullable.group({
    fullName:    ['', [Validators.required, Validators.maxLength(100)]],
    email:       [{ value: '', disabled: true }],
    dialCode:    ['+34'],
    phoneNumber: ['', [Validators.maxLength(20)]],
  });

  constructor() {
    effect(() => {
      const u = this.user();
      if (!u || !this.open()) return;

      const { dialCode, local } = splitPhone(u.phone ?? '');
      this.form.patchValue({
        fullName:    u.fullName ?? '',
        email:       u.email   ?? '',
        dialCode,
        phoneNumber: local,
      });
    });
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

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const u = this.user();
    if (!u) return;

    const raw   = this.form.getRawValue();
    const phone = raw.phoneNumber ? `${raw.dialCode}${raw.phoneNumber}` : undefined;
    this.saving.set(true);

    this.userService.updateProfile(u.id, {
      fullName: raw.fullName,
      email:    raw.email,
      phone,
    }).subscribe({
      next: () => {
        this.alertService.show('Usuario actualizado correctamente', 'success');
        this.saving.set(false);
        this.saved.emit();
        this.onClose();
      },
      error: () => {
        this.alertService.show('Error al actualizar el usuario', 'error');
        this.saving.set(false);
      },
    });
  }

  onClose(): void {
    this.form.reset({ dialCode: '+34' });
    this.closed.emit();
  }
}

function splitPhone(phone: string): { dialCode: string; local: string } {
  const match = PHONE_COUNTRIES
    .slice()
    .sort((a, b) => b.code.length - a.code.length)
    .find(c => phone.startsWith(c.code));
  return match
    ? { dialCode: match.code, local: phone.slice(match.code.length) }
    : { dialCode: '+34', local: phone };
}
