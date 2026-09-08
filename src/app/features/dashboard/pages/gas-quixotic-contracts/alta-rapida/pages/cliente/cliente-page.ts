import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '@apolo-energies/ui';
import { AuthService } from '@apolo-energies/auth';
import { AltaRapidaGasStore } from '../../store/alta-rapida-gas.store';
import { getUserRoles } from '../../../../../../../utils/auth.utils';

const INPUT_CLS  = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
const SELECT_CLS = 'px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
const PHONE_SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
const PHONE_NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

// Mismo catálogo/patrón de teléfono que fast-discharge/pages/data/data.ts.
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

@Component({
  selector: 'app-arg-cliente-page',
  imports: [ButtonComponent],
  templateUrl: './cliente-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClientePage {
  private readonly router = inject(Router);
  private readonly store  = inject(AltaRapidaGasStore);
  private readonly auth   = inject(AuthService);

  /** Master llega desde el listado y vuelve ahí; el resto de roles llega desde
   *  "Alta Rápida" del header y no tiene acceso al listado (Master-only). */
  readonly isMaster = computed(() => getUserRoles(this.auth.currentUser()).includes('Master'));

  readonly draft = this.store.draft;
  readonly inputCls  = INPUT_CLS;
  readonly selectCls = SELECT_CLS;
  readonly phoneSelectCls = PHONE_SELECT_CLS;
  readonly phoneNumberCls = PHONE_NUMBER_CLS;
  readonly phoneCountries = PHONE_COUNTRIES;

  private readonly initialPhone = splitPhone(this.store.draft().phoneNumber);
  readonly phoneCountryCode = signal(this.initialPhone.code);
  readonly phoneLocalNumber = signal(this.initialPhone.local);
  readonly phoneMaxLength   = computed(() => this.phoneCountryCode() === '+34' ? 9 : 15);

  readonly personTypeOptions = [
    { value: 'natural_person', label: 'Persona física' },
    { value: 'legal_entity',   label: 'Persona jurídica' },
  ];

  readonly documentTypeOptions = ['NIF', 'NIE', 'Pasaporte', 'VAT', 'Otros'];

  private static readonly DOCUMENT_PLACEHOLDERS: Record<string, string> = {
    NIF:       '12345678A',
    NIE:       'X1234567L',
    Pasaporte: 'AB123456',
    VAT:       'ESB12345678',
    Otros:     '',
  };

  readonly documentPlaceholder = computed(() =>
    ClientePage.DOCUMENT_PLACEHOLDERS[this.draft().documentType] ?? '12345678A'
  );

  readonly isLegalPerson = computed(() => this.draft().personType === 'legal_entity');

  readonly submitted = signal(false);

  readonly errors = computed<Record<string, string | null>>(() => {
    if (!this.submitted()) return { fullName: null, documentNumber: null, email: null, phone: null };
    const email = this.draft().email.trim();
    const phone = this.phoneLocalNumber().trim();
    return {
      fullName:       this.draft().fullName.trim()       === '' ? 'Obligatorio' : null,
      documentNumber: this.draft().documentNumber.trim() === '' ? 'Obligatorio' : null,
      email:          email === ''                                            ? 'Obligatorio'
                    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)               ? 'Email inválido' : null,
      phone:          phone === ''                              ? 'Obligatorio'
                    : !/^[0-9]{9,15}$/.test(phone)               ? 'Solo dígitos, 9–15 números' : null,
    };
  });

  updateField<K extends keyof ReturnType<typeof this.store.draft>>(key: K, value: string): void {
    this.store.update({ [key]: value } as never);
  }

  onPersonTypeChange(value: string): void {
    this.store.update({
      personType: value as 'natural_person' | 'legal_entity',
      cnae: value === 'legal_entity' ? this.draft().cnae : '',
    });
  }

  onPhoneCountryChange(code: string): void {
    this.phoneCountryCode.set(code);
    this.syncPhone();
  }

  onPhoneInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '').slice(0, this.phoneMaxLength());
    el.value = digits;
    this.phoneLocalNumber.set(digits);
    this.syncPhone();
  }

  private syncPhone(): void {
    const local = this.phoneLocalNumber().trim();
    this.store.update({ phoneNumber: local ? this.phoneCountryCode() + local : '' });
  }

  private isValid(): boolean {
    return Object.values(this.errors()).every(e => !e);
  }

  next(): void {
    this.submitted.set(true);
    if (!this.isValid()) return;
    this.router.navigate(['/dashboard/gas/quixotic-contracts/new/direccion-pago']);
  }

  cancel(): void {
    this.store.reset();
    this.router.navigate([this.isMaster() ? '/dashboard/gas/quixotic-contracts' : '/dashboard/comparator/gas']);
  }
}
