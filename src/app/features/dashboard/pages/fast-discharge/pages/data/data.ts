import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, InputFieldComponent } from '@apolo-energies/ui';
import { FastDischargeStore } from '../../store/fast-discharge.store';

const PHONE_COUNTRIES = [
  { code: '+34',  flag: '🇪🇸', name: 'España'     },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia'     },
  { code: '+52',  flag: '🇲🇽', name: 'México'      },
  { code: '+54',  flag: '🇦🇷', name: 'Argentina'   },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia'    },
  { code: '+56',  flag: '🇨🇱', name: 'Chile'       },
  { code: '+51',  flag: '🇵🇪', name: 'Perú'        },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela'   },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador'     },
  { code: '+1',   flag: '🇺🇸', name: 'EE.UU.'      },
  { code: '+44',  flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+351', flag: '🇵🇹', name: 'Portugal'    },
  { code: '+212', flag: '🇲🇦', name: 'Marruecos'   },
];

const PHONE_SPLIT_CODES = PHONE_COUNTRIES
  .slice()
  .sort((a, b) => b.code.length - a.code.length);

function splitPhone(phone: string): { code: string; local: string } {
  const match = PHONE_SPLIT_CODES.find(c => phone.startsWith(c.code));
  return match
    ? { code: match.code, local: phone.slice(match.code.length) }
    : { code: '+34', local: phone };
}

const SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
const NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

@Component({
  selector: 'app-fd-data',
  imports: [ButtonComponent, InputFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center min-h-full px-4 py-8">
      <div class="w-full max-w-lg bg-card border border-border rounded-lg shadow-xl px-8 py-8 space-y-6">

        <div>
          <p class="text-xl font-bold text-foreground">Datos del cliente</p>
          <p class="text-sm text-muted-foreground">Introduce los datos de contacto del cliente.</p>
        </div>

        <form (submit)="$event.preventDefault(); onSubmit()" class="space-y-5">

          <div>
            <ui-input
              label="NIF Cliente / Titular"
              placeholder="12345678A"
              [value]="nif()"
              (valueChange)="nif.set($event)"
            />
            @if (errors()['nif']) {
              <span class="text-red-500 text-xs mt-1 block">{{ errors()['nif'] }}</span>
            }
          </div>

          <div>
            <ui-input
              label="Nombre / Razón Social"
              placeholder="Juan García López"
              [value]="name()"
              (valueChange)="name.set($event)"
            />
            @if (errors()['name']) {
              <span class="text-red-500 text-xs mt-1 block">{{ errors()['name'] }}</span>
            }
          </div>

          <div>
            <ui-input
              label="Email"
              type="email"
              placeholder="cliente@ejemplo.es"
              [value]="email()"
              (valueChange)="email.set($event)"
            />
            @if (errors()['email']) {
              <span class="text-red-500 text-xs mt-1 block">{{ errors()['email'] }}</span>
            }
          </div>

          <!-- Teléfono: prefijo + número (mismo patrón que editar usuario) -->
          <div class="space-y-1">
            <label class="text-sm font-medium text-muted-foreground">Teléfono</label>
            <div class="flex">
              <select
                [class]="selectCls"
                [value]="countryCode()"
                (change)="countryCode.set($any($event.target).value)"
              >
                @for (c of phoneCountries; track c.code) {
                  <option [value]="c.code">{{ c.flag }} {{ c.code }}</option>
                }
              </select>
              <input
                type="tel"
                placeholder="612 345 678"
                [class]="numberCls"
                [value]="phoneNumber()"
                (input)="phoneNumber.set($any($event.target).value)"
              />
            </div>
            @if (errors()['phone']) {
              <span class="text-red-500 text-xs mt-1 block">{{ errors()['phone'] }}</span>
            }
          </div>

          <div class="border-t border-border pt-4 flex justify-center">
            <ui-button label="Siguiente" size="sm" type="submit" />
          </div>

        </form>
      </div>
    </div>
  `,
})
export class DataPage {
  private readonly router = inject(Router);
  private readonly store  = inject(FastDischargeStore);

  readonly submitted    = signal(false);
  readonly nif          = signal('');
  readonly name         = signal('');
  readonly email        = signal('');
  readonly countryCode  = signal('+34');
  readonly phoneNumber  = signal('');

  readonly phoneCountries = PHONE_COUNTRIES;
  readonly selectCls      = SELECT_CLS;
  readonly numberCls      = NUMBER_CLS;

  constructor() {
    const person = this.store.person();
    if (person) {
      this.nif.set(person.dni);
      this.name.set(person.name);
      this.email.set(person.email);
      const { code, local } = splitPhone(person.phone);
      this.countryCode.set(code);
      this.phoneNumber.set(local);
    }
  }

  readonly errors = computed<Record<string, string | null>>(() => {
    if (!this.submitted()) return { nif: null, name: null, email: null, phone: null };
    return {
      nif:   !this.nif().trim()         ? 'Este campo es obligatorio'
           : this.nif().trim().length < 9 ? 'Mínimo 9 caracteres' : null,
      name:  !this.name().trim()        ? 'Este campo es obligatorio' : null,
      email: !this.email().trim()       ? 'Este campo es obligatorio'
           : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email()) ? 'Email inválido' : null,
      phone: !this.phoneNumber().trim() ? 'Este campo es obligatorio'
           : !/^[0-9]{9,15}$/.test(this.phoneNumber().replace(/\s/g, '')) ? 'Solo dígitos, entre 9 y 15 números' : null,
    };
  });

  private isValid(): boolean {
    return Object.values(this.errors()).every(e => !e);
  }

  onSubmit(): void {
    this.submitted.set(true);
    if (!this.isValid()) return;

    this.store.setPerson({
      type:         'Individual',
      dni:          this.nif(),
      name:         this.name(),
      surnames:     '',
      email:        this.email(),
      phone:        this.countryCode() + this.phoneNumber().replace(/\s/g, ''),
      address_1:    '',
      address_2:    '',
      bank_account: '',
    });

    this.router.navigate(['/dashboard/fast-discharge/supply-point']);
  }
}
