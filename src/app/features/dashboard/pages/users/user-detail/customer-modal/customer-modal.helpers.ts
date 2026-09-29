import { AbstractControl, ValidationErrors } from '@angular/forms';
import { UserDetail } from '../../../../../../core/models/user-detail.model';

export interface PhoneCountry {
  code: string;
  flag: string;
  name: string;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
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

export function splitPhone(phone: string): { dialCode: string; local: string } {
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

export function phoneLocalValidator(control: AbstractControl): ValidationErrors | null {
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

export const STREET_TYPES = ['Calle', 'Avenida', 'Paseo', 'Bulevar', 'Ronda', 'Plaza', 'Alameda', 'Rambla', 'Camino', 'Vía'];

export function splitStreetAddress(addr: string): { type: string; name: string } {
  const typeMatch = STREET_TYPES.find(t =>
    addr.toLowerCase().startsWith(t.toLowerCase() + ' ')
  );
  const type = typeMatch ?? 'Calle';
  const name = typeMatch ? addr.slice(type.length + 1).trim() : addr;
  return { type, name };
}

export const INPUT_CLS  = 'w-full px-4 py-2.5 text-sm rounded-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';
export const SELECT_CLS = 'shrink-0 px-2 py-2.5 text-sm rounded-l-lg border border-r-0 bg-card border-border text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer';
export const NUMBER_CLS = 'flex-1 min-w-0 px-4 py-2.5 text-sm rounded-r-lg border bg-card border-border text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all';

export const PERSON_TYPE_OPTIONS = [
  { value: 0, label: 'Persona Física' },
  { value: 1, label: 'Persona Jurídica' },
];

export function errorMessage(errors: ValidationErrors | null | undefined): string {
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

export interface CustomerFormRawValue {
  firstName: string;
  lastName1: string;
  lastName2: string;
  dni: string;
  companyName: string;
  cif: string;
  email: string;
  dialCode: string;
  phoneNumber: string;
  legalStreetType: string;
  legalStreet: string;
  legalNumber: string;
  cityLegal: string;
  postalCodeLegal: string;
  notificationStreetType: string;
  notificationStreet: string;
  notificationNumber: string;
  cityNotification: string;
  postalCodeNotification: string;
  bankAccount: string;
}

export function buildCustomerPayload(user: UserDetail, personType: number, raw: CustomerFormRawValue) {
  const isIndividual = personType === 0;

  return {
    userId:                 user.id,
    kind:                   1,
    personType,
    firstName:              raw.firstName  || '',
    lastName:               raw.lastName1  || '',
    secondLastName:         raw.lastName2  || '',
    dni:                    raw.dni       || '',
    companyName:            !isIndividual ? raw.companyName : '',
    cif:                    !isIndividual ? raw.cif         : '',
    email:                  raw.email,
    phone:                  raw.phoneNumber ? `${raw.dialCode}${raw.phoneNumber}` : '',
    legalAddress:           `${raw.legalStreetType} ${raw.legalStreet}`,
    legalNumber:            raw.legalNumber,
    notificationAddress:    `${raw.notificationStreetType} ${raw.notificationStreet}`,
    notificationNumber:     raw.notificationNumber,
    cityLegal:              raw.cityLegal,
    cityNotification:       raw.cityNotification,
    bankAccount:            raw.bankAccount,
    postalCodeLegal:        raw.postalCodeLegal        || undefined,
    postalCodeNotification: raw.postalCodeNotification || undefined,
  };
}
